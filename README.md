# IApp

A React AI hub for Gemini, ChatGPT, Claude, and a live Interpreter tool, backed by one Python/FastAPI service. Shared provider keys stay on the backend. An explicit, temporary bring-your-own Deepgram key option is available for troubleshooting; browser storage is not a secure secret vault.

## Features

- Chat and analyze PDF, PNG, JPEG, WEBP, or UTF-8 text/code files. Attach up to four files, 5 MiB each, with a 12 MiB request limit. Export Word as PDF and spreadsheets as CSV.
- Select **Create image** with Gemini or ChatGPT to use its dedicated image model. Images appear in the chat with a download link. Claude supports image analysis, not image generation. Image creation currently accepts text descriptions, not image editing.
- Markdown tables, lists, inline code, and fenced code blocks with copy buttons work in user and assistant messages. Model-generated external image URLs are not automatically loaded.
- Settings control the chat model, privacy, local history, and session-only custom instructions.
- Cancel requests, switch chats safely, retry failed prompts, and receive useful quota/configuration/timeout messages.
- **Tools → Interpreter** supports English, Spanish, Haitian Kreyòl, French, German, Italian, and Portuguese, with live original/translation columns, subtitles-only mode, a session-only Kreyòl glossary, and retryable translations. Export a transcript or prepare it for review in Chat without sending it automatically.

## Tools → Interpreter

Open **Tools** in the sidebar, then **Open Interpreter**. Choose microphone or browser-tab audio, the speaker type, and translation direction. Stop before changing speech languages. The original app's initial →Kreyòl setting is preserved; choose an explicit target or a different conversation direction if preferred.

Choose **Multilingual speech (Deepgram)** for the six non-Kreyòl languages. **Speech language** can pin a known language instead of automatic detection; this avoids mislabeling monolingual responses that contain no detected-language metadata. **Translate into** sets an explicit target, overriding the older conversation-direction setting. Automatic direction preserves English↔Spanish or →Kreyòl behavior; other languages default to English when →Kreyòl is off. Kreyòl replies use the last non-Kreyòl language unless a target is selected. Portuguese translations use Brazilian Portuguese (`PT-BR`). Pinning a language can reduce detection errors, but accuracy is not guaranteed: verify important names and numbers and use a clear microphone signal.

**Export transcript** saves the current completed segments as a UTF-8 text file. **Review with AI** asks for confirmation and prepares a new draft in your selected Chat provider; review it and press Send yourself. No transcript is automatically sent to an LLM. Existing chats are preserved, and replacing an unsent draft requires confirmation. Drafts are capped at 80,000 transcript characters; export longer conversations for review in sections. Transcripts are not silently truncated for AI review. Explicitly downloaded files and messages you later send to Chat follow those destinations' storage/privacy rules.

**Search with AI** appears below each completed translation. Stop listening, open the action, and choose one complete sentence or the full translation. The preview always shows the entire selected text; you can copy it or add an optional question and choose **Open Chat draft**. Only the selected translation and your question are included—not the original speech, other segments, or credentials. This is an AI explanation/background workflow, not live web browsing. Nothing is sent until you press Send in Chat. Opening Chat asks for confirmation because leaving Interpreter discards its in-memory transcript; cancel and export first if needed. Cancelling either confirmation preserves the transcript and any existing Chat draft. Browsers without sentence segmentation offer the full translation instead of guessing sentence boundaries.

Chat, Tools, Settings, and Interpreter include subtle entry and interaction animations that respect your operating system's reduced-motion preference. Keyboard focus remains visible and the provider colors are unchanged.

Audio starts only after **Start listening** and browser permission. Tab audio requires a supported desktop browser and selecting a browser tab with **Share tab audio** enabled; Electron-only system audio is not included in the website. HTTPS is required outside localhost. If permission, a connection, or the audio source fails, capture is released and the UI reports the failure. Stop/Cancel, leaving the tool, and changing privacy mode also release capture.

Configure the matching keys on the **same backend** used for Chat:

| Operation | Render environment variable |
| --- | --- |
| English/Spanish/French/German/Italian/Portuguese speech (Deepgram) | `DEEPGRAM_API_KEY` |
| Kreyòl speech (Gladia) | `GLADIA_API_KEY` |
| Translation between the six non-Kreyòl languages (DeepL) | `DEEPL_API_KEY` |
| Translation involving Kreyòl (Google Cloud) | `GOOGLE_TRANSLATE_API_KEY` |

