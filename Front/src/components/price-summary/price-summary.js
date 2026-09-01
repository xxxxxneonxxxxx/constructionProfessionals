/* Раскрытие дополнительных цен */

const allPricesButton = document.querySelector(".all-prices");
const morePrices = document.querySelector(".more-prices");

if (allPricesButton && morePrices) {
  allPricesButton.addEventListener("click", () => {
    const willOpen = morePrices.hidden;
    morePrices.hidden = !willOpen;
    allPricesButton.setAttribute("aria-expanded", String(willOpen));
    allPricesButton.innerHTML = willOpen
      ? "Скрыть цены <span>↑</span>"
      : "Все цены <span>↓</span>";
  });
}
