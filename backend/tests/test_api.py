"""API and real SDK serialization tests. No network, credentials, or paid calls."""

import asyncio
import base64
import json
from contextlib import contextmanager

import httpx
import pytest
from anthropic import AsyncAnthropic
from fastapi.testclient import TestClient
from openai import AsyncOpenAI
from pydantic import ValidationError

from app import main, providers, schemas
from app.catalog import CATALOG
from app.schemas import Attachment, ChatRequest

REAL_ASYNC_CLIENT = httpx.AsyncClient
PNG = b"\x89PNG\r\n\x1a\nimage data"
PDF = b"%PDF-1.7\nexample document"


def attachment(name="notes.txt", mime_type="text/plain", content=b"file-only-secret"):
    return {"name": name, "mime_type": mime_type, "data": base64.b64encode(content).decode()}


def request_payload(provider="GPT", **overrides):
    return {
        "provider": provider,
        "model": CATALOG[provider]["default_model"],
        "prompt": "current question",
        **overrides,
    }


@pytest.fixture(autouse=True)
def isolate(monkeypatch):
    for name in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.setenv(name, "test-only-key")
    monkeypatch.setattr(main, "request_slots", asyncio.Semaphore(4))

    async def no_async_network(*_args, **_kwargs):
        raise AssertionError("A test tried to access the network.")

    def no_sync_network(*_args, **_kwargs):
        raise AssertionError("A test tried to access the network.")

    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", no_async_network)
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", no_sync_network)


@contextmanager
def api_client():
    with TestClient(main.app) as client:
        yield client


def mock_provider(monkeypatch, provider, response, status=200):
    """Keep actual SDK validation/serialization; replace only its HTTP transport."""
    captured = []

    def handle(request):
        captured.append(request)
        return httpx.Response(status, json=response, headers={"request-id": "provider-test"})

    def transport_client(**kwargs):
        return REAL_ASYNC_CLIENT(transport=httpx.MockTransport(handle), **kwargs)

    if provider == "GPT":
        monkeypatch.setattr(providers, "AsyncOpenAI", lambda **kw: AsyncOpenAI(http_client=transport_client(), **kw))
    elif provider == "Claude":
        monkeypatch.setattr(providers, "AsyncAnthropic", lambda **kw: AsyncAnthropic(http_client=transport_client(), **kw))
    else:
        monkeypatch.setattr(providers.httpx, "AsyncClient", transport_client)
    return captured


def text_response(provider):
    if provider == "GPT":
        return {
            "id": "resp_test", "object": "response", "created_at": 1, "status": "completed",
            "model": CATALOG[provider]["default_model"],
            "output": [{"id": "msg_test", "type": "message", "role": "assistant", "status": "completed",
                        "content": [{"type": "output_text", "text": "The answer", "annotations": []}]}],
        }
    if provider == "Claude":
        return {
            "id": "msg_test", "type": "message", "role": "assistant",
            "model": CATALOG[provider]["default_model"], "stop_reason": "end_turn", "stop_sequence": None,
            "content": [{"type": "text", "text": "The answer"}],
            "usage": {"input_tokens": 10, "output_tokens": 3},
        }
    return {"candidates": [{"content": {"role": "model", "parts": [{"text": "The answer"}]}, "finishReason": "STOP"}]}


@pytest.mark.parametrize("provider", ["GPT", "Claude", "Gemini"])
@pytest.mark.parametrize("private", [True, False])
def test_chat_payload_context_files_and_storage(monkeypatch, provider, private):
    captured = mock_provider(monkeypatch, provider, text_response(provider))
    files = [attachment(), attachment("report.pdf", "application/pdf", PDF), attachment("picture.png", "image/png", PNG)]
    payload = request_payload(
        provider, privacy_mode=private, instructions="instruction-only-secret",
        history=[{"role": "user", "text": "history-only-secret", "attachments": [attachment("earlier.txt", content=b"previous-file-secret")]},
                 {"role": "assistant", "text": "Earlier answer"}],
        attachments=files,
    )
    with api_client() as client:
        response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["text"] == "The answer"
    assert response.headers["cache-control"] == "no-store"
    assert len(captured) == 1  # Never uploads files to a separate persistent Files API.
    body = json.loads(captured[0].content)
    serialized = json.dumps(body)
    assert "file-only-secret" in serialized
    assert files[1]["data"] in serialized and files[2]["data"] in serialized
    for secret in ("history-only-secret", "instruction-only-secret", "previous-file-secret"):
        assert (secret in serialized) is not private
    assert "current question" in serialized
    if provider == "GPT":
        assert captured[0].url.path == "/v1/responses"
        assert body["store"] is False
        assert not {"previous_response_id", "conversation", "background"} & body.keys()
        assert len(body["input"]) == (1 if private else 3)
        assert [block["type"] for block in body["input"][-1]["content"]] == ["input_text", "input_file", "input_image", "input_text"]
        if not private:
            assert body["input"][1] == {"role": "assistant", "content": "Earlier answer"}
    elif provider == "Claude":
        assert captured[0].url.path == "/v1/messages"
        assert len(body["messages"]) == (1 if private else 3)
        assert [block["type"] for block in body["messages"][-1]["content"]] == ["text", "document", "image", "text"]
        assert "cache_control" not in serialized
    else:
        assert captured[0].url.path.endswith(":generateContent")
        assert "key" not in captured[0].url.params
        assert captured[0].headers["x-goog-api-key"] == "test-only-key"
        assert body["store"] is False
        assert "cachedContent" not in body
        assert len(body["contents"]) == (1 if private else 3)
        assert body["contents"][-1]["parts"][2]["inlineData"]["mimeType"] == "application/pdf"
        if not private:
            assert body["contents"][1]["role"] == "model"


