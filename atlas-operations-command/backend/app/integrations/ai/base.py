from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class AIRequest:
    """Request payload for AI provider text generation."""
    prompt: str
    system_instruction: Optional[str] = None
    max_output_tokens: Optional[int] = None


@dataclass
class AIResponse:
    """Sanitized response payload from an AI provider.
    
    Contains only clean generation results. Does NOT retain raw HTTP responses,
    headers, API keys, URLs, or full sensitive provider diagnostics.
    """
    content: str
    model: str
    finish_reason: Optional[str] = None


class AIProviderError(Exception):
    """Base exception for all AI provider operations."""
    pass


class AIConfigurationError(AIProviderError):
    """Raised when an AI provider is missing required configuration or credentials."""
    pass


class AIUnavailableError(AIProviderError):
    """Raised when an AI provider is unreachable or reports service unavailability."""
    pass


class AITimeoutError(AIProviderError):
    """Raised when an AI provider request exceeds the configured timeout."""
    pass


class AIMalformedResponseError(AIProviderError):
    """Raised when an AI provider response payload cannot be safely parsed."""
    pass


class BaseAIProvider(ABC):
    """Abstract base class defining the provider-independent AI interface."""

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the provider is properly configured and available."""
        pass

    @abstractmethod
    async def generate_text(self, request: AIRequest) -> AIResponse:
        """Generate text using the configured AI provider.
        
        Args:
            request: Standardized AIRequest containing prompt and options.
            
        Returns:
            AIResponse containing clean content and metadata.
            
        Raises:
            AIConfigurationError: If provider configuration/key is missing.
            AITimeoutError: If the upstream call exceeds timeout.
            AIMalformedResponseError: If the upstream response is invalid or missing candidate content.
            AIUnavailableError: If the provider is unreachable or not configured.
            AIProviderError: For upstream HTTP errors or unexpected failures.
        """
        pass
