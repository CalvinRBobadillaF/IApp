"""Merged Interpreter API verification. All outbound HTTP is mocked."""

import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import interpreter, main

REAL_ASYNC_CLIENT = httpx.AsyncClient
KEYS = ("DEEPGRAM_API_KEY", "GLADIA_API_KEY", "DEEPL_API_KEY", "GOOGLE_TRANSLATE_API_KEY")
SECRET = "permanent-server-secret"
TOKEN = "eyJhbGci.testPayload.testSignature"
GLADIA_URL = "wss://api.gladia.io/v2/live?token=temporary-session-only"
GLOSSARY = {
    "defaultIntensity": 0.4,
    "vocabulary": [{"value": "private-name", "pronunciations": ["pronunciation"], "intensity": 0.2}, {"value": "disabled-term", "enabled": False}],
    "spelling": [{"value": "private-spelling", "variants": ["variant"]}, {"value": "disabled-spelling", "variants": ["x"], "enabled": False}],
}


@pytest.fixture(autouse=True)
def isolate(monkeypatch):
    for name in KEYS:
        monkeypatch.setenv(name, SECRET)
    monkeypatch.delenv("DEEPL_API_URL", raising=False)
    monkeypatch.setattr(interpreter, "request_slots", asyncio.Semaphore(4))

    async def deny_async(*_args, **_kwargs):
        raise AssertionError("A test tried to access the network")

    def deny_sync(*_args, **_kwargs):
        raise AssertionError("A test tried to access the network")

    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", deny_async)
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", deny_sync)


def mock_http(monkeypatch, data, status=200, error=None):
    captured = []

    def handle(request):
        captured.append(request)
        if error:
            raise error
        return httpx.Response(status, json=data)

    monkeypatch.setattr(interpreter.httpx, "AsyncClient", lambda **kw: REAL_ASYNC_CLIENT(transport=httpx.MockTransport(handle), **kw))
    return captured


def translate_payload(**overrides):
    return {"text": "Hello", "source_lang": "en", "target_lang": "es", **overrides}


def post(path, payload):
    with TestClient(main.app) as client:
        return client.post(f"/api/v1/interpreter/{path}", json=payload)


def test_capabilities_are_configuration_only_without_credentials(monkeypatch):
    monkeypatch.delenv("GLADIA_API_KEY")
    monkeypatch.setenv("GOOGLE_TRANSLATE_API_KEY", "   ")
    with TestClient(main.app) as client:
        response = client.get("/api/v1/interpreter/capabilities")
    assert response.status_code == 200
    assert response.json() == {"languages": ["en", "es", "ht", "fr", "de", "it", "pt"], "transcription": {"deepgram": True, "gladia": False}, "translation": {"deepl": True, "google": False}}
    assert SECRET not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_deepgram_exposes_only_short_lived_bearer_token(monkeypatch):
    captured = mock_http(monkeypatch, {"access_token": TOKEN, "expires_in": 30, "ignored_credential": SECRET})
    response = post("session", {"provider": "deepgram", "privacy_mode": True, "glossary": GLOSSARY})
    assert response.status_code == 200, response.text
    assert response.json()["protocols"] == ["bearer", TOKEN]
    assert response.json()["expires_in"] == 30
    assert SECRET not in response.text
    assert "private-name" not in response.text
    assert response.headers["cache-control"] == "no-store"
    upstream = captured[0]
    assert str(upstream.url) == "https://api.deepgram.com/v1/auth/grant"
    assert upstream.headers["Authorization"] == f"Token {SECRET}"
    assert json.loads(upstream.content) == {"ttl_seconds": 30}
    url = httpx.URL(response.json()["url"])
    assert url.scheme == "wss" and url.host == "api.deepgram.com"
    assert url.params["model"] == "nova-3" and url.params["language"] == "multi"
    assert url.params["mip_opt_out"] == "true"
    assert "encoding" not in url.params  # Browser sends a MediaRecorder container.
    assert TOKEN not in str(url)


@pytest.mark.parametrize("language", ["en", "es", "fr", "de", "it", "pt"])
def test_explicit_speech_language_is_applied_to_deepgram_session(monkeypatch, language):
    mock_http(monkeypatch, {"access_token": TOKEN, "expires_in": 30})
    response = post("session", {"provider": "deepgram", "language": language})
    assert response.status_code == 200
    assert httpx.URL(response.json()["url"]).params["language"] == language


