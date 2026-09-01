# Backend заявок ТОК

Cloudflare Worker принимает обе формы через единый `POST /api/leads`, проверяет
данные, Turnstile и лимиты, затем помещает заявку в Cloudflare Queue. Consumer
отправляет уведомления в Telegram и на email.

## Типы заявок

- `consumer`: обязательны ФИО, телефон и согласие.
- `business`: обязательны телефон, описание задачи и согласие; компания и тип
  объекта передаются отдельными полями.

## Локальная настройка

```bash
npm install
cp .dev.vars.example .dev.vars
npm test
npm run dev
```

Публичные настройки находятся в `wrangler.jsonc`. Настоящие секреты нельзя
записывать в этот файл или отправлять во frontend.

## Что заполнить в wrangler.jsonc

- `ALLOWED_ORIGINS`: домены сайта через запятую.
- `TURNSTILE_EXPECTED_HOSTNAME`: production-домен без протокола.
- `TELEGRAM_CHAT_ID`: ID пользователя, группы или канала.
- `EMAIL_FROM`: адрес на домене, подключённом к Cloudflare Email Service.
- `EMAIL_TO`: подтверждённый адрес получателя.
- `ENABLE_TELEGRAM` и `ENABLE_EMAIL`: поставить `true` после настройки.
- `LOG_NOTIFICATIONS`: `true` только локально для вывода готового письма в
  консоль; в production должен оставаться `false`, чтобы не логировать ФИО и
  телефоны.

## Production secrets

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put LEAD_HASH_SECRET
```

`LEAD_HASH_SECRET` должен быть случайной строкой не короче 32 байт. Например:

```bash
openssl rand -base64 48
```

## Cloudflare resources

Перед первым deploy создать очередь:

```bash
npx wrangler queues create tok-leads
npx wrangler queues create tok-leads-dead-letter
```

Также необходимо создать Turnstile widget, подтвердить email получателя и
подключить домен отправителя к Cloudflare Email Service.

## Публикация

```bash
npm run deploy
```

После публикации frontend нужно собрать с адресом API и публичным site key:

```bash
TOK_API_BASE=https://api.example.com/api \
TURNSTILE_SITE_KEY=PUBLIC_SITE_KEY \
SITE_URL=https://example.com \
npm run build
```

Настоящий Turnstile secret и Telegram bot token в эту команду не передаются.
