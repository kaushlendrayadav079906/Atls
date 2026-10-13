from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
import logging

from app.core.security import get_current_user
from app.services.ai_service import AIAssistantService
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    branch_id: str
    conversation_id: Optional[str] = None
    history: Optional[List[ChatMessage]] = None
    context: Optional[Dict[str, Any]] = None

@router.post("/chat")
def chat_with_assistant(
    request: ChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        service = AIAssistantService()
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history] if request.history else None
        response = service.process_chat(
            message=request.message,
            branch_id=request.branch_id,
            conversation_id=request.conversation_id,
            history=history_dicts,
            current_user=current_user,
            context=request.context
        )
        return response
    except TimeoutError as e:
        logger.error(f"Timeout in AI chat: {e}")
        raise HTTPException(status_code=504, detail="AI request timed out. Please try again.")
    except ValueError as e:
        detail = str(e)
        logger.warning(f"Validation or quota issue in AI chat: {detail}")
        if "quota exhausted" in detail or "credits" in detail:
            raise HTTPException(status_code=402, detail=detail)
        raise HTTPException(status_code=400, detail=detail)
    except Exception as e:
        logger.error(f"Error in AI chat: {e}")
        detail_msg = str(e) if str(e).startswith("AI service error:") else "Failed to process chat request."
        raise HTTPException(status_code=500, detail=detail_msg)
