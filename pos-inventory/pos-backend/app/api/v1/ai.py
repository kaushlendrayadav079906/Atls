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
            current_user=current_user
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in AI chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to process chat request")