@pytest.mark.parametrize("source,target,expected", [("fr", "de", "DE"), ("de", "it", "IT"), ("it", "fr", "FR"), ("en", "pt", "PT-BR"), ("pt", "en", "EN-US")])
def test_expanded_deepl_language_pairs(monkeypatch, source, target, expected):
    captured = mock_http(monkeypatch, {"translations": [{"text": "Translated test text"}]})
    response = post("translate", translate_payload(source_lang=source, target_lang=target))
    assert response.status_code == 200
    body = json.loads(captured[0].content)
    assert body["source_lang"] == source.upper()
    assert body["target_lang"] == expected


@pytest.mark.parametrize("language", ["fr", "de", "it", "pt"])
def test_expanded_languages_can_translate_to_kreyol(monkeypatch, language):
    captured = mock_http(monkeypatch, {"data": {"translations": [{"translatedText": "Bonjou"}]}})
    response = post("translate", translate_payload(source_lang=language, target_lang="ht"))
    assert response.status_code == 200
    assert captured[0].url.host == "translation.googleapis.com"
    assert json.loads(captured[0].content)["source"] == language


def test_unsupported_speech_language_is_rejected_without_network():
    assert post("session", {"provider": "deepgram", "language": "xx"}).status_code == 422


@pytest.mark.parametrize("metadata,expected", [({}, None), ({"expires_in": None}, None), ({"expires_in": 30.0}, 30), ({"expires_in": 29.75}, 29)])
def test_deepgram_accepts_documented_optional_numeric_expiry(monkeypatch, metadata, expected):
    mock_http(monkeypatch, {"access_token": TOKEN, **metadata})
    response = post("session", {"provider": "deepgram"})
    assert response.status_code == 200
    assert response.json()["protocols"] == ["bearer", TOKEN]
    assert response.json().get("expires_in") == expected
    if expected is None:
        assert "expires_in" not in response.json()


@pytest.mark.parametrize("data", [
    {"access_token": SECRET, "expires_in": 30}, {"access_token": TOKEN, "expires_in": 3600},
    {"access_token": TOKEN, "expires_in": 0}, {"access_token": TOKEN, "expires_in": True},
    {"access_token": "contains spaces", "expires_in": 30}, {"access_token": None, "expires_in": 30},
    {"access_token": TOKEN, "expires_in": "30"}, {"access_token": TOKEN, "expires_in": 0.5},
    {"access_token": f"{SECRET}.payload.signature", "expires_in": 30}, {}, [],
])
def test_invalid_temporary_tokens_never_escape(monkeypatch, data):
    mock_http(monkeypatch, data)
    response = post("session", {"provider": "deepgram"})
    assert response.status_code == 502
    assert SECRET not in response.text and TOKEN not in response.text


@pytest.mark.parametrize("private", [True, False])
def test_gladia_preserves_original_pipeline_and_private_glossary(monkeypatch, private):
    captured = mock_http(monkeypatch, {"url": GLADIA_URL, "id": "not-needed", "api_key": SECRET}, status=201)
    response = post("session", {"provider": "gladia", "sample_rate": 48000, "privacy_mode": private, "glossary": GLOSSARY})
    assert response.status_code == 200, response.text
    assert response.json() == {"provider": "gladia", "url": GLADIA_URL, "protocols": []}
    assert SECRET not in response.text
    body = json.loads(captured[0].content)
    assert captured[0].headers["x-gladia-key"] == SECRET
    assert str(captured[0].url) == "https://api.gladia.io/v2/live"
    assert body["sample_rate"] == 48000 and body["bit_depth"] == 16 and body["channels"] == 1
    assert body["encoding"] == "wav/pcm" and body["model"] == "solaria-1"
    assert body["language_config"] == {"languages": ["ht"], "code_switching": False}
    assert body["pre_processing"] == {"audio_enhancer": True}
    assert body["messages_config"]["receive_partial_transcripts"] is True
    assert body["callback"] is False
    processing = body["realtime_processing"]
    assert processing["translation"] is False
    assert processing["custom_vocabulary"] is not private
    assert processing["custom_spelling"] is not private
    assert ("private-name" in json.dumps(body)) is not private
    assert "disabled-term" not in json.dumps(body) and "disabled-spelling" not in json.dumps(body)
    if not private:
        assert processing["custom_vocabulary_config"] == {"default_intensity": 0.4, "vocabulary": [{"value": "private-name", "language": "ht", "pronunciations": ["pronunciation"], "intensity": 0.2}]}
        assert processing["custom_spelling_config"] == {"spelling_dictionary": {"private-spelling": ["variant"]}}


