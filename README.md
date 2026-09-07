# IApp

A React chat workspace for Gemini, ChatGPT, and Claude, backed by Python/FastAPI. Provider API keys belong on the backend, never in the browser.

## Features

- Chat and analyze PDF, PNG, JPEG, WEBP, or UTF-8 text/code files. Attach up to four files, 5 MiB each, with a 12 MiB request limit. Export Word as PDF and spreadsheets as CSV.
- Select **Create image** with Gemini or ChatGPT to use its dedicated image model. Images appear in the chat with a download link. Claude supports image analysis, not image generation. Image creation currently accepts text descriptions, not image editing.
- Markdown tables, lists, inline code, and fenced code blocks with copy buttons work in user and assistant messages. Model-generated external image URLs are not automatically loaded.
- Settings control the chat model, privacy, local history, and session-only custom instructions.
- Cancel requests, switch chats safely, retry failed prompts, and receive useful quota/configuration/timeout messages.

## Privacy and context

Privacy mode is **on by default**. Only the current message and its attachments are sent; prior turns and custom instructions are excluded. Private chats stay in memory and disappear when you reload or change privacy mode. Earlier regular chats are not deleted.

With privacy off, recent complete turns and available attachments provide context. Text history can be saved on this device; files and generated images are never serialized to browser storage. After reloading, reattach any files needed for analysis. Download generated images before leaving the session. Generated image pixels are not automatically included in later requests; attach the downloaded image in Chat for visual analysis.

These are application privacy controls, **not a guarantee of zero provider retention**. Provider processing, abuse monitoring, training, and retention depend on the API/account terms. The backend disables optional storage where supported and does not persist files or log prompt contents. See [backend privacy details](backend/README.md#privacy-behavior).

## Run locally

Use a supported Node.js version (22.12+ on the Node 22 line) and Python 3.11+. Install and start the backend using [backend/README.md](backend/README.md), then:

```sh
npm ci
npm run dev
```

Open the displayed `/IApp/` URL. Vite forwards `/api` requests to `http://127.0.0.1:8000`. You do not need frontend provider credentials.

If OneDrive tries to download `gh-pages.cmd` or package files fail to load, close running development processes and run `npm ci` to recreate `node_modules` from the lockfile. For ongoing development, a working copy outside OneDrive avoids syncing dependency files. Do not commit `node_modules`.

## Checks

```sh
npm test
npm run lint
npm run build
```

Backend: install `backend/requirements-dev.txt`, then run `python -m pytest -q` from `backend`. Tests mock provider calls and do not incur API charges. Account access, billing, quotas, and live image generation still need deployment smoke tests.

For local browser QA without provider calls, start `node tests/fixtures/mock-api.mjs` instead of the real backend. Run Vite in development with `VITE_API_BASE_URL=/api/v1`. This test server returns clearly labeled sample text and an existing app image; it does not generate images. Never deploy it.

## Deploy updates

1. Deploy the **complete** backend package first. The separate Render repository needs `app/`, root `main.py`, `requirements.txt`, and Docker files. See the [Render instructions](backend/README.md#deploy-the-updated-backend-to-render).
2. Set `CORS_ORIGINS` on Render to your frontend origin, without a path (for example `https://calvinrbobadillaf.github.io`). Check `/api/v1/health` and `/api/v1/models`.
3. The root `.env.production` contains the public API address: `VITE_API_BASE_URL=https://iapp-iw24.onrender.com/api/v1`. Never put API keys in this file; all `VITE_` values are public.
4. Run `npm run deploy` to build and publish GitHub Pages. The base path is `/IApp/`.
5. Smoke-test a text reply on each configured provider, a file upload, and an image with Gemini and ChatGPT. Verify privacy on/off, history reload, and image download.

The display-name screen is not authentication. Before opening a paid backend to public traffic, add authentication and per-user rate/spending controls. CORS and the current concurrent-request limit alone do not prevent API abuse.
