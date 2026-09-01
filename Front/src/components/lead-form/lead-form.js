/* Единая безопасная отправка всех форм */

document.querySelectorAll(".contact-form").forEach((contactForm) => {
  contactForm.dataset.formStartedAt = String(Date.now());
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = contactForm.querySelector(".form-status");
    const button = contactForm.querySelector('[type="submit"]');
    const formData = new FormData(contactForm);
    const apiBase =
      typeof window.TOK_API_BASE === "string"
        ? window.TOK_API_BASE.replace(/\/$/, "")
        : "";
    const idempotencyKey =
      contactForm.dataset.idempotencyKey || crypto.randomUUID();
    contactForm.dataset.idempotencyKey = idempotencyKey;

    const payload = {
      audience: formData.get("audience"),
      fullName: formData.get("full_name") || "",
      phone: formData.get("phone") || "",
      company: formData.get("company") || "",
      objectType: formData.get("object_type") || "",
      details: formData.get("details") || "",
      consent: formData.get("consent") === "on",
      sourcePage: formData.get("sourcePage") || "unknown",
      sourceTitle: document.title,
      website: formData.get("website") || "",
      formStartedAt: Number(contactForm.dataset.formStartedAt),
      turnstileToken: formData.get("cf-turnstile-response") || "",
    };

    status.classList.remove("is-error", "is-success");
    status.textContent = "Отправляем…";
    button.disabled = true;
    try {
      if (!apiBase) throw new Error("API is not configured");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetch(`${apiBase}/leads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Не удалось отправить заявку.");

      status.textContent = "Спасибо! Заявка принята, скоро мы свяжемся с вами.";
      status.classList.add("is-success");
      contactForm.reset();
      contactForm.dataset.formStartedAt = String(Date.now());
      delete contactForm.dataset.idempotencyKey;
      if (window.turnstile) window.turnstile.reset();
    } catch (error) {
      status.classList.add("is-error");
      const isNetworkError =
        error instanceof TypeError ||
        (error instanceof Error && error.name === "AbortError");
      status.textContent = isNetworkError
        ? "API сейчас недоступен. Проверьте, что Worker запущен, и попробуйте ещё раз."
        : error instanceof Error
          ? error.message
          : "Не удалось отправить заявку.";
    } finally {
      button.disabled = false;
    }
  });
});