def test_private_glossary_is_discarded_before_validation(monkeypatch):
    captured = mock_http(monkeypatch, {"url": GLADIA_URL})
    response = post("session", {"provider": "gladia", "glossary": {"vocabulary": "malformed-private-secret"}})
    assert response.status_code == 200
    assert "malformed-private-secret" not in captured[0].content.decode()


@pytest.mark.parametrize("url", [
    "https://api.gladia.io/live", "wss://attacker.example/live", "wss://gladia.io.attacker.example/live",
    "wss://user:pass@api.gladia.io/live", "wss://api.gladia.io:8080/live", "wss://api.gladia.io/live#fragment",
    f"wss://api.gladia.io/live?key={SECRET}", "wss://api.gladia.io/live?secret=permanent%2Dserver%2Dsecret",
    "wss://api.gladia.io/live?token=has space", "wss://api.gladia.io/live?token=" + "x" * 4096, None,
])
def test_untrusted_gladia_session_urls_are_rejected(monkeypatch, url):
    mock_http(monkeypatch, {"url": url})
    response = post("session", {"provider": "gladia"})
    assert response.status_code == 502
    assert SECRET not in response.text and "attacker" not in response.text


@pytest.mark.parametrize("source,target,api_source,api_target", [("en", "es", "EN", "ES"), ("es", "en", "ES", "EN-US")])
@pytest.mark.parametrize("free", [True, False])
def test_deepl_translation_server_only_keys_and_exact_language_codes(monkeypatch, source, target, api_source, api_target, free):
    key = SECRET + (":fx" if free else "")
    monkeypatch.setenv("DEEPL_API_KEY", key)
    captured = mock_http(monkeypatch, {"translations": [{"text": "Translation"}]})
    response = post("translate", translate_payload(source_lang=source, target_lang=target, privacy_mode=False, context="must-not-send"))
    assert response.status_code == 200
    assert response.json() == {"translated_text": "Translation", "provider": "deepl"}
    assert SECRET not in response.text
    assert captured[0].url.host == ("api-free.deepl.com" if free else "api.deepl.com")
    assert captured[0].headers["Authorization"] == f"DeepL-Auth-Key {key}"
    assert json.loads(captured[0].content) == {"text": ["Hello"], "source_lang": api_source, "target_lang": api_target}
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("source,target", [("en", "ht"), ("es", "ht"), ("ht", "en"), ("ht", "es")])
def test_google_translation_keeps_api_key_out_of_url_and_decodes_entities(monkeypatch, source, target):
    captured = mock_http(monkeypatch, {"data": {"translations": [{"translatedText": "Tom &amp; Jerry &#39;yes&#39;"}]}})
    response = post("translate", translate_payload(source_lang=source, target_lang=target))
    assert response.status_code == 200
    assert response.json() == {"translated_text": "Tom & Jerry 'yes'", "provider": "google"}
    assert captured[0].headers["x-goog-api-key"] == SECRET
    assert str(captured[0].url) == "https://translation.googleapis.com/language/translate/v2"
    assert json.loads(captured[0].content) == {"q": "Hello", "source": source, "target": target, "format": "text"}


def test_identical_translation_is_valid_and_not_retried(monkeypatch):
    captured = mock_http(monkeypatch, {"translations": [{"text": "123"}]})
    response = post("translate", translate_payload(text="123"))
    assert response.status_code == 200 and response.json()["translated_text"] == "123"
    assert len(captured) == 1


@pytest.mark.parametrize("text", ["&#10;", "&nbsp;", "&#32;&#9;"])
def test_google_entity_only_whitespace_is_not_a_successful_translation(monkeypatch, text):
    mock_http(monkeypatch, {"data": {"translations": [{"translatedText": text}]}})
    response = post("translate", translate_payload(target_lang="ht"))
    assert response.status_code == 502


@pytest.mark.parametrize("lang", ["en", "es", "ht"])
def test_same_language_returns_original_without_network(monkeypatch, lang):
    for name in KEYS:
        monkeypatch.delenv(name)
    response = post("translate", translate_payload(text="Original", source_lang=lang, target_lang=lang))
    assert response.status_code == 200
    assert response.json() == {"translated_text": "Original", "provider": "identity"}


