# Сайт компании

Исходники сайта хранятся в `src`, а готовая статическая версия собирается в
`dist`. Подключены четыре раздела: электрика, сантехника, потолочные и плиточные работы.

## Структура

```text
src/
├── layouts/
│   └── base.html              # общий HTML-каркас страницы
├── components/
│   ├── header/
│   │   ├── header.html
│   │   ├── header.css
│   │   └── header.js
│   ├── footer/
│   │   ├── footer.html
│   │   └── footer.css
│   ├── lead-form/
│   │   ├── lead-form.html
│   │   ├── lead-form.css
│   │   └── lead-form.js
│   ├── service-card/          # HTML и CSS карточки услуги
│   ├── reviews/               # HTML и CSS отзывов
│   ├── carousel/              # CSS и поведение карусели
│   ├── project-catalog/       # CSS и JS каталога работ
│   └── price-catalog/         # CSS и JS каталога цен
├── styles/
│   ├── base.css               # токены, reset и базовая типографика
│   ├── main.css               # порядок подключения компонентов
│   ├── pages/                 # страничные переопределения
│   └── responsive/            # общие breakpoint-правила
├── scripts/
│   ├── main.js                # манифест основного JS-бандла
│   └── catalog.js             # манифест JS-бандла каталогов
├── data/
│   ├── company.json           # бренд, телефон, тексты вариантов и отзывы
│   ├── services.json          # услуги частным клиентам и бизнесу
│   ├── prices.json            # полный прайс
│   ├── elektrika/             # объекты электрики по аудиториям
│   ├── santehnika/            # объекты сантехники по аудиториям
│   ├── potolki/               # объекты потолков по аудиториям
│   └── plitochniki/            # объекты плиточных работ по аудиториям
├── assets/
│   └── elektrika/images/      # исходные изображения направления
└── pages/
    └── elektrika/
        ├── index.html         # частным клиентам
        ├── business/index.html
        ├── works/index.html
        └── prices/index.html
```

CSS и JavaScript компонентов хранятся рядом с их HTML. Во время `npm run build`
сборщик объединяет CSS в `dist/elektrika/assets/css/main.css`, а JavaScript — в
`main.js` и `catalog.js`. Поэтому исходники остаются компонентными, но браузер
получает только три оптимальных файла.

Сантехника доступна по адресу `/santehnika/`, потолочные работы — `/potolki/`, плиточные работы — `/plitochniki/`.
У каждого раздела есть отдельные consumer/business-страницы цен и работ.

## Команды

```bash
npm run build
npm run dev
```

Для публикационной сборки передайте основной адрес сайта. Он будет использован
в `sitemap.xml` и `robots.txt`:

```bash
SITE_URL=https://ваш-домен.ru npm run build
```

Без `SITE_URL` сборка использует `http://localhost:8000`, что подходит только
для локальной разработки. Canonical-ссылки остаются относительными и начнут
корректно работать на выбранном домене автоматически.

Формы отправляются в единый Cloudflare Worker API из соседней папки
`../backend`. Для production-сборки также укажите адрес API и публичный ключ
Turnstile:

```bash
TOK_API_BASE=https://api.ваш-домен.ru/api \
TURNSTILE_SITE_KEY=PUBLIC_SITE_KEY \
SITE_URL=https://ваш-домен.ru \
npm run build
```

Без этих переменных локальная сборка использует Worker на порту `8787` и
официальный тестовый ключ Turnstile. Тестовые ключи нельзя использовать в
production.

- `npm run build` пересобирает 28 страниц в `dist/`.
- `npm run dev` собирает проект и запускает локальный сервер на порту 8000.
- На хостинг нужно загружать содержимое папки `dist`.

## Варианты компонентов

Сборщик создаёт две версии общих компонентов:

- `consumer` — короткая форма с телефоном;
- `business` — телефон, компания, тип объекта и описание задачи.

Во всех направлениях для частных клиентов и бизнеса используются отдельные
физические адреса, включая страницы цен и выполненных работ.

## Как добавить цены и работы

JSON-файлы разделов находятся в `src/data/santehnika/`, `src/data/potolki/` и `src/data/plitochniki/`.
Файлы `consumer` относятся к частным клиентам, `business` — к бизнесу.

Фотографии работ нужно класть в соответствующую папку внутри `src/assets/`.
При сборке вся папка направления автоматически попадает в `dist`.
Формат записей такой же, как в `src/data/elektrika/projects-consumer.json` и `src/data/prices.json`.