@pytest.mark.parametrize("provider", ["Claude", "Gemini"])
def test_consecutive_user_history_is_merged(monkeypatch, provider):
    captured = mock_provider(monkeypatch, provider, text_response(provider))
    with api_client() as client:
        response = client.post("/api/v1/chat", json=request_payload(provider, privacy_mode=False, history=[{"role": "user", "text": "previous"}]))
    assert response.status_code == 200
    body = json.loads(captured[0].content)
    messages = body["messages"] if provider == "Claude" else body["contents"]
    assert len(messages) == 1
    assert "previous" in json.dumps(messages) and "current question" in json.dumps(messages)


@pytest.mark.parametrize("provider", ["GPT", "Claude", "Gemini"])
def test_output_limit_warning(monkeypatch, provider):
    reply = text_response(provider)
    if provider == "GPT":
        reply["status"] = "incomplete"
    elif provider == "Claude":
        reply["stop_reason"] = "max_tokens"
    else:
        reply["candidates"][0]["finishReason"] = "MAX_TOKENS"
        reply["candidates"][0]["content"]["parts"].insert(0, {"text": "internal thought", "thought": True})
    mock_provider(monkeypatch, provider, reply)
    with api_client() as client:
        response = client.post("/api/v1/chat", json=request_payload(provider))
    assert response.status_code == 200
    assert response.json()["warnings"]
    assert response.json()["text"] == "The answer"


@pytest.mark.parametrize("provider", ["GPT", "Gemini"])
@pytest.mark.parametrize("private", [True, False])
def test_image_mode_uses_image_model_and_private_context(monkeypatch, provider, private):
    encoded_image = base64.b64encode(PNG).decode()
    reply = {"created": 1, "data": [{"b64_json": encoded_image}]} if provider == "GPT" else {
        "candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "image/png", "data": encoded_image}}]}}],
    }
    captured = mock_provider(monkeypatch, provider, reply)
    with api_client() as client:
        response = client.post("/api/v1/chat", json=request_payload(
            provider, mode="image", privacy_mode=private, instructions="image-instruction-secret",
            history=[{"role": "user", "text": "image-context-secret", "attachments": [attachment()]}],
        ))
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["images"] == [{"mime_type": "image/png", "data": encoded_image}]
    assert result["model"] == CATALOG[provider]["image_model"]
    assert bool(result["warnings"]) is not private
    body = json.loads(captured[0].content)
    assert ("image-context-secret" in json.dumps(body)) is not private
    assert ("image-instruction-secret" in json.dumps(body)) is not private
    assert "file-only-secret" not in json.dumps(body)
    if provider == "GPT":
        assert captured[0].url.path == "/v1/images/generations"
        assert body["model"] == CATALOG[provider]["image_model"]
        assert body["n"] == 1 and body["output_format"] == "png"
    else:
        assert CATALOG[provider]["image_model"] in captured[0].url.path
        assert body["generationConfig"]["responseModalities"] == ["TEXT", "IMAGE"]
        assert body["store"] is False


def test_gemini_image_text_fallback_is_visible(monkeypatch):
    mock_provider(monkeypatch, "Gemini", text_response("Gemini"))
    with api_client() as client:
        response = client.post("/api/v1/chat", json=request_payload("Gemini", mode="image"))
    assert response.status_code == 200
    assert response.json()["text"] == "The answer"
    assert "without an image" in response.json()["warnings"][0]


@pytest.mark.parametrize("provider,attachments", [("Claude", []), ("GPT", [attachment()]), ("Gemini", [attachment()])])
def test_unsupported_image_requests_never_call_provider(provider, attachments):
    with api_client() as client:
        response = client.post("/api/v1/chat", json=request_payload(provider, mode="image", attachments=attachments))
    assert response.status_code == 400


