from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash, VerificationError

# Initialize the Argon2 hasher
# Using the defaults configures argon2id securely.
ph = PasswordHasher()

def hash_password(password: str) -> str:
    """
    Hashes a password using Argon2id with a secure random salt.
    """
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against an Argon2id hashed password.
    Returns True if it matches, False otherwise (including malformed hashes).
    """
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHash, VerificationError):
        return False
