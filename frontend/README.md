# Yesas Engineering frontend

The frontend is a React 19 and TypeScript single-page application built with
Vite 8 and Tailwind CSS 4. Public routes share a responsive layout, and API
contracts and endpoint functions are grouped by company, services and projects.
The API client uses browser `fetch` and the Django public endpoints only.

## Installation

```sh
npm install
```

## Development

Start Django on `http://127.0.0.1:8000`, then run:

```sh
npm run dev
```

Vite proxies `/api/` requests to Django. The default target is
`http://127.0.0.1:8000`. To use another local backend, copy `.env.example` to
`.env.local` and set `API_PROXY_TARGET` to that backend's origin. This setting
is used only by the Vite development server; it is not exposed to browser code.

## Tests and checks

```sh
npm test
npm run lint
npm run build
```

`npm run build` runs the TypeScript project checks and creates the production
bundle in `dist/`. Production API routing is expected to be provided by the
deployment reverse proxy.
