/* Каталог выполненных работ */

function normalizeCatalogProjectImage(image, projectTitle, imageIndex) {
  return {
    src: typeof image === "string" ? image : image.src,
    alt:
      typeof image === "string"
        ? `${projectTitle} — фото ${imageIndex + 1}`
        : image.alt || `${projectTitle} — фото ${imageIndex + 1}`,
    stage: typeof image === "string" ? "" : image.stage || "",
  };
}

function renderCatalogProjectSlide(image) {
  const stageBadge = image.stage
    ? `<span class="image-stage image-stage-${image.stage === "after" ? "after" : "before"}">${image.stage === "after" ? "После" : "До"}</span>`
    : "";
  return `
      <figure class="project-slide">
        <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" width="1280" height="960" loading="lazy" decoding="async">
        ${stageBadge}
      </figure>`;
}

function renderCatalogBeforeAfterSlide(project, beforeImage, afterImage) {
  const comparisonLabel = `Сравнение фотографий до и после: ${project.title}`;
  return `
      <figure class="project-slide project-comparison-slide">
        <div class="before-after" data-before-after style="--before-after-position: 50%;">
          <img class="before-after__image before-after__image--after" src="${escapeHtml(afterImage.src)}" alt="${escapeHtml(afterImage.alt)}" width="1280" height="800" loading="lazy" decoding="async">
          <img class="before-after__image before-after__image--before" src="${escapeHtml(beforeImage.src)}" alt="${escapeHtml(beforeImage.alt)}" width="1280" height="800" loading="lazy" decoding="async">
          <span class="before-after__label before-after__label--before" aria-hidden="true">До</span>
          <span class="before-after__label before-after__label--after" aria-hidden="true">После</span>
          <input class="before-after__range" type="range" min="0" max="100" value="50" aria-label="${escapeHtml(comparisonLabel)}" aria-valuetext="50% фотографии «До», 50% фотографии «После»">
          <span class="before-after__divider" aria-hidden="true"></span>
          <span class="before-after__handle" aria-hidden="true">↔</span>
        </div>
      </figure>`;
}

function renderCatalogProjectSlides(project) {
  const images = (project.images || []).map((image, imageIndex) =>
    normalizeCatalogProjectImage(image, project.title, imageIndex),
  );
  const beforeIndex = images.findIndex((image) => image.stage === "before");
  const afterIndex = images.findIndex((image) => image.stage === "after");
  const hasComparison = beforeIndex >= 0 && afterIndex >= 0;
  const slides = [];

  if (hasComparison) {
    slides.push(
      renderCatalogBeforeAfterSlide(
        project,
        images[beforeIndex],
        images[afterIndex],
      ),
    );
  }

  images.forEach((image, imageIndex) => {
    if (hasComparison && (imageIndex === beforeIndex || imageIndex === afterIndex))
      return;
    slides.push(renderCatalogProjectSlide(image));
  });

  return { html: slides.join(""), count: slides.length };
}

function renderProjects(projects) {
  const root = document.querySelector("#projects-list");
  if (!root) return;

  if (!projects.length) {
    root.innerHTML = `<div class="catalog-empty"><span aria-hidden="true">+</span><h2>Примеры работ скоро появятся</h2><p>Каталог уже готов: после добавления объекта здесь появится карточка с галереей и списком работ.</p></div>`;
    root.classList.remove("is-loading");
    return;
  }

  root.innerHTML = projects
    .map((project, index) => {
      const sliderName = `case-${escapeHtml(project.id || index)}`;
      const slides = renderCatalogProjectSlides(project);
      const workItems = (project.workItems || [])
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");

      return `
      <article class="project-case">
        <div class="project-gallery">
          <div class="project-carousel-wrap">
            <div class="carousel project-carousel" data-carousel="${sliderName}" tabindex="0" aria-label="Фотографии объекта ${escapeHtml(project.title)}">
              <div class="carousel-track">${slides.html}</div>
            </div>
            ${slides.count > 1 ? `<div class="project-image-controls" aria-label="Переключение фотографий">
              <button class="slider-button" data-slider="${sliderName}" data-direction="prev" aria-label="Предыдущее фото">‹</button>
              <button class="slider-button" data-slider="${sliderName}" data-direction="next" aria-label="Следующее фото">›</button>
            </div>` : ""}
          </div>
        </div>
        <div class="project-details">
          <p class="eyebrow">${escapeHtml(project.type)}</p>
          <h2>${escapeHtml(project.title)}</h2>
          <p class="project-summary">${escapeHtml(project.summary)}</p>
          <h3>Что сделали</h3>
          <ul class="completed-list">${workItems}</ul>
        </div>
      </article>`;
    })
    .join("");

  root.classList.remove("is-loading");

  window.initBeforeAfterComparisons?.(root);
  bindProjectGalleryControls(root);
}

function moveProjectGallery(carousel, direction) {
  if (!carousel) return;
  const track = carousel.querySelector(".carousel-track");
  const slides = [...track.children];
  if (!slides.length) return;

  const slideWidth = slides[0].getBoundingClientRect().width;
  const gap = parseFloat(getComputedStyle(track).gap) || 0;
  const step = slideWidth + gap;

  if (window.matchMedia("(min-width: 1025px)").matches) {
    const current = Number(track.dataset.activeSlide || 0);
    const next =
      direction === "next"
        ? (current + 1) % slides.length
        : (current - 1 + slides.length) % slides.length;
    track.dataset.activeSlide = String(next);
    track.style.transform = `translate3d(-${next * step}px, 0, 0)`;
    return;
  }

  const maxScroll = carousel.scrollWidth - carousel.clientWidth;
  const target =
    direction === "next"
      ? Math.min(carousel.scrollLeft + step, maxScroll)
      : Math.max(carousel.scrollLeft - step, 0);
  carousel.scrollTo({ left: target, behavior: "smooth" });
}

function bindProjectGalleryControls(root = document) {
  root
    .querySelectorAll(".project-image-controls .slider-button")
    .forEach((button) => {
      if (button.dataset.galleryBound === "true") return;
      button.dataset.galleryBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const carousel = button
          .closest(".project-carousel-wrap")
          .querySelector(".project-carousel");
        moveProjectGallery(carousel, button.dataset.direction);
      });
    });
}


/* Сброс desktop-смещения при переходе к touch-режиму */

window.addEventListener("resize", () => {
  if (window.matchMedia("(min-width: 1025px)").matches) return;
  document
    .querySelectorAll(".project-carousel .carousel-track")
    .forEach((track) => {
      track.style.transform = "";
      delete track.dataset.activeSlide;
    });
});
