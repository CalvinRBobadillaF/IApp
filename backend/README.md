# IApp API

FastAPI serves text chat, inline file analysis, image generation, and the merged Interpreter tool for the React frontend. All permanent provider credentials stay on the server. Requires Python 3.11 or newer; the Docker image uses 3.12.

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

If `/api/v1/health` returns `200` but `/api/v1/interpreter/capabilities` returns `404`, the backend is running but the deployed application does not contain the Interpreter routes. This is a deployment/version mismatch, not a missing API key. Adding keys or redeploying only the frontend cannot install those routes. Check which repository, branch, and root directory your existing Render service actually builds.

This version has several Python modules. **Upload the entire `app/` folder with its directory structure intact.** Replacing only the old root `main.py` will not install the new features. For the separate backend repository, its root should contain:

```text
app/
  __init__.py
  main.py
  catalog.py
  providers.py
  schemas.py
  interpreter.py
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

To enable **Tools → Interpreter**, also add the optional server environment variables:

```text
DEEPGRAM_API_KEY=...
GLADIA_API_KEY=...
DEEPL_API_KEY=...
GOOGLE_TRANSLATE_API_KEY=...
```

Use a Deepgram key with at least **Member** permissions so `/v1/auth/grant` can mint temporary tokens. Enable Google Cloud Translation API and billing for the Google key; restrict it to Cloud Translation API and, if available, the backend's outbound IP addresses. Browser-referrer restrictions are not appropriate for this server-only key. DeepL keys ending in `:fx` automatically use the Free endpoint; other keys use Pro. An optional `DEEPL_API_URL` override accepts only `https://api-free.deepl.com/v2/translate` or `https://api.deepl.com/v2/translate`. No key is needed for a provider you do not use; the UI reports unavailable capabilities. The old Interpreter backend URL, browser-stored provider keys, and CORS proxy are no longer used.

| Interpreter operation | Server environment variable |
| --- | --- |
| Transcribe English/Spanish | `DEEPGRAM_API_KEY` |
| Transcribe Haitian Creole | `GLADIA_API_KEY` |
| Translate English ↔ Spanish | `DEEPL_API_KEY` |
| Translate to/from Haitian Creole | `GOOGLE_TRANSLATE_API_KEY` |

DeepL requires an API subscription/key; access to its consumer translator does not configure the API. Subtitles-only mode needs the corresponding transcription key but no translation key. For example, English speech translated into Haitian Creole needs **both** Deepgram and Google, while Haitian Creole speech translated into English needs **both** Gladia and Google.

Once the backend is deployed, confirm `/api/v1/health` and `/api/v1/models` both return JSON. Set the frontend root `.env.production` to `VITE_API_BASE_URL=https://iapp-iw24.onrender.com/api/v1` (or your current service URL), then run `npm run deploy` to build and publish the frontend.

The Interpreter uses the same API base and Render service. Verify `/api/v1/interpreter/capabilities` returns JSON after deploying the complete `app/` folder. Capability booleans mean a server key is configured, not that its balance, permissions, or subscription have been verified. A live microphone smoke test still requires the user's consent and billable provider access.

After pushing the complete backend to the repository Render uses, deploy its latest commit and wait for the service to become live. These read-only PowerShell checks do not contact paid providers:

```powershell
Invoke-RestMethod https://iapp-iw24.onrender.com/api/v1/health
Invoke-RestMethod https://iapp-iw24.onrender.com/api/v1/interpreter/capabilities | ConvertTo-Json -Depth 3
```

Replace the host if your service URL differs. The second command must return `languages`, `transcription`, and `translation`, not `Not Found`. The deployed `/docs` or `/openapi.json` should show IApp API **2.1.0** and all three `/api/v1/interpreter/` routes. If a capability is `false`, add its key to this same Render service and redeploy. Then choose **Tools → Interpreter → Recheck availability** in the frontend. Only after these checks should you test a short microphone session; stop listening when done. If the route exists but a provider call fails, use the safe response message and `X-Request-ID` to find its operation, provider, and upstream HTTP status in the Render logs—do not share API keys or raw provider responses.

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

## Interpreter API and privacy

The merge preserves the original supported languages and provider selection:

- English/Spanish speech: Deepgram `nova-3`, multilingual recognition. The browser filters recognized languages to English and Spanish.
- Haitian Creole speech: Gladia `solaria-1`, explicitly configured for `ht`; raw mono PCM16 at the browser's actual audio sample rate.
- English ↔ Spanish translation: DeepL. Any pair involving Haitian Creole: Google Cloud Translation v2.

`GET /api/v1/interpreter/capabilities` returns `languages`, `transcription` (`deepgram`, `gladia` booleans), and `translation` (`deepl`, `google` booleans).

`POST /api/v1/interpreter/session` accepts:

