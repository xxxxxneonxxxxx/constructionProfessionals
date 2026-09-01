/* Аудитория и безопасный вывод данных */

const AUDIENCE_KEY = "tokAudience";
const validAudiences = new Set(["consumer", "business"]);
const siteBasePath =
  typeof window.TOK_BASE_PATH === "string" ? window.TOK_BASE_PATH : "";

function sitePath(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteBasePath}${normalized}`;
}

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
  );
}

function resolveAudience() {
  const fixedAudience = document.body.dataset.audience;
  if (validAudiences.has(fixedAudience)) {
    localStorage.setItem(AUDIENCE_KEY, fixedAudience);
    return fixedAudience;
  }
  const requested = new URLSearchParams(window.location.search).get("audience");
  const stored = localStorage.getItem(AUDIENCE_KEY);
  const audience = validAudiences.has(requested)
    ? requested
    : validAudiences.has(stored)
      ? stored
      : "consumer";
  localStorage.setItem(AUDIENCE_KEY, audience);
  return audience;
}

function applyAudience(audience) {
  const isBusiness = audience === "business";
  document.body.classList.toggle("business-page", isBusiness);
  document.body.classList.toggle("consumer-page", !isBusiness);
  document
    .querySelector(".subpage-contact-card")
    ?.classList.toggle("business-contact-card", isBusiness);

  document.querySelectorAll("[data-audience-option]").forEach((link) => {
    const active = link.dataset.audienceOption === audience;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  document.querySelectorAll("[data-audience-home]").forEach((link) => {
    const sectionBase = document.body.hasAttribute("data-section-base")
      ? document.body.dataset.sectionBase || siteBasePath
      : sitePath("/elektrika");
    link.href = isBusiness ? `${sectionBase}/business/` : `${sectionBase}/`;
  });

  document.querySelectorAll("[data-site-home]").forEach((link) => {
    link.href = isBusiness ? sitePath("/business/") : sitePath("/");
  });

  const content = isBusiness
    ? {
        eyebrow: "Заявка для бизнеса",
        title: "Расскажите об объекте",
        copy: "Укажите телефон и суть задачи. Мы уточним детали и предложим следующий шаг: консультацию или выезд на объект.",
        button: "Отправить заявку",
      }
    : {
        eyebrow: "Обсудим задачу",
        title: "Расскажите, что нужно сделать",
        copy: "Перезвоним, зададим несколько вопросов и сориентируем по следующему шагу.",
        button: "Оставить заявку",
      };

  const eyebrow = document.querySelector("[data-contact-eyebrow]");
  const title = document.querySelector("[data-contact-title]");
  const copy = document.querySelector("[data-contact-copy]");
  if (eyebrow) eyebrow.textContent = content.eyebrow;
  if (title) title.textContent = content.title;
  if (copy) copy.textContent = content.copy;
}
