# Telegram Mini App Frontend (RPG Character Service)

Минимальный, но структурированный фронтенд на React + Vite + TypeScript для текущего backend `rpg-character-service`.

## Что реализовано

- Telegram WebApp инициализация (`window.Telegram.WebApp.ready()` + `expand()`).
- Чтение Telegram user id из `initDataUnsafe.user.id`.
- Локальный fallback-режим (вне Telegram) с ручным вводом test user id.
- API слой на Axios для `characters`, `character sheet` и полного `draft wizard`-флоу.
- Страницы:
  - `/` — список персонажей.
  - `/character/:id` — character sheet.
  - `/create` — draft-based wizard.

## Структура

```text
src/
  api/
  components/
  hooks/
  pages/
  telegram/
  types/
```

## Конфигурация окружения

1. Скопируйте файл `.env.example` в `.env`:

```bash
cp .env.example .env
```

2. Проверьте API URL:

```env
VITE_API_URL=/api
VITE_COMBAT_API_MODE=action
```

`VITE_COMBAT_API_MODE` поддерживает значения (по умолчанию: `action`):
- `action` — использовать только `POST /combat/action` (строгий режим, рекомендуется по умолчанию).
- `auto` — сначала `POST /combat/action`, при инфраструктурной ошибке fallback на legacy endpoint.
- `legacy` — использовать только старые endpoint'ы (быстрый откат без изменения кода).

В `SessionView` для GM отображается чип `API: ACTION|AUTO|LEGACY`, чтобы сразу видеть фактически активный режим в рантайме.

3. В dev-режиме запросы на `/api` автоматически проксируются Vite на backend:

```ts
server: {
  proxy: {
    '/api': 'http://localhost:5000'
  }
}
```

## Локальный запуск

```bash
npm install
npm run dev
```

По умолчанию UI доступен на `http://localhost:5173`.

## Подключение к backend

Перед запуском mini app должен быть поднят backend сервис (`rpg-character-service`) на `http://localhost:5000`.

Нужные backend endpoints:

- `GET /api/characters`
- `GET /api/characters/:id/sheet`
- `POST /api/drafts`
- `GET /api/drafts/:id`
- `POST /api/drafts/:id/class`
- `POST /api/drafts/:id/race`
- `POST /api/drafts/:id/background`
- `POST /api/drafts/:id/ability-scores`
- `POST /api/drafts/:id/choices`
- `POST /api/drafts/:id/finalize`

## Telegram Mini App интеграция

- В `index.html` подключен скрипт:

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

- При запуске в Telegram app автоматически берётся `user.id` из `initDataUnsafe`.
- Все API-запросы автоматически отправляют `x-telegram-init-data` (из `Telegram.WebApp.initData`), чтобы backend мог валидировать подпись.
- При локальной разработке можно ввести test user id на странице персонажей; значение хранится в `localStorage`.

## Wizard flow

1. Ввод имени и создание draft.
2. Выбор класса.
3. Выбор расы (или skip).
4. Выбор background (или skip).
5. Назначение ability scores.
6. Заполнение required choices + finalize.

Кнопка `Finalize Draft` блокируется, пока `missingChoices.length > 0`.
