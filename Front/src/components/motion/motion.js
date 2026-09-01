/* Плавное появление элементов при прокрутке */

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

if (!prefersReducedMotion.matches && "IntersectionObserver" in window) {
  const revealSelectors = [
    ".hero-copy > *",
    ".hero-media",
    ".subpage-hero .container > *",
    ".section-heading",
    ".advantages-grid article",
    ".expert-card",
    ".direction-card",
    ".work-card",
    ".review",
    ".project-case",
    ".price-category",
    ".contact-card",
    ".catalog-empty",
  ];
  const revealItems = [...document.querySelectorAll(revealSelectors.join(","))];

  document.documentElement.classList.add("motion-enabled");

  revealItems.forEach((item) => {
    const siblings = [...(item.parentElement?.children || [])];
    const siblingIndex = Math.max(0, siblings.indexOf(item));
    item.classList.add("motion-reveal");
    item.style.setProperty("--motion-delay", `${Math.min(siblingIndex, 5) * 55}ms`);
  });

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
        window.setTimeout(() => {
          entry.target.classList.remove("motion-reveal", "is-visible");
          entry.target.style.removeProperty("--motion-delay");
        }, 1100);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -7% 0px",
    },
  );

  requestAnimationFrame(() => {
    revealItems.forEach((item) => revealObserver.observe(item));
  });
}
