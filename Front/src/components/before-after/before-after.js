/* Доступный ползунок сравнения фотографий */

function initBeforeAfterComparisons(root = document) {
  root.querySelectorAll("[data-before-after]").forEach((comparison) => {
    if (comparison.dataset.beforeAfterBound === "true") return;

    const range = comparison.querySelector(".before-after__range");
    if (!range) return;

    const update = () => {
      const value = Math.min(100, Math.max(0, Number(range.value) || 0));
      comparison.style.setProperty("--before-after-position", `${value}%`);
      range.setAttribute(
        "aria-valuetext",
        `${value}% фотографии «До», ${100 - value}% фотографии «После»`,
      );
    };

    comparison.dataset.beforeAfterBound = "true";
    range.addEventListener("input", update);
    range.addEventListener("change", update);
    range.addEventListener("pointerdown", (event) => event.stopPropagation());
    range.addEventListener("click", (event) => event.stopPropagation());
    update();
  });
}

window.initBeforeAfterComparisons = initBeforeAfterComparisons;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () =>
    initBeforeAfterComparisons(),
  );
} else {
  initBeforeAfterComparisons();
}

