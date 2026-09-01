import { sendEmail, sendTelegram } from "./notifications.js";
import { cacheGet, cachePut, hmacHex, isAllowedOrigin, json, responseHeaders, verifyTurnstile } from "./security.js";
import { publicValidationMessage, validateLeadPayload } from "./validation.js";

const MAX_BODY_BYTES = 16 * 1024;
const IDEMPOTENCY_TTL_SECONDS = 15 * 60;
const PHONE_DEDUPE_TTL_SECONDS = 10 * 60;

async function handleLead(request, env, ctx) {
  if (!isAllowedOrigin(request, env)) return json(request, env, 403, { ok: false, error: "Запрос отклонён." });

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json(request, env, 415, { ok: false, error: "Поддерживается только JSON." });
  }

  const declaredSize = Number(request.headers.get("Content-Length") || 0);
  if (declaredSize > MAX_BODY_BYTES) return json(request, env, 413, { ok: false, error: "Запрос слишком большой." });

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateResult = await env.LEAD_RATE_LIMITER.limit({ key: ip });
  if (!rateResult.success) {
    console.warn("Lead rejected", { reason: "rate_limit" });
    return json(request, env, 429, { ok: false, code: "rate_limit", error: "Слишком много запросов. Попробуйте позже." });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json(request, env, 413, { ok: false, error: "Запрос слишком большой." });
  }

  let input;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return json(request, env, 400, { ok: false, error: "Некорректный JSON." });
  }

  const validated = validateLeadPayload(input);
  if (!validated.ok) {
    console.warn("Lead rejected", { reason: validated.code });
    return json(request, env, 400, { ok: false, code: validated.code, error: publicValidationMessage(validated.code) });
  }
  const lead = validated.value;

  // Honeypot: отвечаем как на принятую заявку, но ничего не отправляем.
  if (lead.website) return json(request, env, 202, { ok: true, id: crypto.randomUUID() });

  const idempotencyKey = request.headers.get("Idempotency-Key") || "";
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)) {
    return json(request, env, 400, { ok: false, error: "Обновите страницу и отправьте форму ещё раз." });
  }

  const idempotencyHash = await hmacHex(env.LEAD_HASH_SECRET, `id:${idempotencyKey}`);
  const previous = await cacheGet(`idempotency/${idempotencyHash}`);
  if (previous) return json(request, env, 202, await previous.json());

  const turnstileValid = await verifyTurnstile(lead.turnstileToken, request, env);
  if (!turnstileValid) {
    console.warn("Lead rejected", { reason: "turnstile_failed" });
    return json(request, env, 403, { ok: false, code: "turnstile_failed", error: "Не удалось подтвердить защиту от роботов." });
  }

  const phoneHash = await hmacHex(env.LEAD_HASH_SECRET, `phone:${lead.phone}`);
  const duplicatePhone = await cacheGet(`phone/${phoneHash}`);
  if (duplicatePhone) {
    const accepted = { ok: true, id: "already-accepted" };
    ctx.waitUntil(cachePut(`idempotency/${idempotencyHash}`, accepted, IDEMPOTENCY_TTL_SECONDS));
    return json(request, env, 202, accepted);
  }

  const id = crypto.randomUUID();
  const queueMessage = {
    id,
    submittedAt: new Date().toISOString(),
    lead: {
      audience: lead.audience,
      fullName: lead.fullName,
      phone: lead.phone,
      company: lead.company,
      objectType: lead.objectType,
      details: lead.details,
      sourcePage: lead.sourcePage,
      sourceTitle: lead.sourceTitle,
    },
  };

  await env.LEAD_QUEUE.send(queueMessage, { contentType: "json" });
  console.info("Lead accepted", { id, audience: lead.audience, sourcePage: lead.sourcePage });
  const accepted = { ok: true, id };
  ctx.waitUntil(Promise.all([
    cachePut(`idempotency/${idempotencyHash}`, accepted, IDEMPOTENCY_TTL_SECONDS),
    cachePut(`phone/${phoneHash}`, accepted, PHONE_DEDUPE_TTL_SECONDS),
  ]));
  return json(request, env, 202, accepted);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json(request, env, 200, { ok: true });
    }
    if (url.pathname !== "/api/leads") return json(request, env, 404, { ok: false, error: "Не найдено." });
    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(request, env)) return json(request, env, 403, { ok: false });
      return new Response(null, { status: 204, headers: responseHeaders(request, env) });
    }
    if (request.method !== "POST") return json(request, env, 405, { ok: false, error: "Метод не поддерживается." });
    try {
      return await handleLead(request, env, ctx);
    } catch (error) {
      console.error("Lead request failed", error instanceof Error ? error.message : "unknown");
      return json(request, env, 500, { ok: false, error: "Не удалось принять заявку. Попробуйте позже." });
    }
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const telegramDeliveryKey = `delivery/${message.body.id}/telegram`;
        const emailDeliveryKey = `delivery/${message.body.id}/email`;
        const telegramDelivered = env.ENABLE_TELEGRAM !== "true" || await cacheGet(telegramDeliveryKey);
        const emailDelivered = env.ENABLE_EMAIL !== "true" || await cacheGet(emailDeliveryKey);
        await Promise.all([
          telegramDelivered
            ? Promise.resolve()
            : sendTelegram(message.body, env).then(() => cachePut(telegramDeliveryKey, { ok: true }, 4 * 24 * 60 * 60)),
          emailDelivered
            ? Promise.resolve()
            : sendEmail(message.body, env).then(() => cachePut(emailDeliveryKey, { ok: true }, 4 * 24 * 60 * 60)),
        ]);
        message.ack();
      } catch (error) {
        console.error("Lead delivery failed", message.body?.id, error instanceof Error ? error.message : "unknown");
        message.retry({ delaySeconds: 60 });
      }
    }
  },
};