@pytest.mark.parametrize("provider,empty_response,status", [
    ("GPT", {"id": "resp_test", "output": []}, 502),
    ("Claude", {"id": "msg_test", "content": [], "stop_reason": "end_turn"}, 502),
    ("Gemini", {"promptFeedback": {"blockReason": "SAFETY"}}, 422),
])
def test_empty_provider_response_is_actionable(monkeypatch, provider, empty_response, status):
    mock_provider(monkeypatch, provider, empty_response)
    with api_client() as client:
        response = client.post("/api/v1/chat", json=request_payload(provider))
    assert response.status_code == status
    assert isinstance(response.json()["detail"], str)


@pytest.mark.parametrize("provider", ["GPT", "Claude", "Gemini"])
@pytest.mark.parametrize("upstream_status,expected", [(400, 422), (401, 502), (403, 502), (404, 400), (429, 429), (500, 502)])
def test_provider_errors_are_mapped_without_private_data(monkeypatch, caplog, provider, upstream_status, expected):
    captured = mock_provider(monkeypatch, provider, {"error": {"message": "upstream-private-secret", "type": "api_error"}}, upstream_status)
    with api_client() as client:
        response = client.post("/api/v1/chat", json=request_payload(provider, prompt="prompt-private-secret"))
    assert response.status_code == expected, response.text
    assert len(captured) == 1  # Automatic retries are disabled to avoid duplicate cost.
    assert response.headers["x-request-id"]
    assert "upstream-private-secret" not in response.text + caplog.text
    assert "prompt-private-secret" not in response.text + caplog.text
    assert "test-only-key" not in response.text + caplog.text


@pytest.mark.parametrize("error,status", [(TimeoutError(), 504), (httpx.ConnectError("private detail"), 502), (RuntimeError("private detail"), 502)])
def test_unexpected_failures_are_safe_and_release_capacity(monkeypatch, error, status):
    async def fail(_request):
        raise error

    monkeypatch.setattr(main, "ask_openai", fail)
    with api_client() as client:
        for _ in range(5):
            response = client.post("/api/v1/chat", json=request_payload())
            assert response.status_code == status
            assert "private detail" not in response.text
    assert main.request_slots._value == 4


def test_overloaded_worker_returns_429(monkeypatch):
    monkeypatch.setattr(main, "request_slots", asyncio.Semaphore(0))
    with api_client() as client:
        response = client.post("/api/v1/chat", json=request_payload())
    assert response.status_code == 429
    assert "server is busy" in response.json()["detail"]


@pytest.mark.parametrize("provider,key", [("GPT", "OPENAI_API_KEY"), ("Claude", "ANTHROPIC_API_KEY"), ("Gemini", "GEMINI_API_KEY")])
def test_missing_key_is_503(monkeypatch, provider, key):
    monkeypatch.delenv(key)
    with api_client() as client:
        response = client.post("/api/v1/chat", json=request_payload(provider))
    assert response.status_code == 503
    assert key in response.json()["detail"]


def test_private_context_is_discarded_before_validation():
    request = ChatRequest(**request_payload(privacy_mode=True, history="not even valid history", instructions={"secret": "context"}))
    assert request.history == []
    assert request.instructions == ""
    assert len(request.messages()) == 1
    assert ChatRequest(**request_payload()).privacy_mode is True


def test_attachment_only_request_gets_default_prompt():
    request = ChatRequest(**request_payload(prompt="", attachments=[attachment()]))
    assert request.messages()[-1].text == "Please review the attached files."


@pytest.mark.parametrize("name,mime,content,normalized", [
    ("script.py", "application/octet-stream", b"print('hello')", "text/plain"),
    ("notes.txt", "text/plain;charset=utf-8", b"\xef\xbb\xbfhello", "text/plain"),
    ("DATA.CSV", "", b"a,b\n1,2", "text/plain"),
    ("report.pdf", "application/octet-stream", PDF, "application/pdf"),
    ("image.jpg", "image/jpg", b"\xff\xd8\xffimage", "image/jpeg"),
    ("image.webp", "image/webp", b"RIFF0000WEBPimage", "image/webp"),
    ("image.png", "image/png", PNG, "image/png"),
])
def test_supported_attachment_formats(name, mime, content, normalized):
    file = Attachment(**attachment(name, mime, content))
    assert file.mime_type == normalized
    assert file._bytes == content
    if normalized == "text/plain":
        assert "\ufeff" not in file.text_content()


