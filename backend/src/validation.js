const AUDIENCES = new Set(["consumer", "business"]);
const OBJECT_TYPES = new Set([
  "",
  "Офис",
  "Магазин",
  "Торговое помещение",
  "Склад",
  "Производственное помещение",
  "Производство",
  "Другой объект",
]);

function cleanString(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizePhone(value) {
  const raw = cleanString(value, 40);
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  return "";
}

function isValidFullName(value) {
  return value.length >= 2 && value.length <= 120 && /^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u.test(value);
}

export function validateLeadPayload(input, now = Date.now()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "invalid_payload" };
  }

  const audience = cleanString(input.audience, 20);
  if (!AUDIENCES.has(audience)) return { ok: false, code: "invalid_audience" };

  if (input.consent !== true) return { ok: false, code: "consent_required" };

  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, code: "invalid_phone" };

  const sourcePage = cleanString(input.sourcePage, 100);
  const sourceTitle = cleanString(input.sourceTitle, 180);
  if (!sourcePage || !/^[\p{L}\p{N}_/-]+$/u.test(sourcePage)) {
    return { ok: false, code: "invalid_source" };
  }

  const website = cleanString(input.website, 200);
  const formStartedAt = Number(input.formStartedAt);
  if (!Number.isFinite(formStartedAt)) return { ok: false, code: "invalid_form_time" };
  const fillTime = now - formStartedAt;
  if (fillTime < 1500 || fillTime > 2 * 60 * 60 * 1000) {
    return { ok: false, code: "invalid_form_time" };
  }

  const turnstileToken = cleanString(input.turnstileToken, 2048);
  if (!turnstileToken) return { ok: false, code: "turnstile_required" };

  const common = {
    audience,
    phone,
    sourcePage,
    sourceTitle,
    consent: true,
    website,
    formStartedAt,
    turnstileToken,
  };

  if (audience === "consumer") {
    const fullName = cleanString(input.fullName, 120);
    if (!isValidFullName(fullName)) return { ok: false, code: "invalid_full_name" };
    return {
      ok: true,
      value: {
        ...common,
        fullName,
        company: "",
        objectType: "",
        details: "",
      },
    };
  }

  const company = cleanString(input.company, 120);
  const objectType = cleanString(input.objectType, 80);
  const details = cleanString(input.details, 3000);
  if (company.length > 0 && company.length < 2) return { ok: false, code: "invalid_company" };
  if (!OBJECT_TYPES.has(objectType)) return { ok: false, code: "invalid_object_type" };
  if (details.length < 10) return { ok: false, code: "invalid_details" };

  return {
    ok: true,
    value: {
      ...common,
      fullName: "",
      company,
      objectType,
      details,
    },
  };
}

export function publicValidationMessage(code) {
  const messages = {
    invalid_phone: "Проверьте номер телефона.",
    invalid_full_name: "Укажите ФИО.",
    invalid_details: "Опишите задачу подробнее.",
    consent_required: "Необходимо согласие на обработку данных.",
    turnstile_required: "Подтвердите, что вы не робот.",
    invalid_form_time: "Обновите страницу и заполните форму ещё раз.",
  };
  return messages[code] || "Проверьте заполнение формы.";
}
