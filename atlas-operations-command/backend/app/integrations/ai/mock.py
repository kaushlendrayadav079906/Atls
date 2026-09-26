from typing import Optional, List, Dict, Any
from app.integrations.ai.base import (
    BaseAIProvider,
    AIRequest,
    AIResponse,
    AIProviderError,
    AIUnavailableError,
    AITimeoutError,
    AIMalformedResponseError,
)


class MockAIProvider(BaseAIProvider):
    """Deterministic Mock AI Provider for testing and offline development.
    
    Guarantees:
    - Never makes network calls.
    - Returns deterministic canned or echo responses.
    - Supports simulated error modes for fault-injection testing.
    - Stores safe call history for test assertions without sensitive secrets.
    """

    def __init__(
        self,
        default_response: str = "Mock AI generated response.",
        model: str = "mock-model",
        is_available_flag: bool = True,
        simulate_timeout: bool = False,
        simulate_unavailable: bool = False,
        simulate_malformed: bool = False,
        simulate_error: bool = False,
        echo_mode: bool = False,
    ) -> None:
        self.default_response = default_response
        self.model = model
        self._is_available = is_available_flag
        self.simulate_timeout = simulate_timeout
        self.simulate_unavailable = simulate_unavailable
        self.simulate_malformed = simulate_malformed
        self.simulate_error = simulate_error
        self.echo_mode = echo_mode
        self.call_history: List[Dict[str, Any]] = []

    def __repr__(self) -> str:
        return f"<MockAIProvider(model='{self.model}', available={self._is_available})>"

    def __str__(self) -> str:
        return self.__repr__()

    async def is_available(self) -> bool:
        """Return configured availability status."""
        return self._is_available

    async def generate_text(self, request: AIRequest) -> AIResponse:
        """Return deterministic mock response or raise simulated errors."""
        # Record safe call metadata (prompt & options, never secrets)
        self.call_history.append({
            "prompt": request.prompt,
            "system_instruction": request.system_instruction,
            "max_output_tokens": request.max_output_tokens,
        })

        if not self._is_available or self.simulate_unavailable:
            raise AIUnavailableError("Mock AI provider is currently unavailable.")

        if self.simulate_timeout:
            raise AITimeoutError("Mock AI provider simulated request timeout.")

        if self.simulate_malformed:
            raise AIMalformedResponseError("Mock AI provider simulated malformed response.")

        if self.simulate_error:
            raise AIProviderError("Mock AI provider simulated generic failure.")

        if self.echo_mode:
            content = f"Echo: {request.prompt}"
        else:
            content = self.default_response

        return AIResponse(
            content=content,
            model=self.model,
            finish_reason="STOP",
        )