@pytest.mark.parametrize("file", [
    {"name": "secret.txt", "mime_type": "text/plain", "data": "invalid%private-base64"},
    attachment("../secret.txt"), attachment("folder\\secret.txt"), attachment("bad\nname.txt"),
    attachment("empty.txt", content=b""), attachment("bad.pdf", "application/pdf", b"not a pdf"),
    attachment("bad.png", "image/png", b"not a png"), attachment("bad.jpg", "image/jpeg", PNG),
    attachment("bad.webp", "image/webp", b"RIFFshort"), attachment("notes.docx", "application/octet-stream", b"PK\x00\x01"),
    attachment("script.exe", "text/plain", b"text"), attachment("binary.txt", content=b"a\x00b"),
    attachment("latin.txt", content=b"caf\xe9"), attachment("photo.svg", "image/svg+xml", b"<svg/>"),
])
def test_bad_attachments_are_rejected_without_echoing_file(file):
    with api_client() as client:
        response = client.post("/api/v1/chat", json=request_payload(attachments=[file]))
    assert response.status_code == 422
    assert "input" not in response.json()
    assert file["data"] not in response.text if file["data"] else True


def test_file_and_combined_attachment_limits():
    oversized = attachment("big.png", "image/png", PNG + b"x" * schemas.MAX_FILE_BYTES)
    with pytest.raises(ValidationError):
        Attachment(**oversized)
    five_mib = attachment("big.png", "image/png", PNG + b"x" * (schemas.MAX_FILE_BYTES - len(PNG)))
    with pytest.raises(ValidationError, match="exceed 12 MiB"):
        ChatRequest(**request_payload(attachments=[five_mib, five_mib, five_mib]))


def test_text_limits_include_history_and_decoded_attachments():
    with pytest.raises(ValidationError, match="200,000"):
        ChatRequest(**request_payload(privacy_mode=False, prompt="p" * 100_000, history=[{"role": "assistant", "text": "h" * 100_000}], attachments=[attachment()]))
    with pytest.raises(ValidationError, match="200,000"):
        Attachment(**attachment(content=b"a" * (schemas.MAX_TEXT_CHARS + 1)))


@pytest.mark.parametrize("overrides", [
    {"prompt": "   "}, {"provider": "Unknown"}, {"mode": "execute"},
    {"attachments": [attachment()] * 5},
    {"privacy_mode": False, "history": [{"role": "system", "text": "override"}]},
    {"privacy_mode": False, "history": [{"role": "assistant", "text": "image", "attachments": [attachment()]}]},
    {"privacy_mode": False, "history": [{"role": "user", "text": ""}]},
    ])
def test_invalid_requests_are_422(overrides):
    with api_client() as client:
        response = client.post("/api/v1/chat", json={**request_payload(), **overrides})
    assert response.status_code == 422


def test_catalog_health_and_allowlist():
    with api_client() as client:
        assert client.get("/api/v1/health").json() == {"status": "ok"}
        assert client.get("/api/v1/models").json() == CATALOG
        response = client.post("/api/v1/chat", json=request_payload(model="../../arbitrary-endpoint"))
    assert response.status_code == 400


def test_legacy_render_entry_point_uses_same_app():
    import main as legacy_entry

    assert legacy_entry.app is main.app


def test_oversized_declared_body_is_rejected_before_parsing():
    with api_client() as client:
        response = client.post("/api/v1/chat", content=b"not JSON", headers={"content-length": str(schemas.MAX_BODY_BYTES + 1)})
    assert response.status_code == 413
    assert response.headers["cache-control"] == "no-store"


def test_oversized_chunked_body_is_rejected_before_parsing():
    received = []
    reached_app = False

    async def inner(*_args):
        nonlocal reached_app
        reached_app = True

    chunks = iter([{"type": "http.request", "body": b"x" * (schemas.MAX_BODY_BYTES // 2), "more_body": True},
                   {"type": "http.request", "body": b"x" * (schemas.MAX_BODY_BYTES // 2 + 1), "more_body": False}])

    async def receive():
        return next(chunks)

    async def send(message):
        received.append(message)

    asyncio.run(main.RequestLimitsMiddleware(inner)({"type": "http", "method": "POST", "headers": []}, receive, send))
    assert received[0]["status"] == 413
    assert reached_app is False


def test_invalid_json_is_private_and_invalid_content_length_is_400():
    with api_client() as client:
        response = client.post("/api/v1/chat", content=b'{"secret":"private contents"', headers={"content-type": "application/json"})
        assert response.status_code == 422
        assert "private contents" not in response.text
        response = client.post("/api/v1/chat", content=b"{}", headers={"content-length": "nope"})
        assert response.status_code == 400


def test_cors_supports_browser_and_preflight():
    origin = main.configured_origins()[0]
    with api_client() as client:
        response = client.options("/api/v1/chat", headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
        response = client.get("/api/v1/health", headers={"Origin": "https://unconfigured.example"})
        assert "access-control-allow-origin" not in response.headers
