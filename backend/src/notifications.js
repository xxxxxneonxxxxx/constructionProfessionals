function escapeHtml(value = "") {
  return String(value).replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character]);
}

function linesForLead(message) {
  const { id, submittedAt, lead } = message;
  const lines = [
    ["Номер", id],
    ["Дата", submittedAt],
    ["Тип", lead.audience === "business" ? "Бизнес" : "Частный клиент"],
    ["ФИО", lead.fullName],
    ["Телефон", lead.phone],
    ["Компания", lead.company],
    ["Тип объекта", lead.objectType],
    ["Описание", lead.details],
    ["Страница", lead.sourceTitle || lead.sourcePage],
  ];
  return lines.filter(([, value]) => value);
}

export async function sendTelegram(message, env) {
  if (env.ENABLE_TELEGRAM !== "true") return;
  const text = [
    "<b>Новая заявка с сайта</b>",
    ...linesForLead(message).map(([label, value]) => `<b>${escapeHtml(label)}:</b> ${escapeHtml(value)}`),
  ].join("\n");
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) throw new Error(`Telegram delivery failed: ${response.status}`);
  console.info("Telegram notification delivered", message.id);
}

export function buildEmail(message, env) {
  const rows = linesForLead(message)
    .map(([label, value]) => `<tr><th align="left" style="padding:6px 12px 6px 0">${escapeHtml(label)}</th><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`)
    .join("");
  const text = ["Новая заявка с сайта", ...linesForLead(message).map(([label, value]) => `${label}: ${value}`)].join("\n");
  return {
    from: env.EMAIL_FROM,
    to: env.EMAIL_TO,
    subject: `Новая заявка ${message.id}`,
    text,
    html: `<h2>Новая заявка с сайта</h2><table>${rows}</table>`,
  };
}

export async function sendEmail(message, env) {
  const email = buildEmail(message, env);
  if (env.LOG_NOTIFICATIONS === "true") {
    console.log("EMAIL PREVIEW", JSON.stringify(email, null, 2));
  }
  if (env.ENABLE_EMAIL !== "true") return;
  await env.EMAIL.send(email);
  console.info("Email notification delivered", message.id);
}

export { escapeHtml };