@pytest.mark.parametrize("text", ["", "   ", None, 123, "x" * 20_001])
def test_empty_or_malformed_upstream_translation_is_safe_error(monkeypatch, text):
    mock_http(monkeypatch, {"translations": [{"text": text}]})
    response = post("translate", translate_payload())
    assert response.status_code == 502 and SECRET not in response.text


@pytest.mark.parametrize("path,payload", [
    ("translate", translate_payload(text="")), ("translate", translate_payload(text="   ")),
    ("translate", translate_payload(text="x" * 5001)), ("translate", translate_payload(text="private\u0000secret")),
    ("translate", translate_payload(source_lang="xx")), ("translate", translate_payload(target_lang="xx")),
    ("translate", translate_payload(privacy_mode="false")), ("session", {"provider": "other"}),
    ("session", {"provider": "gladia", "sample_rate": 22050}),
    ("session", {"provider": "gladia", "privacy_mode": False, "glossary": {"defaultIntensity": 2}}),
    ("session", {"provider": "gladia", "privacy_mode": False, "glossary": {"vocabulary": [{"value": "x"}] * 101}}),
    ("session", {"provider": "gladia", "privacy_mode": False, "glossary": {"vocabulary": [{"value": "x" * 161}]}}),
    ("session", {"provider": "gladia", "privacy_mode": False, "glossary": {"spelling": [{"value": "secret", "variants": []}]}}),
    ("session", {"provider": "gladia", "privacy_mode": False, "glossary": {"spelling": [{"value": "secret", "variants": ["x"] * 21}]}}),
    ("session", {"provider": "gladia", "privacy_mode": False, "glossary": {"vocabulary": [{"value": "secret", "pronunciations": ["x" * 160] * 20}] * 7}}),
])
def test_request_limits_do_not_echo_input(path, payload):
    response = post(path, payload)
    assert response.status_code == 422, response.text
    assert "secret" not in response.text and "private" not in response.text


@pytest.mark.parametrize("path,payload,key", [
    ("session", {"provider": "deepgram"}, "DEEPGRAM_API_KEY"),
    ("session", {"provider": "gladia"}, "GLADIA_API_KEY"),
    ("translate", translate_payload(), "DEEPL_API_KEY"),
    ("translate", translate_payload(target_lang="ht"), "GOOGLE_TRANSLATE_API_KEY"),
])
def test_missing_credentials_are_actionable(monkeypatch, path, payload, key):
    monkeypatch.delenv(key)
    response = post(path, payload)
    assert response.status_code == 503 and key in response.json()["detail"]
    assert interpreter.request_slots._value == 4


def test_deepl_url_must_be_allowlisted(monkeypatch):
    monkeypatch.setenv("DEEPL_API_URL", "https://attacker.example")
    response = post("translate", translate_payload())
    assert response.status_code == 503 and "attacker" not in response.text


@pytest.mark.parametrize("upstream,expected", [(401, 502), (403, 502), (402, 429), (429, 429), (456, 429), (400, 422), (408, 504), (504, 504), (500, 502), (302, 502)])
def test_provider_errors_and_logs_never_include_content_or_secrets(monkeypatch, caplog, upstream, expected):
    mock_http(monkeypatch, {"error": SECRET + " private-conversation"}, status=upstream)
    response = post("translate", translate_payload(text="private-conversation"))
    assert response.status_code == expected
    assert response.headers["x-request-id"]
    assert SECRET not in response.text + caplog.text and "private-conversation" not in response.text + caplog.text
    assert f"upstream_status={upstream}" in caplog.text
    assert interpreter.request_slots._value == 4


@pytest.mark.parametrize("status", [401, 403])
@pytest.mark.parametrize("path,payload,key,label,hint", [
    ("session", {"provider": "deepgram"}, "DEEPGRAM_API_KEY", "Deepgram", "Member or higher"),
    ("session", {"provider": "gladia"}, "GLADIA_API_KEY", "Gladia", "live transcription"),
    ("translate", translate_payload(), "DEEPL_API_KEY", "DeepL", "Free or Pro"),
    ("translate", translate_payload(target_lang="ht"), "GOOGLE_TRANSLATE_API_KEY", "Google Cloud Translation", "browser-referrer"),
])
def test_auth_errors_identify_exact_provider_and_safe_setup_guidance(monkeypatch, caplog, status, path, payload, key, label, hint):
    mock_http(monkeypatch, {"error": f"{SECRET} upstream-private-detail"}, status=status)
    response = post(path, payload)
    assert response.status_code == 502
    detail = response.json()["detail"]
    assert detail.startswith(f"{label} rejected")
    assert key in detail and hint in detail
    assert "raw key value" in detail
    assert ("creating a transcription session" if path == "session" else "translating text") in detail
    assert response.headers["x-request-id"]
    assert SECRET not in detail + caplog.text
    assert "upstream-private-detail" not in detail + caplog.text
    assert not any(other in detail for other in KEYS if other != key)


