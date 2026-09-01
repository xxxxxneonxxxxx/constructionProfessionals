import assert from "node:assert/strict";
import test from "node:test";
import { buildEmail, escapeHtml } from "../src/notifications.js";
import { validateLeadPayload } from "../src/validation.js";

const now = 2_000_000;
const common = {
  phone: "+7 (999) 123-45-67",
  consent: true,
  sourcePage: "elektrika/home",
  sourceTitle: "Электрика",
  website: "",
  formStartedAt: now - 5000,
  turnstileToken: "test-token",
};

test("принимает частную заявку с ФИО", () => {
  const result = validateLeadPayload({ ...common, audience: "consumer", fullName: "Иван Петров" }, now);
  assert.equal(result.ok, true);
  assert.equal(result.value.phone, "+79991234567");
});

test("не принимает частную заявку без ФИО", () => {
  const result = validateLeadPayload({ ...common, audience: "consumer", fullName: "" }, now);
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_full_name");
});

test("принимает бизнес-заявку по отдельной схеме", () => {
  const result = validateLeadPayload({
    ...common,
    audience: "business",
    company: "Компания",
    objectType: "Офис",
    details: "Нужно выполнить электромонтажные работы",
  }, now);
  assert.equal(result.ok, true);
});

test("отклоняет номер длиннее 11 цифр", () => {
  const result = validateLeadPayload({
    ...common,
    audience: "business",
    phone: "+7923218818886",
    details: "Нужно выполнить электромонтажные работы",
  }, now);
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_phone");
});

test("принимает российский номер, набранный через 8", () => {
  const result = validateLeadPayload({ ...common, audience: "consumer", phone: "8 (999) 123-45-67", fullName: "Иван Петров" }, now);
  assert.equal(result.ok, true);
  assert.equal(result.value.phone, "+79991234567");
});

test("отклоняет слишком быструю отправку", () => {
  const result = validateLeadPayload({ ...common, audience: "consumer", fullName: "Иван", formStartedAt: now - 100 }, now);
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_form_time");
});

test("экранирует HTML перед уведомлением", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("формирует безопасное письмо", () => {
  const email = buildEmail({
    id: "lead-1",
    submittedAt: "2026-09-01T00:00:00.000Z",
    lead: {
      audience: "consumer",
      fullName: "Иван <Петров>",
      phone: "+79991234567",
      sourcePage: "home",
    },
  }, { EMAIL_FROM: "leads@example.com", EMAIL_TO: "owner@example.com" });
  assert.equal(email.subject, "Новая заявка lead-1");
  assert.match(email.html, /Иван &lt;Петров&gt;/);
  assert.doesNotMatch(email.html, /Иван <Петров>/);
});
