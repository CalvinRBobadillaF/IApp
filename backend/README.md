# IApp API

FastAPI serves text chat, inline file analysis, and image generation for the React frontend. All provider credentials stay on the server. Requires Python 3.11 or newer; the Docker image uses 3.12.

## Local setup

1. Create `backend/.env` from `.env.example` and fill in the provider keys.
2. Create a Python virtual environment and install dependencies:

   ```powershell
   cd backend
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   ```

3. Start the API:

   ```powershell
   python -m uvicorn app.main:app --reload --port 8000
   ```

4. In another terminal, run `npm run dev` in the project root. Vite forwards `/api` to port 8000. API documentation is available at `http://localhost:8000/docs`.

## Deploy the updated backend to Render

This version has several Python modules. **Upload the entire `app/` folder with its directory structure intact.** Replacing only the old root `main.py` will not install the new features. For the separate backend repository, its root should contain:

```text
app/
  __init__.py
  main.py
  catalog.py
  providers.py
  schemas.py
main.py
requirements.txt
Dockerfile
.dockerignore
```

The root `main.py` is a compatibility entry point for an existing `main:app` start command. It imports the same application from `app.main`; it still requires the complete `app/` folder.

For a **Docker Web Service**, set the root directory to `backend` if using the full IApp repository, or leave it blank for the separate backend repository. Use `Dockerfile` as the Dockerfile path and `.` as the build context. Clear any Docker command override to use the included `CMD`.

For a **Python Web Service**, use the same root-directory choice, build with `python -m pip install -r requirements.txt`, and start with:

```sh
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

For either runtime, set the health-check path to `/api/v1/health`. Render supplies `PORT`. Set these variables in Render's environment settings:

```text
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
CORS_ORIGINS=https://calvinrbobadillaf.github.io
```

The CORS value is an origin: no `/IApp` path and no trailing slash. Multiple origins may be comma separated. Do not commit `.env` or put provider keys in `VITE_` variables.

Once the backend is deployed, confirm `/api/v1/health` and `/api/v1/models` both return JSON. Set the frontend root `.env.production` to `VITE_API_BASE_URL=https://iapp-iw24.onrender.com/api/v1` (or your current service URL), then run `npm run deploy` to build and publish the frontend.

## Request contract and capabilities

`GET /api/v1/models` returns the chat model list and image model for each provider. `POST /api/v1/chat` accepts JSON:

```json
{
  "provider": "GPT",
  "model": "gpt-5.6-terra",
  "prompt": "Explain this code",
  "privacy_mode": false,
  "history": [{"role": "user", "text": "We are building a weather app", "attachments": []}],
  "attachments": [{"name": "hello.py", "mime_type": "text/plain", "data": "cHJpbnQoJ2hpJyk="}],
  "instructions": "Explain your changes briefly",
  "mode": "chat"
}
```

Attachments use raw base64, without a `data:` URL prefix. Supported files are PDF, PNG, JPEG, WEBP, and UTF-8 text/code files including CSV, JSON, Markdown, Python, JavaScript, and TypeScript. Export Word files as PDF and Excel files as CSV first. The server does not execute uploaded code or macros. PDF encryption, image dimensions, document page counts, and model-specific input restrictions can still cause a provider to reject an otherwise valid upload.

Limits: four files per message; 5 MiB per file; 12 MiB of decoded attachments across the current request and its history; 18 MiB total HTTP body; 40 history messages; 200,000 combined text characters including decoded text files; 10,000 characters of custom instructions. Oversized bodies are rejected before JSON parsing, including chunked requests.

The response contains `text`, `images`, `provider`, `model`, and `warnings`. Images contain `mime_type` and base64 `data`. Text uses Markdown, including fenced code blocks. A partial output or text-only image response has a visible warning.

Set `mode` to `image` for text-to-image generation. The chosen provider's dedicated image model is used automatically (`gpt-image-2` or `gemini-3.1-flash-image`); the supplied `model` remains a valid chat model from the catalog. Claude can analyze images but cannot generate them. Image generation accepts text prompts only. Earlier text context and instructions are included when privacy is off; earlier attachments are omitted with a warning. Editing or regenerating from an uploaded/generated image is not implemented.

## Privacy behavior

Privacy mode defaults to `true` on the API. When enabled, the server discards all supplied history and custom instructions **before validating those fields**. Only the current prompt and its attachments go to the provider. When disabled, the request's history and instructions are included, so later messages can refer to earlier work. No provider conversation ID or server database is needed.

In both modes, attachments are sent inline, never saved to the API server's disk, and never uploaded to provider Files APIs. The server does not log prompts, responses, or file contents, and responses use `Cache-Control: no-store`. Errors expose a safe explanation; unexpected provider failures include an `X-Request-ID` for correlation with logs that contain only the provider, model, and error type.

OpenAI Responses requests always use `store=False`. Gemini `generateContent` requests always use `store: false` to disable optional request logging. Claude uses stateless Messages requests without explicit prompt caching. The OpenAI Images endpoint has no `store` flag. These controls do **not** guarantee zero retention or disable every provider's abuse monitoring, legal retention, or model-training policy; those depend on the provider, account plan, and applicable agreements. Review [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data), [Gemini request logging controls](https://ai.google.dev/api/generate-content), [Gemini abuse monitoring](https://ai.google.dev/gemini-api/docs/usage-policies), and [Claude data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).

## Verification and troubleshooting

Run the mocked tests from `backend`:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

The suite verifies actual SDK request serialization, all three providers' inline attachments, context and privacy, both image routes, request limits, error redaction, and capacity release. HTTP network access is blocked during tests. No provider account or paid calls are used. Live provider billing, permissions, quotas, and model availability still need a short smoke test after deployment.

`503` means a required server key is missing. `400` can indicate an unavailable model or unsupported image mode. `422` means invalid input, a rejected attachment, or a blocked response. `429` indicates a provider quota/rate limit or busy server. `502` indicates provider credentials, connectivity, or another provider failure; `504` is a timeout. Use the browser's response body and request ID with Render logs to diagnose failures without sharing API keys or files.

The four-request concurrency limit is per worker and is not authentication or a per-user rate limit. The public API currently has no user authentication. CORS restricts browser origins only; it does not prevent direct API calls or enforce a spending limit.
