/* Запуск страницы и отправка заявок */

async function initializeCatalog() {
  const audience = resolveAudience();
  applyAudience(audience);

  try {
    if (document.querySelector("#projects-list")) {
      const root = document.querySelector("#projects-list");
      if (root.dataset.serverRendered === "true") {
        bindProjectGalleryControls(root);
      } else {
        const fallbackUrl = root.dataset.fallbackUrl || `/elektrika/data/projects-${audience}.json`;
        if (document.body.classList.contains("home-works-page")) {
          const response = await fetch(fallbackUrl);
          if (!response.ok) throw new Error("Project data unavailable");
          renderProjects(await response.json());
        } else {
          renderProjects(await fetchData("/api/projects", fallbackUrl, audience));
        }
      }
    }
    if (document.querySelector("#price-catalog")) {
      const root = document.querySelector("#price-catalog");
      if (root.dataset.serverRendered !== "true") {
        renderPrices(
          await fetchData(
            "/api/prices",
            root.dataset.fallbackUrl || "/elektrika/data/prices.json",
            audience,
          ),
        );
      }
    }
  } catch {
    document.querySelectorAll(".loading-state").forEach((state) => {
      state.textContent =
        "Не удалось загрузить данные. Позвоните нам, и мы всё расскажем.";
    });
    document
      .querySelectorAll(".project-list, .price-catalog")
      .forEach((root) => root.classList.remove("is-loading"));
  }

}

initializeCatalog();
