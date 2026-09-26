import pytest
import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.integrations.ai import (
    BaseAIProvider,
    GeminiAIProvider,
    MockAIProvider,
    AIRequest,
    AIResponse,
    AIProviderError,
    AIConfigurationError,
    AIUnavailableError,
    AITimeoutError,
    AIMalformedResponseError,
    get_ai_provider,
)


# =====================================================================
# A. Base Interface Tests
# =====================================================================

def test_base_provider_cannot_be_instantiated_directly():
    """Verify BaseAIProvider is abstract and requires interface implementation."""
    with pytest.raises(TypeError):
        BaseAIProvider()  # type: ignore


@pytest.mark.anyio
async def test_base_provider_subclass_concrete_implementation():
    """Verify concrete subclass implementing abstract methods works correctly."""
    class CustomProvider(BaseAIProvider):
        async def is_available(self) -> bool:
            return True

        async def generate_text(self, request: AIRequest) -> AIResponse:
            return AIResponse(content=f"Processed: {request.prompt}", model="custom-1.0", finish_reason="STOP")

    provider = CustomProvider()
    assert await provider.is_available() is True
    res = await provider.generate_text(AIRequest(prompt="Hello World"))
    assert res.content == "Processed: Hello World"
    assert res.model == "custom-1.0"
    assert res.finish_reason == "STOP"


# =====================================================================
# B. Mock Provider Tests
# =====================================================================

@pytest.mark.anyio
async def test_mock_provider_deterministic_default_response():
    """Verify MockAIProvider returns predictable deterministic default response."""
    mock_provider = MockAIProvider()
    assert await mock_provider.is_available() is True

    req = AIRequest(prompt="Test Prompt")
    res = await mock_provider.generate_text(req)

    assert res.content == "Mock AI generated response."
    assert res.model == "mock-model"
    assert res.finish_reason == "STOP"
    assert len(mock_provider.call_history) == 1
    assert mock_provider.call_history[0]["prompt"] == "Test Prompt"


@pytest.mark.anyio
async def test_mock_provider_custom_response_and_echo():
    """Verify custom canned responses and echo mode behavior."""
    custom_provider = MockAIProvider(default_response="Custom Analysis", model="mock-fast")
    res1 = await custom_provider.generate_text(AIRequest(prompt="Analyze this"))
    assert res1.content == "Custom Analysis"
    assert res1.model == "mock-fast"

    echo_provider = MockAIProvider(echo_mode=True)
    res2 = await echo_provider.generate_text(AIRequest(prompt="Risk Assessment"))
    assert res2.content == "Echo: Risk Assessment"


@pytest.mark.anyio
async def test_mock_provider_simulated_errors():
    """Verify mock provider error simulation modes for fault injection."""
    timeout_provider = MockAIProvider(simulate_timeout=True)
    with pytest.raises(AITimeoutError, match="timeout"):
        await timeout_provider.generate_text(AIRequest(prompt="Test"))

    unavailable_provider = MockAIProvider(simulate_unavailable=True)
    with pytest.raises(AIUnavailableError, match="unavailable"):
        await unavailable_provider.generate_text(AIRequest(prompt="Test"))

    malformed_provider = MockAIProvider(simulate_malformed=True)
    with pytest.raises(AIMalformedResponseError, match="malformed"):
        await malformed_provider.generate_text(AIRequest(prompt="Test"))

    error_provider = MockAIProvider(simulate_error=True)
    with pytest.raises(AIProviderError, match="generic failure"):
        await error_provider.generate_text(AIRequest(prompt="Test"))


# =====================================================================
# C. Gemini Provider Tests (Mocked Transport)
# =====================================================================

