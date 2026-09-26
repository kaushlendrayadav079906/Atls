from typing import Optional, Dict, Any
import httpx

from app.integrations.ai.base import (
    BaseAIProvider,
    AIRequest,
    AIResponse,
    AIProviderError,
    AIConfigurationError,
    AITimeoutError,
    AIMalformedResponseError,
)


class GeminiAIProvider(BaseAIProvider):
    """Google Gemini AI provider implementation using direct REST API via httpx.
    
    Security & Safety guarantees:
    - Never places the API key in the URL query string.
    - Uses 'x-goog-api-key' request header.
    - Sanitizes __repr__ and __str__ to prevent accidental key exposure in logs/traces.
    - Never includes raw response bodies, full URLs, headers, or keys in exception messages.
    """

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-3.6-flash",
        timeout_seconds: int = 30,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self._api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._client = http_client

    def __repr__(self) -> str:
        key_status = "set" if self._api_key else "unset"
        return f"<GeminiAIProvider(model='{self.model}', timeout={self.timeout_seconds}s, api_key={key_status})>"

    def __str__(self) -> str:
        return self.__repr__()

    async def is_available(self) -> bool:
        """Check if Gemini provider is configured with an API key."""
        return bool(self._api_key and self._api_key.strip())

    def _build_payload(self, request: AIRequest) -> Dict[str, Any]:
        """Format AIRequest into Gemini REST API payload.
        
        Deprecated parameters such as temperature, top_p, and top_k are excluded.
        """
        payload: Dict[str, Any] = {
            "contents": [
                {
                    "parts": [
                        {"text": request.prompt}
                    ]
                }
            ]
        }

        if request.system_instruction:
            payload["systemInstruction"] = {
                "parts": [
                    {"text": request.system_instruction}
                ]
            }

        generation_config: Dict[str, Any] = {}
        if request.max_output_tokens is not None:
            generation_config["maxOutputTokens"] = request.max_output_tokens

        if generation_config:
            payload["generationConfig"] = generation_config

        return payload

    async def generate_text(self, request: AIRequest) -> AIResponse:
        """Generate text from Gemini REST API endpoint."""
        if not await self.is_available():
            raise AIConfigurationError("Gemini API key is not configured.")

        url = self.BASE_URL.format(model=self.model)
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self._api_key,  # type: ignore
        }
        payload = self._build_payload(request)

        try:
            if self._client is not None:
                response = await self._client.post(
                    url,
                    headers=headers,
                    json=payload,
                    timeout=self.timeout_seconds,
                )
            else:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    response = await client.post(
                        url,
                        headers=headers,
                        json=payload,
                    )
        except httpx.TimeoutException as e:
            raise AITimeoutError(f"Gemini provider request timed out after {self.timeout_seconds}s") from None
        except httpx.RequestError as e:
            raise AIProviderError("Gemini provider network request failed") from None
        except Exception as e:
            if isinstance(e, (AITimeoutError, AIConfigurationError, AIMalformedResponseError, AIProviderError)):
                raise
            raise AIProviderError("Unexpected error during Gemini provider request") from None

        if response.status_code != 200:
            status_code = response.status_code
            raise AIProviderError(f"Gemini provider returned HTTP {status_code}")

        try:
            data = response.json()
        except Exception:
            raise AIMalformedResponseError("Gemini provider returned invalid JSON")

        return self._parse_response(data)

    def _parse_response(self, data: Dict[str, Any]) -> AIResponse:
        """Safely parse Gemini response data into AIResponse."""
        candidates = data.get("candidates")
        if not candidates or not isinstance(candidates, list) or len(candidates) == 0:
            raise AIMalformedResponseError("Gemini provider response missing candidates")

        first_candidate = candidates[0]
        if not isinstance(first_candidate, dict):
            raise AIMalformedResponseError("Gemini provider response has invalid candidate structure")

        content_obj = first_candidate.get("content")
        if not content_obj or not isinstance(content_obj, dict):
            raise AIMalformedResponseError("Gemini provider response missing candidate content")

        parts = content_obj.get("parts")
        if not parts or not isinstance(parts, list) or len(parts) == 0:
            raise AIMalformedResponseError("Gemini provider response missing content parts")

        first_part = parts[0]
        if not isinstance(first_part, dict) or "text" not in first_part:
            raise AIMalformedResponseError("Gemini provider response missing text part")

        text = first_part["text"]
        if not isinstance(text, str):
            raise AIMalformedResponseError("Gemini provider response returned non-string text")

        finish_reason = first_candidate.get("finishReason")
        if finish_reason is not None and not isinstance(finish_reason, str):
            finish_reason = str(finish_reason)

        return AIResponse(
            content=text,
            model=self.model,
            finish_reason=finish_reason,
        )