def test_unknown_provider_label_cannot_leak_arbitrary_data():
    request = httpx.Request("POST", "https://example.test")
    response = httpx.Response(401, request=request)
    error = httpx.HTTPStatusError(SECRET, request=request, response=response)
    mapped = interpreter.interpreter_error(error, provider=SECRET)
    assert mapped.status_code == 502
    assert SECRET not in mapped.detail
    assert mapped.detail.startswith("The interpreter provider rejected")


def test_timeout_releases_capacity_and_is_sanitized(monkeypatch):
    mock_http(monkeypatch, {}, error=httpx.ReadTimeout(SECRET))
    response = post("session", {"provider": "deepgram"})
    assert response.status_code == 504 and SECRET not in response.text
    assert interpreter.request_slots._value == 4


def test_busy_server_rejects_without_minting_token(monkeypatch):
    monkeypatch.setattr(interpreter, "request_slots", asyncio.Semaphore(0))
    response = post("session", {"provider": "deepgram"})
    assert response.status_code == 429
    assert interpreter.request_slots._value == 0


def test_body_limit_precedes_json_parsing():
    with TestClient(main.app) as client:
        response = client.post("/api/v1/interpreter/translate", content=b"x" * (interpreter.MAX_INTERPRETER_BODY_BYTES + 1))
    assert response.status_code == 413 and "128 KiB" in response.text
    assert response.headers["cache-control"] == "no-store"


def test_interpreter_chunked_body_uses_its_smaller_limit():
    responses = []
    reached_app = False

    async def inner(*_args):
        nonlocal reached_app
        reached_app = True

    chunks = iter([
        {"type": "http.request", "body": b"x" * interpreter.MAX_INTERPRETER_BODY_BYTES, "more_body": True},
        {"type": "http.request", "body": b"x", "more_body": False},
    ])

    async def receive():
        return next(chunks)

    async def send(message):
        responses.append(message)

    scope = {"type": "http", "method": "POST", "path": "/api/v1/interpreter/session", "headers": []}
    asyncio.run(main.RequestLimitsMiddleware(inner)(scope, receive, send))
    assert responses[0]["status"] == 413
    assert reached_app is False
    assert b"128 KiB" in responses[1]["body"]


def test_all_interpreter_routes_exist_on_legacy_and_package_entry_points(monkeypatch):
    import main as legacy_entry

    assert legacy_entry.app is main.app
    for name in KEYS:
        monkeypatch.delenv(name)
    with TestClient(legacy_entry.app) as client:
        paths = client.get("/openapi.json").json()["paths"]
        assert {"/api/v1/interpreter/capabilities", "/api/v1/interpreter/session", "/api/v1/interpreter/translate"} <= paths.keys()
        assert client.get("/api/v1/interpreter/capabilities").status_code == 200
        assert client.post("/api/v1/interpreter/session", json={"provider": "deepgram"}).status_code == 503
        assert client.post("/api/v1/interpreter/translate", json=translate_payload()).status_code == 503


def test_interpreter_preflight_and_errors_preserve_browser_cors(monkeypatch):
    origin = main.configured_origins()[0]
    monkeypatch.delenv("GLADIA_API_KEY")
    with TestClient(main.app) as client:
        response = client.options("/api/v1/interpreter/session", headers={
            "Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type",
        })
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
        response = client.post("/api/v1/interpreter/session", json={"provider": "gladia"}, headers={"Origin": origin})
        assert response.status_code == 503
        assert response.headers["access-control-allow-origin"] == origin
        assert response.headers["cache-control"] == "no-store"


def test_cancellation_releases_interpreter_capacity(monkeypatch):
    async def operation():
        raise asyncio.CancelledError

    async def run():
        with pytest.raises(asyncio.CancelledError):
            await interpreter.bounded_request("translate", "deepl", operation)
        assert interpreter.request_slots._value == 4

    asyncio.run(run())