@pytest.mark.anyio
async def test_gemini_provider_successful_generation():
    """Verify successful Gemini response parsing and payload generation."""
    captured_requests = []

    def mock_handler(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        # Check that header auth is used and key is in headers, NOT query string
        assert "key=" not in str(request.url)
        assert request.headers.get("x-goog-api-key") == "fake-gemini-key"
        
        return httpx.Response(
            status_code=200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": "Gemini generated risk report."}
                            ]
                        },
                        "finishReason": "STOP"
                    }
                ]
            }
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiAIProvider(
            api_key="fake-gemini-key",
            model="gemini-3.6-flash",
            timeout_seconds=15,
            http_client=client,
        )

        assert await provider.is_available() is True
        res = await provider.generate_text(
            AIRequest(
                prompt="Evaluate risk score",
                system_instruction="You are a risk analyzer",
                max_output_tokens=1000,
            )
        )

        assert res.content == "Gemini generated risk report."
        assert res.model == "gemini-3.6-flash"
        assert res.finish_reason == "STOP"
        assert len(captured_requests) == 1

        # Verify body payload mapping (no temperature or deprecated fields)
        import json
        body = json.loads(captured_requests[0].read())
        assert body["contents"][0]["parts"][0]["text"] == "Evaluate risk score"
        assert body["systemInstruction"]["parts"][0]["text"] == "You are a risk analyzer"
        assert body["generationConfig"]["maxOutputTokens"] == 1000
        assert "temperature" not in body.get("generationConfig", {})


@pytest.mark.anyio
async def test_gemini_provider_missing_api_key():
    """Verify provider behavior when API key is None or empty."""
    provider = GeminiAIProvider(api_key=None)
    assert await provider.is_available() is False

    with pytest.raises(AIConfigurationError, match="Gemini API key is not configured"):
        await provider.generate_text(AIRequest(prompt="Test"))

    empty_key_provider = GeminiAIProvider(api_key="   ")
    assert await empty_key_provider.is_available() is False
    with pytest.raises(AIConfigurationError):
        await empty_key_provider.generate_text(AIRequest(prompt="Test"))


