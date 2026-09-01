/* Прайс-лист */

function renderPrices(categories) {
  const root = document.querySelector("#price-catalog");
  if (!root) return;

  if (!categories.length) {
    root.innerHTML = `<div class="catalog-empty"><span aria-hidden="true">+</span><h2>Прайс-лист пока пуст</h2><p>Категории и цены появятся здесь сразу после заполнения файла данных.</p></div>`;
    root.classList.remove("is-loading");
    return;
  }

  root.innerHTML = categories
    .map((category, index) => {
      let lastGroup = "";
      const rows = (category.items || [])
        .map((item) => {
          const group =
            item.group && item.group !== lastGroup
              ? `<div class="price-group-label">${escapeHtml(item.group)}</div>`
              : "";
          if (item.group) lastGroup = item.group;
          return `${group}<div class="catalog-price-row"><span>${escapeHtml(item.name)}${item.unit ? ` <small>${escapeHtml(item.unit)}</small>` : ""}</span><b>${escapeHtml(item.price)}</b></div>`;
        })
        .join("");
      return `
      <section class="price-category" id="${escapeHtml(category.id)}">
        <div class="price-category-heading"><span>${String(index + 1).padStart(2, "0")}</span><h2>${escapeHtml(category.title)}</h2></div>
        ${category.note ? `<p class="price-category-note">${escapeHtml(category.note)}</p>` : ""}
        <div class="catalog-price-list">${rows}</div>
      </section>`;
    })
    .join("");

  root.classList.remove("is-loading");
}