```json
{
  "provider": "gladia",
  "sample_rate": 16000,
  "privacy_mode": false,
  "glossary": {
    "defaultIntensity": 0.4,
    "vocabulary": [{"value": "Gladia", "pronunciations": ["glad ya"], "intensity": 0.3, "enabled": true}],
    "spelling": [{"value": "Gladia", "variants": ["gladiaa"], "enabled": true}]
  }
}
```

It returns `{provider, url, protocols, expires_in?}`. Deepgram sessions return a 30-second temporary JWT in WebSocket subprotocols `['bearer', token]`; expiry applies to opening the connection, not its duration. The token has Deepgram's inference/usage permissions, not management permissions, and is **not** restricted to the URL settings supplied by this backend. Gladia returns its temporary, validated `wss://*.gladia.io` session URL. Never persist or log either credential. Audio then streams directly from the browser to the selected provider; it does not pass through this FastAPI service. Use [Deepgram's temporary-token guide](https://developers.deepgram.com/guides/fundamentals/token-based-authentication), [the official browser-auth implementation](https://github.com/deepgram/deepgram-js-sdk/blob/main/src/CustomClient.ts), and [Gladia's live session API](https://docs.gladia.io/api-reference/v2/live/init) for the upstream contracts.

`POST /api/v1/interpreter/translate` accepts `{text, source_lang, target_lang, privacy_mode}` and returns `{translated_text, provider}`. Language codes are `en`, `es`, or `ht`. Each request contains only the current text, never a transcript history or glossary. Identical source and destination languages return the original text with `provider: "identity"`, without a paid call. Identical provider output is also valid for names, numbers, and shared words; it is not retried. Google HTML entities are decoded into plain text. Credentials use headers, not URL query parameters. See [DeepL translation](https://developers.deepl.com/api-reference/translate/request-translation) and [Google's header-based authentication example](https://docs.cloud.google.com/docs/authentication/rest#api-keys).

Interpreter limits: 5,000 input characters per translation; 20,000 output characters; 128 KiB HTTP bodies before JSON parsing; 100 vocabulary entries and 100 spelling entries, at most 20 pronunciations/variants per entry, 160 characters per term, and 20,000 combined glossary characters. Gladia accepts actual sample rates 8000, 16000, 32000, 44100, or 48000. Four interpreter HTTP requests may run concurrently per worker, with a 20-second provider timeout and no automatic retries. This cap covers session creation and translations, **not the number or duration of direct audio streams**.

Privacy mode defaults on and discards any glossary before validation. Normal mode allows the optional enabled glossary entries on Gladia sessions. Neither mode stores text/audio on this server, creates a shared translation cache, sends previous translations, or logs their contents. Both modes set Deepgram's `mip_opt_out=true` to opt these streams out of its [Model Improvement Partnership Program](https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program). This does not promise zero provider retention. Gladia sessions and translation providers remain subject to their account policies; no undocumented zero-retention flag is sent. The user's explicit transcript export is separate from server persistence.

## Verification and troubleshooting

Run the mocked tests from `backend`:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

The suite verifies actual SDK request serialization, all three providers' inline attachments, context and privacy, both image routes, request limits, error redaction, and capacity release. Interpreter tests verify ephemeral-only credentials, private glossary exclusion, DeepL/Google routing and serialization, malformed responses, and body/text limits. HTTP network access is blocked during tests. No provider account or paid calls are used. Live provider billing, permissions, quotas, and model availability still need a short smoke test after deployment.

`503` means a required server key is missing. `400` can indicate an unavailable model or unsupported image mode. `422` means invalid input, a rejected attachment, or a blocked response. `429` indicates a provider quota/rate limit or busy server. `502` indicates provider credentials, connectivity, or another provider failure; `504` is a timeout. Use the browser's response body and request ID with Render logs to diagnose failures without sharing API keys or files.

Interpreter provider credit errors (`402`) and [DeepL character/spending limits (`456`)](https://developers.deepl.com/docs/best-practices/error-handling) are surfaced as `429` with billing-specific guidance, not a generic internal error. Retrying cannot fix exhausted credit or an account spending cap. Provider-side `408`/`504` responses are surfaced as timeouts. Error logs include the upstream HTTP status but never its response body or request contents.

The four-request concurrency limit is per worker and is not authentication or a per-user rate limit. The public API currently has no user authentication. CORS restricts browser origins only; it does not prevent direct API calls or enforce a spending limit.

**Before opening the Interpreter to arbitrary public users, add real user authentication and per-user rate/spending limits.** The display-name login is not authentication. Anyone who can call the public session endpoint can obtain short-lived inference access, and active audio streams can outlive a token's connection deadline. Set provider account budgets/alerts and monitor usage; a concurrency semaphore alone does not control the cost of these streams.
