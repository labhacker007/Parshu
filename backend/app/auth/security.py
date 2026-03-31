import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

# Use pbkdf2_sha256 as primary (no native dependencies required)
# Support legacy schemes for backward compatibility with existing passwords
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt", "argon2"],  # pbkdf2_sha256 first for portability
    deprecated=["bcrypt", "argon2"],  # Other schemes deprecated if not available
    pbkdf2_sha256__rounds=320000,  # High iteration count for security
)

# Used to reduce timing side-channels during login (verify even when user doesn't exist).
# Computed once at import to avoid expensive hashing per request.
DUMMY_PASSWORD_HASH = pwd_context.hash("dummy-password-not-used")


def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-SHA256 to avoid native bcrypt dependencies in some environments."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with enhanced security claims."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    
    # Add security claims
    to_encode.update({
        "exp": expire,
        "iat": now,  # Issued at
        "nbf": now,  # Not before
        "jti": secrets.token_urlsafe(32),  # JWT ID for tracking/revocation
        "iss": settings.APP_NAME,  # Issuer
        "aud": "jyoti-api",  # Audience
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token with enhanced security."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRATION_DAYS)
    
    to_encode.update({
        "exp": expire,
        "iat": now,
        "nbf": now,
        "type": "refresh",
        "jti": secrets.token_urlsafe(32),
        "iss": settings.APP_NAME,
        "aud": "jyoti-api"
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    """Decode and verify a JWT token with enhanced validation."""
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM],
            audience="jyoti-api",  # Validate audience
            issuer=settings.APP_NAME,  # Validate issuer
            options={
                "verify_exp": True,
                "verify_iat": True,
                "verify_nbf": True,
                "verify_aud": True,
                "verify_iss": True,
            }
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.JWTClaimsError as e:
        raise ValueError(f"Invalid token claims: {str(e)}")
    except jwt.JWTError as e:
        raise ValueError(f"Invalid token: {str(e)}")


def generate_otp_secret() -> str:
    """Generate a base32-encoded OTP secret (TOTP)."""
    import pyotp
    return pyotp.random_base32()


def verify_totp(secret: str, code: str) -> bool:
    """Verify a TOTP code."""
    import pyotp
    totp = pyotp.TOTP(secret)
    return totp.verify(code)
