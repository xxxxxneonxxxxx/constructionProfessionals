const encoder = new TextEncoder();

export function allowedOrigins(env) {
  return new Set(
    String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return env.ALLOW_NO_ORIGIN === "true";
  return allowedOrigins(env).has(origin);
}

export function responseHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    Vary: "Origin",
  };
  if (origin && allowedOrigins(env).has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Idempotency-Key";
    headers["Access-Control-Max-Age"] = "600";
  }
  return headers;
}

export function json(request, env, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request, env),
  });
}

export async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyTurnstile(token, request, env) {
  const payload = new FormData();
  payload.set("secret", env.TURNSTILE_SECRET_KEY);
  payload.set("response", token);
  payload.set("remoteip", request.headers.get("CF-Connecting-IP") || "");
  payload.set("idempotency_key", crypto.randomUUID());

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: payload,
  });
  if (!response.ok) return false;
  const result = await response.json();
  if (!result.success) return false;
  const usesOfficialTestingKey = result.metadata?.result_with_testing_key === true;
  if (env.TURNSTILE_EXPECTED_HOSTNAME && result.hostname !== env.TURNSTILE_EXPECTED_HOSTNAME && !usesOfficialTestingKey) return false;
  if (env.TURNSTILE_EXPECTED_ACTION && result.action !== env.TURNSTILE_EXPECTED_ACTION && !usesOfficialTestingKey) return false;
  return true;
}

export async function cacheGet(key) {
  try {
    return await caches.default.match(new Request(`https://lead-cache.invalid/${key}`));
  } catch {
    return null;
  }
}

export async function cachePut(key, body, ttlSeconds) {
  try {
    const response = new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttlSeconds}`,
      },
    });
    await caches.default.put(new Request(`https://lead-cache.invalid/${key}`), response);
  } catch {
    // Cache is an additional anti-duplicate layer; a cache failure must not lose a lead.
  }
}