@pytest.mark.anyio
async def test_gemini_provider_timeout_handling():
    """Verify httpx timeout raises AITimeoutError."""
    def timeout_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Request timed out", request=request)

    transport = httpx.MockTransport(timeout_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiAIProvider(
            api_key="fake-key",
            timeout_seconds=5,
            http_client=client,
        )
        with pytest.raises(AITimeoutError, match="timed out after 5s"):
            await provider.generate_text(AIRequest(prompt="Test"))


@pytest.mark.anyio
@pytest.mark.parametrize("status_code", [400, 403, 429, 500, 503])
async def test_gemini_provider_http_errors(status_code: int):
    """Verify HTTP error status codes map safely to AIProviderError."""
    def error_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=status_code,
            text='{"error": {"message": "Sensitive internal upstream failure with details"}}',
        )

    transport = httpx.MockTransport(error_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiAIProvider(
            api_key="fake-key",
            http_client=client,
        )
        with pytest.raises(AIProviderError) as exc_info:
            await provider.generate_text(AIRequest(prompt="Test"))
        
        err_msg = str(exc_info.value)
        assert f"HTTP {status_code}" in err_msg
        # Ensure raw response text is NOT leaked in exception message
        assert "Sensitive internal upstream" not in err_msg


@pytest.mark.anyio
@pytest.mark.parametrize("invalid_payload", [
    "invalid json string",
    {},
    {"candidates": []},
    {"candidates": [{}]},
    {"candidates": [{"content": {}}]},
    {"candidates": [{"content": {"parts": []}}]},
    {"candidates": [{"content": {"parts": [{"not_text": "abc"}]}}]},
])
async def test_gemini_provider_malformed_response_handling(invalid_payload):
    """Verify malformed JSON or unexpected schema structures raise AIMalformedResponseError."""
    def malformed_handler(request: httpx.Request) -> httpx.Response:
        if isinstance(invalid_payload, str):
            return httpx.Response(status_code=200, text=invalid_payload)
        return httpx.Response(status_code=200, json=invalid_payload)

    transport = httpx.MockTransport(malformed_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiAIProvider(
            api_key="fake-key",
            http_client=client,
        )
        with pytest.raises(AIMalformedResponseError):
            await provider.generate_text(AIRequest(prompt="Test"))


# =====================================================================
# D. Secret Security Tests
# =====================================================================

def test_secret_redaction_repr_and_str():
    """Verify that sensitive API keys are never exposed in repr or str representations."""
    secret_key = "TEST_FAKE_GEMINI_KEY_12345"
    provider = GeminiAIProvider(api_key=secret_key, model="gemini-3.6-flash", timeout_seconds=45)

    repr_str = repr(provider)
    str_val = str(provider)

    assert secret_key not in repr_str
    assert secret_key not in str_val
    assert "api_key=set" in repr_str
    assert "gemini-3.6-flash" in repr_str
    assert "timeout=45s" in repr_str


@pytest.mark.anyio
async def test_secret_redaction_in_exceptions():
    """Verify that exception messages never leak configured API keys."""
    secret_key = "SECRET_SUPER_CONFIDENTIAL_KEY_99999"

    def fail_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=403, text="Forbidden access")

    transport = httpx.MockTransport(fail_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiAIProvider(
            api_key=secret_key,
            http_client=client,
        )
        with pytest.raises(AIProviderError) as exc_info:
            await provider.generate_text(AIRequest(prompt="Secret prompt"))

        assert secret_key not in str(exc_info.value)


# =====================================================================
# E. Provider Factory & Selection Tests
# =====================================================================

def test_factory_default_provider():
    """Verify factory returns GeminiAIProvider by default with configured settings."""
    provider = get_ai_provider()
    assert isinstance(provider, GeminiAIProvider)
    assert provider.model == "gemini-3.6-flash"


def test_factory_mock_provider_explicit():
    """Verify factory returns MockAIProvider when explicitly requested."""
    mock_prov = get_ai_provider(provider_type="mock")
    assert isinstance(mock_prov, MockAIProvider)


def test_factory_no_silent_fallback_to_mock_when_key_missing():
    """Verify that missing Gemini key does NOT silently return MockAIProvider."""
    gemini_no_key = get_ai_provider(provider_type="gemini", api_key=None)
    assert isinstance(gemini_no_key, GeminiAIProvider)
    assert not isinstance(gemini_no_key, MockAIProvider)


def test_factory_invalid_provider_raises_error():
    """Verify unknown provider string raises ValueError."""
    with pytest.raises(ValueError, match="Unknown AI_PROVIDER"):
        get_ai_provider(provider_type="unsupported_provider")


# =====================================================================
# F. Configuration & Validation Tests
# =====================================================================

def test_settings_ai_configuration_defaults():
    """Verify Settings default values for Phase 5A AI provider."""
    cfg = Settings(
        DATABASE_URL="mysql+pymysql://user:pass@localhost:3306/db",
        SECRET_KEY="secret",
        JWT_SECRET_KEY="jwt_secret",
    )
    assert cfg.AI_PROVIDER == "gemini"
    assert cfg.GEMINI_API_KEY is None
    assert cfg.GEMINI_MODEL == "gemini-3.6-flash"
    assert cfg.GEMINI_TIMEOUT_SECONDS == 30


def test_settings_ai_configuration_overrides():
    """Verify custom environment values for AI provider settings."""
    cfg = Settings(
        DATABASE_URL="mysql+pymysql://user:pass@localhost:3306/db",
        SECRET_KEY="secret",
        JWT_SECRET_KEY="jwt_secret",
        AI_PROVIDER="mock",
        GEMINI_MODEL="gemini-3.6-flash",
        GEMINI_TIMEOUT_SECONDS=60,
    )
    assert cfg.AI_PROVIDER == "mock"
    assert cfg.GEMINI_MODEL == "gemini-3.6-flash"
    assert cfg.GEMINI_TIMEOUT_SECONDS == 60


def test_settings_invalid_provider_validation():
    """Verify validation fails for invalid AI_PROVIDER in Settings."""
    with pytest.raises(ValidationError):
        Settings(
            DATABASE_URL="mysql+pymysql://user:pass@localhost:3306/db",
            SECRET_KEY="secret",
            JWT_SECRET_KEY="jwt_secret",
            AI_PROVIDER="invalid_ai",
        )


def test_settings_invalid_timeout_validation():
    """Verify validation fails for non-positive GEMINI_TIMEOUT_SECONDS."""
    with pytest.raises(ValidationError):
        Settings(
            DATABASE_URL="mysql+pymysql://user:pass@localhost:3306/db",
            SECRET_KEY="secret",
            JWT_SECRET_KEY="jwt_secret",
            GEMINI_TIMEOUT_SECONDS=0,
        )