Chat provider keys do not enable these services. No keys are needed for unused providers; **Subtitles only** needs speech credentials only. See [backend setup and credential troubleshooting](backend/README.md#deploy-the-updated-backend-to-render). Capability checks confirm that keys are present, not valid or funded.

The original InterpreterAI project is left intact. Its separate login, browser-stored permanent keys, Electron runtime, external translation backend, and local caches are not imported. Both features now use IApp navigation, settings, and the existing Gemini black/blue, ChatGPT purple, and Claude orange/gold themes. Interpreter code loads only when the tool is opened.

Interpreter transcripts and glossary stay in memory only, even with privacy off; leaving the tool clears them. Privacy on excludes the optional custom glossary. By default, audio streams directly to the speech provider using a temporary session, and only completed segments go through IApp to the translation provider. No prior transcript or Chat context is sent with a translation. Subtitles-only mode skips translation calls entirely. Provider retention policies still apply. The latest 300 segments are retained; slow translations are bounded and can be retried instead of accumulating unlimited requests. Export important text before leaving.

### Temporary Deepgram key fallback

In Interpreter, expand **Deepgram credentials**, choose **Temporary local key**, and enter an individually issued Deepgram API key. **Use for session** is the default; the key disappears when the tool is unmounted. To retain it across reloads, explicitly check **Remember key on this device (localStorage)** and save. The field is masked and never prefilled with a saved key. Server mode remains the default every time the tool opens, even when a key is remembered; there is no automatic fallback or legacy `app_key` import.

This bypasses only Deepgram token creation: the key authenticates directly to the fixed Deepgram WebSocket endpoint, never to IApp, a translation provider, a transcript, or a URL query. It works with the six Deepgram speech languages. Kreyòl and translations still need backend credentials. Choose Subtitles only to use direct Deepgram transcription even when Render is unavailable. No backend deployment is required for the fallback itself; expanded server-side languages require API 2.2.0.

Remembered keys are **plaintext localStorage**, accessible to scripts running on this origin and people with access to the browser. Privacy mode controls conversation context, not this explicit credential-storage choice. Use **Remove saved key** or **Clear IApp data** to remove it; storage failures are reported, not silently treated as success. Revocation in Deepgram is separate. Ask the owner for a dedicated, restricted, revocable customer key (transcription usage only), not an owner/admin/shared Render key; set an expiry and account spending limits. Such keys can still incur charges. This is a temporary compatibility option, not production authentication or secure credential distribution.

To check the server key: in [Deepgram Console](https://console.deepgram.com), choose the correct project and open **Settings → API Keys**. Inspect that key's role/scopes, not only your account role. The backend's [temporary-token endpoint](https://developers.deepgram.com/reference/auth/tokens/grant) requires Member or higher. If the existing key's permissions cannot be inspected/changed there, create a separate server key with the required role and keep it exclusively in Render's `DEEPGRAM_API_KEY`; do not distribute it to customers. See [Deepgram project/key management](https://developers.deepgram.com/guides/deep-dives/managing-projects).

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

For local browser QA without provider calls, start `node tests/fixtures/mock-api.mjs` instead of the real backend. Run Vite in development with `VITE_API_BASE_URL=/api/v1`. This test server returns clearly labeled sample text and an existing app image; it does not generate images. Interpreter shows a missing-provider setup state and cannot record. Audio/session/translation behavior is covered by mocked tests; real browser permissions and provider accounts need a short user-run smoke test after deployment. Never deploy the mock server.

## Deploy updates

1. Deploy the **complete** backend package first. The separate Render repository needs `app/`, root `main.py`, `requirements.txt`, and Docker files. See the [Render instructions](backend/README.md#deploy-the-updated-backend-to-render).
2. Set `CORS_ORIGINS` on Render to your frontend origin, without a path (for example `https://calvinrbobadillaf.github.io`). Check `/api/v1/health`, `/api/v1/models`, and `/api/v1/interpreter/capabilities`. A healthy backend with a 404 on Interpreter is an outdated/incomplete deployment; adding keys cannot add missing routes.
3. The root `.env.production` contains the public API address: `VITE_API_BASE_URL=https://iapp-iw24.onrender.com/api/v1`. Never put API keys in this file; all `VITE_` values are public.
4. Run `npm run deploy` to build and publish GitHub Pages. The base path is `/IApp/`.
5. Smoke-test a text reply on each configured provider, a file upload, and an image with Gemini and ChatGPT. Verify privacy on/off, history reload, and image download. In Interpreter, recheck availability, test a short English/Spanish and Kreyòl session with configured accounts, verify translation and stopping, then navigate back to Chat. These live tests can incur provider charges.

The display-name screen is not authentication. Before opening a paid backend to public traffic, add authentication and per-user rate/spending controls. CORS and the current concurrent-request limit alone do not prevent API abuse.
