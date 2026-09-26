import jwt
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.core.config import settings
from app.core.exceptions import UnauthenticatedException

def create_access_token(user_id: UUID, company_id: UUID) -> str:
    """
    Creates a standard JWT access token containing the required claims.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": str(user_id),
        "company_id": str(company_id),
        "iat": now,
        "exp": expire
    }
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET_KEY, 
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """
    Decodes the JWT access token and verifies its signature, expiration, and algorithms.
    Raises UnauthenticatedException if invalid.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Verify required claims exist
        if "sub" not in payload:
            raise UnauthenticatedException(detail="Token missing 'sub' claim")
        if "company_id" not in payload:
            raise UnauthenticatedException(detail="Token missing 'company_id' claim")
            
        return payload
    except jwt.ExpiredSignatureError:
        raise UnauthenticatedException(detail="Token has expired")
    except jwt.InvalidTokenError:
        raise UnauthenticatedException(detail="Invalid token")
