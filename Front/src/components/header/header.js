/* Запоминание выбранной аудитории */

if (document.body.classList.contains("business-page")) {
  localStorage.setItem("tokAudience", "business");
} else if (document.body.classList.contains("consumer-page")) {
  localStorage.setItem("tokAudience", "consumer");
}
