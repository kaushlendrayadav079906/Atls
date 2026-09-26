from typing import Optional
from app.core.config import settings
from app.integrations.ai.base import BaseAIProvider
from app.integrations.ai.gemini import GeminiAIProvider
from app.integrations.ai.mock import MockAIProvider


def get_ai_provider(
    provider_type: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    timeout_seconds: Optional[int] = None,
) -> BaseAIProvider:
    """Factory to instantiate the appropriate AI Provider based on settings.
    
    Rules:
    - If provider_type is explicitly 'mock' (or settings.AI_PROVIDER == 'mock'), returns MockAIProvider.
    - If provider_type is 'gemini' (or settings.AI_PROVIDER == 'gemini', default):
      Returns GeminiAIProvider initialized with the configured key/model/timeout.
      If GEMINI_API_KEY is missing, returns GeminiAIProvider(api_key=None), which:
        - reports is_available() == False
        - raises AIConfigurationError on generate_text()
      NEVER silently falls back to MockAIProvider when Gemini configuration is missing.
    """
    chosen_provider = (provider_type or settings.AI_PROVIDER).strip().lower()

    if chosen_provider == "mock":
        return MockAIProvider(model=model or "mock-model")

    if chosen_provider == "gemini":
        return GeminiAIProvider(
            api_key=api_key if api_key is not None else settings.GEMINI_API_KEY,
            model=model if model is not None else settings.GEMINI_MODEL,
            timeout_seconds=timeout_seconds if timeout_seconds is not None else settings.GEMINI_TIMEOUT_SECONDS,
        )

    raise ValueError(f"Unknown AI_PROVIDER: '{chosen_provider}'. Expected 'gemini' or 'mock'.")
