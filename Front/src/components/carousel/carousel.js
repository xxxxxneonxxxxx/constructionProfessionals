/* Карусель примеров работ */

function moveSlider(name, direction) {
  const carousel = document.querySelector(`[data-carousel="${name}"]`);
  if (!carousel) return;

  const track = carousel.querySelector(".carousel-track");
  const cards = [...track.children];
  if (!cards.length) return;

  const cardWidth = cards[0].getBoundingClientRect().width;
  const gap = parseFloat(getComputedStyle(track).gap) || 0;
  const step = cardWidth + gap;

  const maxScroll = carousel.scrollWidth - carousel.clientWidth;
  const atStart = carousel.scrollLeft <= 2;
  const atEnd = carousel.scrollLeft >= maxScroll - 2;
  let target;

  if (direction === "next") {
    target = atEnd ? 0 : Math.min(carousel.scrollLeft + step, maxScroll);
  } else {
    target = atStart ? maxScroll : Math.max(carousel.scrollLeft - step, 0);
  }

  carousel.scrollTo({ left: target, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest(".slider-button");
  if (button && !button.closest(".project-image-controls"))
    moveSlider(button.dataset.slider, button.dataset.direction);
});
