import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(projectRoot, "src");
const outputRoot = join(projectRoot, "dist");

function normalizeBasePath(value = "") {
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

const basePath = normalizeBasePath(process.env.BASE_PATH);

function prefixRootAttributes(html) {
  if (!basePath) return html;
  return html.replace(
    /(\s[\w:-]+)=(['"])\/(?!\/)/g,
    (_, attribute, quote) => `${attribute}=${quote}${basePath}/`,
  );
}

const read = (path) => readFile(join(sourceRoot, path), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

async function bundleImports(entryPath, pattern) {
  const source = await readFile(entryPath, "utf8");
  let bundled = "";
  let cursor = 0;

  for (const match of source.matchAll(pattern)) {
    bundled += source.slice(cursor, match.index);
    bundled += await bundleImports(resolve(dirname(entryPath), match[1]), pattern);
    cursor = match.index + match[0].length;
  }

  return `${bundled}${source.slice(cursor)}`;
}

const bundleCss = (entryPath) =>
  bundleImports(entryPath, /@import\s+url\(["'](.+?)["']\);/g);

async function bundleJavaScript(entryPath) {
  const code = await bundleImports(
    entryPath,
    /^\s*import\s+["'](.+?)["'];\s*$/gm,
  );
  return `(() => {\n  "use strict";\n${code.trim()}\n})();\n`;
}

function render(template, context) {
  return template.replace(/{{\s*([\w]+)\s*}}/g, (_, key) => {
    if (!(key in context)) return "";
    return String(context[key]);
  });
}

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>\"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
  );
}

function outputToUrl(output) {
  return output === "index.html" ? "/" : `/${output.replace(/index\.html$/, "")}`;
}

function renderImageStage(image) {
  if (!image || typeof image === "string" || !image.stage) return "";
  const stage = image.stage === "after" ? "after" : "before";
  const label = stage === "after" ? "После" : "До";
  return `<span class="image-stage image-stage-${stage}">${label}</span>`;
}

function normalizeProjectImage(image, projectTitle, imageIndex) {
  return {
    source: image,
    src: typeof image === "string" ? image : image.src,
    alt:
      typeof image === "string"
        ? `${projectTitle} — фото ${imageIndex + 1}`
        : image.alt || `${projectTitle} — фото ${imageIndex + 1}`,
    stage: typeof image === "string" ? "" : image.stage || "",
  };
}

function renderRegularProjectSlide(image) {
  return `
      <figure class="project-slide">
        <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" width="1280" height="960" loading="lazy" decoding="async" />
        ${renderImageStage(image.source)}
      </figure>`;
}

function renderBeforeAfterSlide(project, beforeImage, afterImage) {
  const comparisonLabel = `Сравнение фотографий до и после: ${project.title}`;
  return `
      <figure class="project-slide project-comparison-slide">
        <div class="before-after" data-before-after style="--before-after-position: 50%;">
          <img class="before-after__image before-after__image--after" src="${escapeHtml(afterImage.src)}" alt="${escapeHtml(afterImage.alt)}" width="1280" height="800" loading="lazy" decoding="async" />
          <img class="before-after__image before-after__image--before" src="${escapeHtml(beforeImage.src)}" alt="${escapeHtml(beforeImage.alt)}" width="1280" height="800" loading="lazy" decoding="async" />
          <span class="before-after__label before-after__label--before" aria-hidden="true">До</span>
          <span class="before-after__label before-after__label--after" aria-hidden="true">После</span>
          <input class="before-after__range" type="range" min="0" max="100" value="50" aria-label="${escapeHtml(comparisonLabel)}" aria-valuetext="50% фотографии «До», 50% фотографии «После»" />
          <span class="before-after__divider" aria-hidden="true"></span>
          <span class="before-after__handle" aria-hidden="true">↔</span>
        </div>
      </figure>`;
}

function renderProjectSlides(project) {
  const images = (project.images || []).map((image, imageIndex) =>
    normalizeProjectImage(image, project.title, imageIndex),
  );
  const beforeIndex = images.findIndex((image) => image.stage === "before");
  const afterIndex = images.findIndex((image) => image.stage === "after");
  const hasComparison = beforeIndex >= 0 && afterIndex >= 0;
  const slides = [];

  if (hasComparison) {
    slides.push(
      renderBeforeAfterSlide(project, images[beforeIndex], images[afterIndex]),
    );
  }

  images.forEach((image, imageIndex) => {
    if (hasComparison && (imageIndex === beforeIndex || imageIndex === afterIndex))
      return;
    slides.push(renderRegularProjectSlide(image));
  });

  return { html: slides.join(""), count: slides.length };
}

function renderProjectItems(projects) {
  if (!projects.length) {
    return '<div class="catalog-empty"><span aria-hidden="true">+</span><h2>Примеры работ скоро появятся</h2><p>После публикации объектов здесь появятся фотографии и список выполненных работ.</p></div>';
  }

  return projects
    .map((project, index) => {
      const sliderName = `case-${escapeHtml(project.id || index)}`;
      const slides = renderProjectSlides(project);
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
}

function renderFeaturedWorks(projects, worksUrl) {
  if (!projects.length) {
    return `<div class="catalog-empty catalog-empty-compact"><p>Фотографии объектов скоро появятся.</p><a class="text-link" href="${escapeHtml(worksUrl)}">Открыть страницу работ <span>→</span></a></div>`;
  }

  const cards = projects
    .map((project, index) => {
      const projectImages = project.images || [];
      const image = projectImages.find(
        (item) => typeof item !== "string" && item.stage === "after",
      ) || projectImages.find(
        (item) => typeof item === "string" || item.stage !== "before",
      ) || projectImages[0];
      if (!image) return "";
      const src = typeof image === "string" ? image : image.src;
      const alt = typeof image === "string"
        ? `${project.title} — главное фото объекта`
        : image.alt || `${project.title} — главное фото объекта`;
      return `<figure class="work-card"><div class="work-card-image"><img src="${escapeHtml(src)}" width="1280" height="960" loading="lazy" decoding="async" alt="${escapeHtml(alt)}" /></div><figcaption><span>${escapeHtml(project.type || `Объект ${index + 1}`)}</span><b>${escapeHtml(project.title)}</b></figcaption></figure>`;
    })
    .join("");

  return `<div class="featured-carousel-wrap">
        <div class="carousel" data-carousel="trade-works" tabindex="0" aria-label="Выполненные работы">
          <div class="carousel-track works-track">${cards}<a class="work-card work-more-card" href="${escapeHtml(worksUrl)}"><span class="work-more-arrow" aria-hidden="true">↗</span><strong>Посмотреть все фотографии</strong><small>Подробности и состав работ по каждому объекту</small></a></div>
        </div>
        <div class="carousel-buttons featured-carousel-controls" aria-label="Переключение работ"><button class="slider-button" data-slider="trade-works" data-direction="prev" aria-label="Предыдущая работа">‹</button><button class="slider-button" data-slider="trade-works" data-direction="next" aria-label="Следующая работа">›</button></div>
      </div>`;
}

function renderPriceItems(categories) {
  if (!categories.length) {
    return '<div class="catalog-empty"><span aria-hidden="true">+</span><h2>Прайс-лист пока пуст</h2><p>Категории и цены появятся здесь после заполнения данных.</p></div>';
  }

  return categories
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
}

function renderPricePreview(categories, pricesUrl) {
  const allItems = categories.flatMap((category) => category.items || []);
  if (!allItems.length) {
    return `<div class="catalog-empty catalog-empty-compact"><p>Позиции прайса пока не добавлены.</p><a class="all-prices" href="${escapeHtml(pricesUrl)}">Открыть прайс-лист <span>→</span></a></div>`;
  }

  const previewItems = categories.length >= 3
    ? categories.slice(0, 5).map((category) => category.items?.[0]).filter(Boolean)
    : allItems.slice(0, 5);
  const rows = previewItems
    .map(
      (item) =>
        `<div><span>${escapeHtml(item.name)}${item.unit ? ` <small>${escapeHtml(item.unit)}</small>` : ""}</span><b>${escapeHtml(item.price)}</b></div>`,
    )
    .join("");

  const lastTwoDigits = allItems.length % 100;
  const lastDigit = allItems.length % 10;
  const positionWord = lastTwoDigits >= 11 && lastTwoDigits <= 14
    ? "позиций"
    : lastDigit === 1
      ? "позиция"
      : lastDigit >= 2 && lastDigit <= 4
        ? "позиции"
        : "позиций";

  return `<div class="price-list">${rows}</div><a class="all-prices" href="${escapeHtml(pricesUrl)}">Все цены — ${allItems.length} ${positionWord} <span>→</span></a>`;
}

function renderLeadFields(audience) {
  const fullName = `
      <label>
        <span>ФИО *</span>
        <input type="text" name="full_name" autocomplete="name" maxlength="120" placeholder="Иван Иванов" required />
      </label>`;
  const phone = `
      <label>
        <span>Телефон *</span>
        <input type="tel" name="phone" inputmode="tel" autocomplete="tel" maxlength="18" pattern="(?:\\+?7|8)\\s*\\(?[0-9]{3}\\)?\\s*[0-9]{3}\\s*-?\\s*[0-9]{2}\\s*-?\\s*[0-9]{2}" title="Введите российский номер: +7 (999) 123-45-67" placeholder="+7 (___) ___-__-__" required />
      </label>`;

  if (audience === "consumer") return `${fullName}${phone}`;

  return `${phone}
      <label>
        <span>Название компании</span>
        <input type="text" name="company" autocomplete="organization" placeholder="Компания или организация" />
      </label>
      <label class="field-wide">
        <span>Тип объекта</span>
        <select name="object_type">
          <option value="">Выберите объект</option>
          <option>Офис</option>
          <option>Магазин</option>
          <option>Склад</option>
          <option>Производственное помещение</option>
          <option>Другой объект</option>
        </select>
      </label>
      <label class="field-wide">
        <span>Суть заказа *</span>
        <textarea name="details" rows="5" placeholder="Опишите объект и какие работы нужно выполнить" required></textarea>
      </label>`;
}

function renderReviewItems(items) {
  return items
    .map(
      (review, index) => `
      <article class="review${index === 0 ? " featured" : ""}">
        <div class="stars" aria-label="Оценка: 5 из 5">★★★★★</div>
        <blockquote>«${review.text}»</blockquote>
        <footer><b>${review.name}</b><span>${review.meta}</span></footer>
      </article>`,
    )
    .join("");
}

function renderServiceSection(cards, cardTemplate) {
  const items = cards
    .map((card) =>
      render(cardTemplate, {
        ...card,
        features: card.features.map((feature) => `<li>${feature}</li>`).join(""),
      }),
    )
    .join("");

  return `
      <section class="section" id="services">
        <div class="container">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Основные услуги</p>
              <h2>С чем можем помочь</h2>
            </div>
            <p>Собрали основные направления. Точный состав работ определим после уточнения задачи.</p>
          </div>
          <div class="expertise-grid">${items}</div>
        </div>
      </section>`;
}

const pages = [
  {
    source: "pages/elektrika/index.html",
    output: "elektrika/index.html",
    audience: "consumer",
    title: "ТОК — электромонтаж в Томске",
    description:
      "Электромонтажные работы в Томске: квартиры, дома и коммерческие помещения. Честная смета, аккуратный монтаж и гарантия.",
    bodyClass: "consumer-page",
    pagePath: "",
    sourcePage: "home",
  },
  {
    source: "pages/elektrika/business/index.html",
    output: "elektrika/business/index.html",
    audience: "business",
    title: "Электромонтаж для бизнеса в Томске — ТОК",
    description:
      "Электромонтаж для бизнеса в Томске: офисы, магазины, склады и коммерческие помещения. Осмотр объекта, понятная смета и гарантия на работы.",
    bodyClass: "business-page",
    pagePath: "business/",
    sourcePage: "business",
  },
  {
    source: "pages/elektrika/works/index.html",
    output: "elektrika/works/index.html",
    audience: "consumer",
    title: "Результаты электромонтажных работ — ТОК",
    description:
      "Завершённые электромонтажные работы в жилых и коммерческих объектах Томска.",
    bodyClass: "subpage projects-page consumer-page",
    bodyData: ' data-audience="consumer" data-section-base="/elektrika" data-subpage="works"',
    pagePath: "works/",
    sourcePage: "works",
    consumerUrl: "/elektrika/works/",
    businessUrl: "/elektrika/business/works/",
    catalogKind: "works",
    catalog: true,
  },
  {
    source: "pages/elektrika/prices/index.html",
    output: "elektrika/prices/index.html",
    audience: "consumer",
    title: "Цены на электромонтаж — ТОК",
    description: "Полный прайс-лист на электромонтажные работы в Томске.",
    bodyClass: "subpage prices-page consumer-page",
    bodyData: ' data-audience="consumer" data-section-base="/elektrika" data-subpage="prices"',
    pagePath: "prices/",
    sourcePage: "prices",
    consumerUrl: "/elektrika/prices/",
    businessUrl: "/elektrika/business/prices/",
    catalogKind: "prices",
    catalog: true,
  },
  {
    source: "pages/elektrika/works/index.html",
    output: "elektrika/business/works/index.html",
    audience: "business",
    title: "Электромонтажные работы для бизнеса в Томске — ТОК",
    description:
      "Примеры электромонтажных работ для офисов, магазинов, складов и других коммерческих объектов Томска.",
    bodyClass: "subpage projects-page business-page",
    bodyData: ' data-audience="business" data-section-base="/elektrika" data-subpage="works"',
    pagePath: "business/works/",
    sourcePage: "business-works",
    consumerUrl: "/elektrika/works/",
    businessUrl: "/elektrika/business/works/",
    catalogKind: "works",
    catalog: true,
  },
  {
    source: "pages/elektrika/prices/index.html",
    output: "elektrika/business/prices/index.html",
    audience: "business",
    title: "Цены на электромонтаж для бизнеса в Томске — ТОК",
    description:
      "Прайс на электромонтажные работы для офисов, магазинов, складов и коммерческих помещений Томска.",
    bodyClass: "subpage prices-page business-page",
    bodyData: ' data-audience="business" data-section-base="/elektrika" data-subpage="prices"',
    pagePath: "business/prices/",
    sourcePage: "business-prices",
    consumerUrl: "/elektrika/prices/",
    businessUrl: "/elektrika/business/prices/",
    catalogKind: "prices",
    catalog: true,
  },
];

const tradeSections = [
  {
    slug: "santehnika",
    sectionName: "сантехника",
    workName: "сантехнические работы",
    heroFile: "santehnik-tomsk.png",
    heroWidth: 531,
    heroHeight: 1444,
    heroAlt: "Сантехник с инструментами",
    teamRole2: "Мастер-сантехник",
    teamRole3: "Монтажник",
    teamSkill1: "Разводка труб",
    teamSkill2: "Сложные объекты",
    teamSkill3: "Монтаж сантехники",
    teamSkill4: "Диагностика протечек",
    teamSkill5: "Водоснабжение",
    teamSkill6: "Канализация",
    consumer: {
      heroEyebrow: "Сантехнические работы в Томске",
      heroTitle: "Услуги сантехника<br /><span>в Томске</span>",
      heroText: "От замены смесителя до полной разводки водоснабжения. Согласуем объём и смету до начала работ.",
      services: [
        { name: "Вызов мастера", price: "от 1 500 ₽", category: "Диагностика", features: ["Бесплатно при заказе", "Консультация"] },
        { name: "Смесители", price: "от 1 200 ₽", category: "Монтаж и ремонт", features: ["Установка", "Замена деталей"] },
        { name: "Раковины и мойки", price: "от 1 500 ₽", category: "Установка и замена", features: ["Раковины", "Кухонные мойки"] },
      ],
    },
    business: {
      heroEyebrow: "Сантехника для бизнеса",
      heroTitle: "Сантехника для вашего <span>объекта</span>",
      heroText: "Офисы, магазины, кафе и другие коммерческие объекты. Оценим задачу и согласуем этапы работ.",
      services: [
        { name: "Выезд и диагностика", price: "от 1 500 ₽", category: "Коммерческие объекты", features: ["Осмотр", "Составление сметы"] },
        { name: "Смесители", price: "от 500 ₽", category: "Монтаж и обслуживание", features: ["Обычные", "Электронные"] },
        { name: "Мойки и раковины", price: "от 1 200 ₽", category: "Установка и замена", features: ["Нержавеющая сталь", "Искусственный камень"] },
      ],
    },
  },
  {
    slug: "potolki",
    sectionName: "потолочные работы",
    workName: "работы с натяжными потолками",
    heroFile: "master-potolochnik-tomsk.png",
    heroVersion: 2,
    heroWidth: 487,
    heroHeight: 1426,
    heroAlt: "Мастер по монтажу натяжных потолков",
    teamRole2: "Монтажник потолков",
    teamRole3: "Мастер отделки",
    teamSkill1: "Точная разметка",
    teamSkill2: "Сложные помещения",
    teamSkill3: "Монтаж потолков",
    teamSkill4: "Освещение и закладные",
    teamSkill5: "Подготовка основания",
    teamSkill6: "Ремонт после протечек",
    consumer: {
      heroEyebrow: "Потолочные работы в Томске",
      heroTitle: "Потолочные работы<br /><span>в Томске</span>",
      heroText: "Монтаж и замена натяжных потолков в квартирах и домах. Согласуем материал, освещение и стоимость до начала работ.",
      services: [
        { name: "Натяжные потолки", price: "от 500 ₽/м²", category: "Монтаж", features: ["Матовые", "Сатиновые"] },
        { name: "Тканевые потолки", price: "от 1 000 ₽/м²", category: "Монтаж", features: ["Бесшовные", "Без нагрева"] },
        { name: "Демонтаж потолков", price: "от 100 ₽/м²", category: "Подготовка", features: ["Armstrong", "Подвесные системы"] },
      ],
    },
    business: {
      heroEyebrow: "Потолочные работы для бизнеса",
      heroTitle: "Потолки для вашего <span>объекта</span>",
      heroText: "Офисы, магазины и другие коммерческие помещения. Уточним площадь, схему освещения, сроки и требования к отделке.",
      services: [
        { name: "Потолки Armstrong", price: "от 75 ₽/м²", category: "Демонтаж", features: ["Обычные панели", "Зеркальные панели"] },
        { name: "Подвесные потолки", price: "от 90 ₽/м²", category: "Коммерческие помещения", features: ["Разбор конструкции", "Подготовка объекта"] },
        { name: "Реечные потолки", price: "от 75 ₽/м²", category: "Демонтаж", features: ["Разборка реек", "Снятие креплений"] },
      ],
    },
  },
  {
    slug: "plitochniki",
    sectionName: "плиточные работы",
    workName: "плиточные работы",
    heroFile: "plitochnik-tomsk.png",
    heroWidth: 487,
    heroHeight: 1426,
    heroAlt: "Мастер по плиточным работам",
    teamRole2: "Мастер-плиточник",
    teamRole3: "Мастер отделки",
    teamSkill1: "Точная раскладка",
    teamSkill2: "Керамогранит",
    teamSkill3: "Ванные и кухни",
    teamSkill4: "Подрезка и углы",
    teamSkill5: "Подготовка основания",
    teamSkill6: "Затирка швов",
    consumer: {
      heroEyebrow: "Плиточные работы в Томске",
      heroTitle: "Укладка плитки<br /><span>в Томске</span>",
      heroText: "Ванные, кухни, полы и стены. Подготовим основание, согласуем раскладку и аккуратно выполним отделку.",
      services: [
        { name: "Укладка плитки", price: "от 1 100 ₽/м²", category: "Стены и полы", features: ["Точная раскладка", "Ровные швы"] },
        { name: "Керамогранит", price: "от 1 300 ₽/м²", category: "Полы и стены", features: ["Подрезка", "Укладка по уровню"] },
        { name: "Подготовка", price: "от 500 ₽/м²", category: "Основание", features: ["Штукатурка", "Гидроизоляция"] },
      ],
    },
    business: {
      heroEyebrow: "Плиточные работы для бизнеса",
      heroTitle: "Плитка для вашего <span>объекта</span>",
      heroText: "Магазины, кафе, офисы и другие коммерческие помещения. Уточним объём, сроки и требования к отделке.",
      services: [
        { name: "Коммерческие полы", price: "от 1 150 ₽/м²", category: "Керамогранит", features: ["Большие площади", "Укладка по уровню"] },
        { name: "Отделка стен", price: "от 700 ₽/м²", category: "Интерьеры", features: ["Точная раскладка", "Подрезка углов"] },
        { name: "Крупный формат", price: "от 1 500 ₽/м²", category: "Плитка и керамогранит", features: ["Точная подрезка", "Ровные примыкания"] },
      ],
    },
  },
];

const tradeReviews = {
  santehnika: {
    consumer: {
      eyebrow: "Отзывы о сантехнических работах",
      title: "Нас рекомендуют",
      copy: "Клиенты отмечают аккуратный монтаж, понятную смету и чистоту после работ.",
      items: [
        { name: "Наталья", meta: "Ванная комната", text: "Полностью переделали разводку воды и канализации. Все выводы получились точно по проекту, после монтажа всё проверили." },
        { name: "Игорь", meta: "Квартира", text: "Установили инсталляцию и подготовили подключения. Работу закончили в согласованный день." },
        { name: "Светлана", meta: "Частный дом", text: "Быстро нашли протечку, объяснили причину и сразу предложили понятное решение." },
      ],
    },
    business: {
      eyebrow: "Отзывы бизнеса",
      title: "Надёжно работаем с объектами",
      copy: "Соблюдаем этапы, держим связь и учитываем требования эксплуатации.",
      items: [
        { name: "Александр", meta: "Кафе", text: "Развели воду и канализацию для кухни без задержек для других подрядчиков. Все точки приняли с первого раза." },
        { name: "Ольга", meta: "Офис", text: "Заменили проблемный узел и провели испытание системы. По смете без неожиданных доплат." },
        { name: "Сергей", meta: "Магазин", text: "Работы выполнили поэтапно и оставили удобный доступ ко всей арматуре." },
      ],
    },
  },
  potolki: {
    consumer: {
      eyebrow: "Отзывы о потолках",
      title: "Аккуратный результат",
      copy: "Согласуем полотно, освещение и детали монтажа до начала работ.",
      items: [
        { name: "Марина", meta: "Гостиная", text: "Заменили потолок после трещин. Получилось ровно, светильники установили на прежние места." },
        { name: "Антон", meta: "Квартира", text: "После протечки быстро демонтировали старое полотно и поставили новое без лишней грязи." },
        { name: "Елена", meta: "Спальня", text: "Заранее рассчитали стоимость и помогли выбрать освещение. Результатом довольны." },
      ],
    },
    business: {
      eyebrow: "Отзывы бизнеса",
      title: "Потолки для рабочих помещений",
      copy: "Работаем по согласованному графику и учитываем инженерные линии объекта.",
      items: [
        { name: "Виктор", meta: "Офис", text: "Смонтировали потолок и линейное освещение по готовой схеме. Рабочий график офиса не сорвали." },
        { name: "Дарья", meta: "Салон", text: "Все размеры и свет заранее согласовали. Монтаж прошёл быстро и аккуратно." },
        { name: "Михаил", meta: "Торговое помещение", text: "Большую площадь закрыли по этапам, результат приняли без замечаний." },
      ],
    },
  },
  plitochniki: {
    consumer: {
      eyebrow: "Отзывы о плиточных работах",
      title: "Ровно и аккуратно",
      copy: "Продумываем раскладку, подрезку и примыкания до начала укладки.",
      items: [
        { name: "Алексей", meta: "Ванная комната", text: "Помогли подобрать раскладку и аккуратно сделали углы. Швы ровные, всё выглядит цельно." },
        { name: "Ирина", meta: "Кухня", text: "Выложили фартук точно по разметке, розетки и примыкания получились аккуратными." },
        { name: "Павел", meta: "Прихожая", text: "Подготовили основание и уложили керамогранит без перепадов между плитками." },
      ],
    },
    business: {
      eyebrow: "Отзывы бизнеса",
      title: "Отделка коммерческих помещений",
      copy: "Согласуем раскладку и ведём работы по зонам, чтобы не задерживать объект.",
      items: [
        { name: "Роман", meta: "Кафе", text: "Плитку в гостевой зоне уложили по дизайн-проекту. Геометрию и сроки выдержали." },
        { name: "Анна", meta: "Магазин", text: "Работали по зонам и не мешали монтажу оборудования. Пол приняли без замечаний." },
        { name: "Дмитрий", meta: "Офис", text: "Заранее рассчитали материал и подрезку, поэтому в процессе не было простоев." },
      ],
    },
  },
};

const homeReviews = {
  consumer: {
    eyebrow: "Отзывы",
    title: "Нас рекомендуют",
    copy: "Клиенты ценят понятную смету, аккуратную работу и соблюдение договорённостей.",
    items: [
      { name: "Андрей", meta: "Частный дом", text: "Работы разбили на понятные этапы. По ходу ремонта всегда было ясно, что уже сделано и что будет дальше." },
      { name: "Елена", meta: "Квартира", text: "Понравилось, что все мастера работали как одна команда. После себя всё убрали." },
      { name: "Мария", meta: "Ванная комната", text: "Заранее согласовали раскладку, сантехнику и сроки. Результат получился аккуратным." },
    ],
  },
  business: {
    eyebrow: "Отзывы бизнеса",
    title: "Ценим рабочие отношения",
    copy: "Для бизнеса важны сроки, понятная коммуникация и предсказуемый результат.",
    items: [
      { name: "Александр", meta: "Торговое помещение", text: "Согласовали этапы и выполнили инженерные и отделочные работы без лишних простоев. По стоимости всё совпало со сметой." },
      { name: "Ольга", meta: "Офис", text: "Работы вели поэтапно, всегда было понятно, когда какая зона будет готова." },
      { name: "Сергей", meta: "Кафе", text: "Одна команда закрыла электрику, сантехнику и отделку. Не пришлось координировать разных подрядчиков." },
    ],
  },
};

async function build() {
  const generatedPageUrls = [];
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
  const apiBase = process.env.TOK_API_BASE ?? "http://localhost:8787/api";
  const [layout, headerTemplate, footerTemplate, leadTemplate, cardTemplate, reviewsTemplate, tradeHomeTemplate, tradeWorksTemplate, tradePricesTemplate, homeTemplate, homeWorksTemplate] =
    await Promise.all([
      read("layouts/base.html"),
      read("components/header/header.html"),
      read("components/footer/footer.html"),
      read("components/lead-form/lead-form.html"),
      read("components/service-card/service-card.html"),
      read("components/reviews/reviews.html"),
      read("pages/trade/home.html"),
      read("pages/trade/works.html"),
      read("pages/trade/prices.html"),
      read("pages/home/index.html"),
      read("pages/home/works.html"),
    ]);
  const [company, services, electricalPrices, electricalConsumerProjects, electricalBusinessProjects] = await Promise.all([
    readJson("data/company.json"),
    readJson("data/services.json"),
    readJson("data/prices.json"),
    readJson("data/elektrika/projects-consumer.json"),
    readJson("data/elektrika/projects-business.json"),
  ]);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await cp(join(sourceRoot, "assets", "elektrika"), join(outputRoot, "elektrika", "assets"), {
    recursive: true,
  });
  const [cssBundle, mainBundle, catalogBundle] = await Promise.all([
    bundleCss(join(sourceRoot, "styles", "main.css")),
    bundleJavaScript(join(sourceRoot, "scripts", "main.js")),
    bundleJavaScript(join(sourceRoot, "scripts", "catalog.js")),
  ]);
  await mkdir(join(outputRoot, "elektrika", "assets", "css"), { recursive: true });
  await mkdir(join(outputRoot, "elektrika", "assets", "js"), { recursive: true });
  await Promise.all([
    writeFile(join(outputRoot, "elektrika", "assets", "css", "main.css"), cssBundle),
    writeFile(join(outputRoot, "elektrika", "assets", "js", "main.js"), mainBundle),
    writeFile(join(outputRoot, "elektrika", "assets", "js", "catalog.js"), catalogBundle),
  ]);
  await mkdir(join(outputRoot, "elektrika", "data"), { recursive: true });
  await Promise.all([
    cp(join(sourceRoot, "data", "prices.json"), join(outputRoot, "elektrika", "data", "prices.json")),
    cp(join(sourceRoot, "data", "elektrika", "projects-consumer.json"), join(outputRoot, "elektrika", "data", "projects-consumer.json")),
    cp(join(sourceRoot, "data", "elektrika", "projects-business.json"), join(outputRoot, "elektrika", "data", "projects-business.json")),
  ]);

  for (const page of pages) {
    const electricalProjects = page.audience === "business"
      ? electricalBusinessProjects
      : electricalConsumerProjects;
    const audienceData = company.audiences[page.audience];
    const routeBase = `/elektrika/${page.pagePath}`;
    const audienceContext = {
      ...company,
      homeUrl: page.audience === "business" ? "/elektrika/business/" : "/elektrika/",
      mainHomeUrl: page.audience === "business" ? "/business/" : "/",
      consumerUrl: page.consumerUrl || "/elektrika/",
      businessUrl: page.businessUrl || "/elektrika/business/",
      audienceSwitchUrl: page.audience === "business"
        ? (page.consumerUrl || "/elektrika/")
        : (page.businessUrl || "/elektrika/business/"),
      audienceSwitchLabel: page.audience === "business" ? "Для частных лиц" : "Для бизнеса",
      audienceSwitchTarget: page.audience === "business" ? "consumer" : "business",
      consumerActive: page.audience === "consumer" ? "is-active" : "",
      businessActive: page.audience === "business" ? "is-active" : "",
      consumerCurrent: page.audience === "consumer" ? ' aria-current="page"' : "",
      businessCurrent: page.audience === "business" ? ' aria-current="page"' : "",
      footerText: audienceData.footerText,
    };
    const leadContext = {
      audience: page.audience,
      sourcePage: page.sourcePage,
      leadEyebrow: audienceData.lead.eyebrow,
      leadTitle: audienceData.lead.title,
      leadCopy: audienceData.lead.copy,
      leadButton: audienceData.lead.button,
      leadFields: renderLeadFields(page.audience),
      contactCardClass: `${page.audience === "business" ? "business-contact-card" : ""}${page.catalog ? " subpage-contact-card" : ""}`.trim(),
      formClass: `${page.audience === "business" ? "business-form" : ""}${page.catalog ? " subpage-lead-form" : ""}`.trim(),
      formAttributes: page.catalog
        ? 'data-api-form="true"'
        : `data-audience="${page.audience}"`,
      wideClass: page.audience === "business" ? "field-wide" : "",
      turnstileSiteKey,
    };
    const reviews = audienceData.reviews;
    const content = render(await read(page.source), {
      leadForm: render(leadTemplate, leadContext),
      serviceCards: renderServiceSection(services[page.audience], cardTemplate),
      projectItems: renderProjectItems(electricalProjects),
      featuredWorks: renderFeaturedWorks(
        electricalProjects.filter((project) => project.featured),
        page.audience === "business" ? "/elektrika/business/works/" : "/elektrika/works/",
      ),
      priceItems: renderPriceItems(electricalPrices),
      reviews: render(reviewsTemplate, {
        reviewsEyebrow: reviews.eyebrow,
        reviewsTitle: reviews.title,
        reviewsCopy: reviews.copy,
        reviewItems: renderReviewItems(reviews.items),
      }),
    });
    const html = render(layout, {
      title: page.title,
      description: page.description,
      canonicalPath: outputToUrl(page.output),
      bodyClass: page.bodyClass,
      bodyData: page.bodyData || "",
      assetBase: "/elektrika/assets",
      phoneHref: company.phoneHref,
      header: render(headerTemplate, audienceContext),
      content,
      footer: render(footerTemplate, audienceContext),
      scripts: [
        '<script src="/elektrika/assets/js/main.js?v=6"></script>',
        page.catalog
          ? '<script src="/elektrika/assets/js/catalog.js?v=5"></script>'
          : "",
      ].join("\n    "),
    });
    const destination = join(outputRoot, page.output);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, `${prefixRootAttributes(html).trim()}\n`);
    generatedPageUrls.push(outputToUrl(page.output));
  }

  for (const section of tradeSections) {
    const sectionRoot = join(outputRoot, section.slug);
    await cp(join(sourceRoot, "assets", section.slug), join(sectionRoot, "assets"), {
      recursive: true,
    });
    await mkdir(join(sectionRoot, "data"), { recursive: true });

    for (const audience of ["consumer"]) {
      const catalogData = {};
      for (const dataKind of ["prices", "projects"]) {
        catalogData[dataKind] = await readJson(
          `data/${section.slug}/${dataKind}-${audience}.json`,
        );
        await cp(
          join(sourceRoot, "data", section.slug, `${dataKind}-${audience}.json`),
          join(sectionRoot, "data", `${dataKind}-${audience}.json`),
        );
      }

      const audienceData = company.audiences[audience];
      const isBusiness = audience === "business";
      const homeUrl = `/${section.slug}/${isBusiness ? "business/" : ""}`;
      const pageDefinitions = [
        { kind: "home", output: `${isBusiness ? "business/" : ""}index.html`, template: tradeHomeTemplate },
        { kind: "works", output: `${isBusiness ? "business/" : ""}works/index.html`, template: tradeWorksTemplate },
        { kind: "prices", output: `${isBusiness ? "business/" : ""}prices/index.html`, template: tradePricesTemplate },
      ];

      for (const page of pageDefinitions) {
        const isCatalog = page.kind !== "home";
        const routeSuffix = page.kind === "home" ? "" : `${page.kind}/`;
        const consumerUrl = `/${section.slug}/${routeSuffix}`;
        const businessUrl = "/business/";
        const worksUrl = `/${section.slug}/${isBusiness ? "business/" : ""}works/`;
        const pricesUrl = `/${section.slug}/${isBusiness ? "business/" : ""}prices/`;
        const trade = section[audience];
        const reviewData = tradeReviews[section.slug][audience];
        const headerContext = {
          ...company,
          sectionName: section.sectionName,
          homeUrl,
          mainHomeUrl: isBusiness ? "/business/" : "/",
          consumerUrl,
          businessUrl,
          audienceSwitchUrl: businessUrl,
          audienceSwitchLabel: isBusiness ? "Для частных лиц" : "Для бизнеса",
          audienceSwitchTarget: isBusiness ? "consumer" : "business",
          consumerActive: audience === "consumer" ? "is-active" : "",
          businessActive: audience === "business" ? "is-active" : "",
          consumerCurrent: audience === "consumer" ? ' aria-current="page"' : "",
          businessCurrent: audience === "business" ? ' aria-current="page"' : "",
          footerText: isBusiness
            ? `${section.sectionName} для бизнеса · ${company.region}`
            : `${company.region} · ${company.hours}`,
        };
        const leadContext = {
          audience,
          sourcePage: `${section.slug}-${page.kind}`,
          leadEyebrow: audienceData.lead.eyebrow,
          leadTitle: audienceData.lead.title,
          leadCopy: audienceData.lead.copy,
          leadButton: audienceData.lead.button,
          leadFields: renderLeadFields(audience),
          contactCardClass: `${isBusiness ? "business-contact-card" : ""}${isCatalog ? " subpage-contact-card" : ""}`.trim(),
          formClass: `${isBusiness ? "business-form" : ""}${isCatalog ? " subpage-lead-form" : ""}`.trim(),
          formAttributes: isCatalog ? 'data-api-form="true"' : `data-audience="${audience}"`,
          wideClass: isBusiness ? "field-wide" : "",
          turnstileSiteKey,
        };
        const dataUrl = `/${section.slug}/data/${page.kind === "works" ? "projects" : "prices"}-${audience}.json`;
        const pageContent = render(page.template, {
          ...trade,
          teamRole2: section.teamRole2,
          teamRole3: section.teamRole3,
          teamSkill1: section.teamSkill1,
          teamSkill2: section.teamSkill2,
          teamSkill3: section.teamSkill3,
          teamSkill4: section.teamSkill4,
          teamSkill5: section.teamSkill5,
          teamSkill6: section.teamSkill6,
          workName: section.workName,
          homeUrl,
          worksUrl,
          pricesUrl,
          primaryHref: isBusiness ? "#contact" : company.phoneHref,
          primaryLabel: isBusiness ? "Рассчитать заказ" : "Позвонить мастеру",
          heroImage: `/${section.slug}/assets/images/${section.heroFile}?v=${section.heroVersion || 1}`,
          heroWidth: section.heroWidth,
          heroHeight: section.heroHeight,
          heroAlt: section.heroAlt,
          heroBadge: isBusiness ? company.region : "Работаем ежедневно",
          dataUrl,
          projectItems: renderProjectItems(catalogData.projects),
          serviceCards: renderServiceSection(trade.services, cardTemplate),
          featuredWorks: renderFeaturedWorks(
            catalogData.projects.filter((project) => project.featured),
            worksUrl,
          ),
          priceItems: renderPriceItems(catalogData.prices),
          pricePreview: renderPricePreview(catalogData.prices, pricesUrl),
          reviews: render(reviewsTemplate, {
            reviewsEyebrow: reviewData.eyebrow,
            reviewsTitle: reviewData.title,
            reviewsCopy: reviewData.copy,
            reviewItems: renderReviewItems(reviewData.items),
          }),
          leadForm: render(leadTemplate, leadContext),
        });
        const pageLabel = page.kind === "works" ? "Примеры работ" : page.kind === "prices" ? "Цены" : "Услуги";
        const html = render(layout, {
          title: `${pageLabel}: ${section.sectionName} в Томске — ${company.brand}`,
          description: `${section.sectionName} в Томске для ${isBusiness ? "бизнеса" : "частных клиентов"}.`,
          canonicalPath: outputToUrl(`${section.slug}/${page.output}`),
          bodyClass: `trade-page ${isCatalog ? `subpage ${page.kind === "works" ? "projects-page" : "prices-page"} ` : ""}${isBusiness ? "business-page" : "consumer-page"}`,
          bodyData: ` data-audience="${audience}" data-section-base="/${section.slug}"${isCatalog ? ` data-subpage="${page.kind}"` : ""}`,
          assetBase: "/elektrika/assets",
          phoneHref: company.phoneHref,
          header: render(headerTemplate, headerContext),
          content: pageContent,
          footer: render(footerTemplate, headerContext),
          scripts: [
            '<script src="/elektrika/assets/js/main.js?v=6"></script>',
            isCatalog ? '<script src="/elektrika/assets/js/catalog.js?v=5"></script>' : "",
          ].join("\n    "),
        });
        const destination = join(sectionRoot, page.output);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, `${prefixRootAttributes(html).trim()}\n`);
        generatedPageUrls.push(outputToUrl(`${section.slug}/${page.output}`));
      }
    }
  }

  await cp(join(sourceRoot, "assets", "home"), join(outputRoot, "assets"), {
    recursive: true,
  });
  await mkdir(join(outputRoot, "data"), { recursive: true });

  const homeProjectsByAudience = {};
  for (const audience of ["consumer", "business"]) {
    const [plumbingProjects, ceilingProjects, tilingProjects] = await Promise.all([
      readJson("data/santehnika/projects-consumer.json"),
      readJson("data/potolki/projects-consumer.json"),
      readJson("data/plitochniki/projects-consumer.json"),
    ]);
    const electricalProjects = audience === "business"
      ? electricalBusinessProjects
      : electricalConsumerProjects;
    const projectGroups = [
      ["Электрика", electricalProjects],
      ["Сантехника", plumbingProjects],
      ["Потолки", ceilingProjects],
      ["Плиточные работы", tilingProjects],
    ];

    homeProjectsByAudience[audience] = projectGroups.flatMap(([direction, projects]) =>
      projects
        .filter((project) => project.featured)
        .map((project) => ({
          ...project,
          type: `${direction} · ${project.type}`,
        })),
    );

    await writeFile(
      join(outputRoot, "data", `projects-${audience}.json`),
      `${JSON.stringify(homeProjectsByAudience[audience], null, 2)}\n`,
    );
  }

  const homePages = [
    {
      audience: "consumer",
      output: "index.html",
      heroEyebrow: "Ремонт под ключ в Томске",
      heroTitle: "Ремонт под ключ<br /><span>в Томске</span>",
      heroText: "Электрика, сантехника, потолочные и плиточные работы одной командой. Согласуем этапы, смету и сроки до начала работ.",
      primaryHref: company.phoneHref,
      primaryLabel: "Позвонить мастеру",
      heroBadge: "Работаем ежедневно",
      factOneValue: "10+ лет",
      factOneLabel: "опыта в ремонте",
      factTwoValue: "1 год",
      factTwoLabel: "гарантии на работы",
      factThreeValue: "4 направления",
      factThreeLabel: "в одной команде",
      footerText: `${company.region} · ${company.hours}`,
    },
    {
      audience: "business",
      output: "business/index.html",
      heroEyebrow: "Ремонт для бизнеса в Томске",
      heroTitle: "Ремонт коммерческих<br /><span>помещений</span>",
      heroText: "Офисы, магазины, кафе и другие объекты. Одна команда для инженерных систем и отделочных работ.",
      primaryHref: "#contact",
      primaryLabel: "Рассчитать заказ",
      heroBadge: company.region,
      factOneValue: "одна смета",
      factOneLabel: "на комплекс работ",
      factTwoValue: "по этапам",
      factTwoLabel: "оплата и приёмка",
      factThreeValue: "1 год",
      factThreeLabel: "гарантии на работы",
      footerText: `Ремонт для бизнеса · ${company.region}`,
    },
  ];

  for (const page of homePages) {
    const isBusiness = page.audience === "business";
    const audienceData = company.audiences[page.audience];
    const homeUrl = isBusiness ? "/business/" : "/";
    const headerContext = {
      ...company,
      sectionName: "ремонт под ключ",
      homeUrl,
      mainHomeUrl: homeUrl,
      consumerUrl: "/",
      businessUrl: "/business/",
      audienceSwitchUrl: isBusiness ? "/" : "/business/",
      audienceSwitchLabel: isBusiness ? "Для частных лиц" : "Для бизнеса",
      audienceSwitchTarget: isBusiness ? "consumer" : "business",
      consumerActive: isBusiness ? "" : "is-active",
      businessActive: isBusiness ? "is-active" : "",
      consumerCurrent: isBusiness ? "" : ' aria-current="page"',
      businessCurrent: isBusiness ? ' aria-current="page"' : "",
      sectionNavigation: "",
      footerText: page.footerText,
    };
    const leadContext = {
      audience: page.audience,
      sourcePage: `main-${page.audience}`,
      leadEyebrow: audienceData.lead.eyebrow,
      leadTitle: audienceData.lead.title,
      leadCopy: audienceData.lead.copy,
      leadButton: audienceData.lead.button,
      leadFields: renderLeadFields(page.audience),
      contactCardClass: isBusiness ? "business-contact-card" : "",
      formClass: isBusiness ? "business-form" : "",
      formAttributes: `data-audience="${page.audience}"`,
      wideClass: isBusiness ? "field-wide" : "",
      turnstileSiteKey,
    };
    const reviewData = homeReviews[page.audience];
    const homeProjects = homeProjectsByAudience[page.audience];
    const content = render(homeTemplate, {
      ...page,
      electricUrl: isBusiness ? "/elektrika/business/" : "/elektrika/",
      plumbingUrl: "/santehnika/",
      ceilingUrl: "/potolki/",
      tilingUrl: "/plitochniki/",
      worksUrl: isBusiness ? "/business/works/" : "/works/",
      featuredWorks: renderFeaturedWorks(
        homeProjects,
        isBusiness ? "/business/works/" : "/works/",
      ),
      reviews: render(reviewsTemplate, {
        reviewsEyebrow: reviewData.eyebrow,
        reviewsTitle: reviewData.title,
        reviewsCopy: reviewData.copy,
        reviewItems: renderReviewItems(reviewData.items),
      }),
      leadForm: render(leadTemplate, leadContext),
    });
    const html = render(layout, {
      title: isBusiness ? "Ремонт для бизнеса в Томске — ТОК" : "Ремонт под ключ в Томске — ТОК",
      description: isBusiness
        ? "Комплексный ремонт офисов, магазинов и коммерческих помещений в Томске: электрика, сантехника и отделка."
        : "Ремонт под ключ в Томске: электрика, сантехника, потолочные и плиточные работы одной командой.",
      canonicalPath: outputToUrl(page.output),
      bodyClass: `home-page ${isBusiness ? "business-page" : "consumer-page"}`,
      bodyData: ` data-audience="${page.audience}" data-section-base=""`,
      assetBase: "/elektrika/assets",
      phoneHref: company.phoneHref,
      header: render(headerTemplate, headerContext),
      content,
      footer: render(footerTemplate, headerContext),
      scripts: '<script src="/elektrika/assets/js/main.js?v=6"></script>',
    });
    const destination = join(outputRoot, page.output);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, `${prefixRootAttributes(html).trim()}\n`);
    generatedPageUrls.push(outputToUrl(page.output));
  }

  for (const page of homePages) {
    const isBusiness = page.audience === "business";
    const audienceData = company.audiences[page.audience];
    const homeUrl = isBusiness ? "/business/" : "/";
    const output = isBusiness ? "business/works/index.html" : "works/index.html";
    const headerContext = {
      ...company,
      sectionName: "ремонт под ключ",
      homeUrl,
      mainHomeUrl: homeUrl,
      consumerUrl: "/works/",
      businessUrl: "/business/works/",
      audienceSwitchUrl: isBusiness ? "/works/" : "/business/works/",
      audienceSwitchLabel: isBusiness ? "Для частных лиц" : "Для бизнеса",
      audienceSwitchTarget: isBusiness ? "consumer" : "business",
      consumerActive: isBusiness ? "" : "is-active",
      businessActive: isBusiness ? "is-active" : "",
      consumerCurrent: isBusiness ? "" : ' aria-current="page"',
      businessCurrent: isBusiness ? ' aria-current="page"' : "",
      sectionNavigation: "",
      footerText: page.footerText,
    };
    const leadContext = {
      audience: page.audience,
      sourcePage: `main-works-${page.audience}`,
      leadEyebrow: audienceData.lead.eyebrow,
      leadTitle: audienceData.lead.title,
      leadCopy: audienceData.lead.copy,
      leadButton: audienceData.lead.button,
      leadFields: renderLeadFields(page.audience),
      contactCardClass: `${isBusiness ? "business-contact-card " : ""}subpage-contact-card`,
      formClass: `${isBusiness ? "business-form " : ""}subpage-lead-form`,
      formAttributes: 'data-api-form="true"',
      wideClass: isBusiness ? "field-wide" : "",
      turnstileSiteKey,
    };
    const homeProjects = homeProjectsByAudience[page.audience];
    const content = render(homeWorksTemplate, {
      homeUrl,
      dataUrl: `/data/projects-${page.audience}.json`,
      projectItems: renderProjectItems(homeProjects),
      leadForm: render(leadTemplate, leadContext),
    });
    const html = render(layout, {
      title: `Комплексные работы в Томске — ${company.brand}`,
      description: `Примеры комплексного ремонта ${isBusiness ? "коммерческих помещений" : "домов и квартир"} в Томске.`,
      canonicalPath: outputToUrl(output),
      bodyClass: `home-works-page subpage projects-page ${isBusiness ? "business-page" : "consumer-page"}`,
      bodyData: ` data-audience="${page.audience}" data-section-base="" data-subpage="main-works"`,
      assetBase: "/elektrika/assets",
      phoneHref: company.phoneHref,
      header: render(headerTemplate, headerContext),
      content,
      footer: render(footerTemplate, headerContext),
      scripts: '<script src="/elektrika/assets/js/main.js?v=6"></script>\n    <script src="/elektrika/assets/js/catalog.js?v=6"></script>',
    });
    const destination = join(outputRoot, output);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, `${prefixRootAttributes(html).trim()}\n`);
    generatedPageUrls.push(outputToUrl(output));
  }

  const siteUrl = (process.env.SITE_URL || "http://localhost:8000").replace(/\/$/, "");
  const sitemapEntries = generatedPageUrls
    .map((url) => `  <url><loc>${escapeHtml(`${siteUrl}${url}`)}</loc></url>`)
    .join("\n");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>\n`;
  const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
  await Promise.all([
    writeFile(join(outputRoot, "sitemap.xml"), sitemap),
    writeFile(join(outputRoot, "robots.txt"), robots),
    writeFile(
      join(outputRoot, "config.js"),
      `window.TOK_API_BASE = ${JSON.stringify(apiBase)};\nwindow.TOK_TURNSTILE_SITE_KEY = ${JSON.stringify(turnstileSiteKey)};\nwindow.TOK_BASE_PATH = ${JSON.stringify(basePath)};\n`,
    ),
    writeFile(join(outputRoot, ".nojekyll"), ""),
  ]);
  console.log(`Built ${generatedPageUrls.length} pages into ${outputRoot}`);
  if (!process.env.SITE_URL) {
    console.warn("SITE_URL is not set; sitemap.xml uses http://localhost:8000 for local development.");
  }
}

await build();
