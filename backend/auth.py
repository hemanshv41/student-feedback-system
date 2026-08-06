import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models

# Security configurations
SECRET_KEY = os.getenv("SECRET_KEY", "7d3a8a9a4b2c8f8e0d6c5b4a3f2e1d0c")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day for local dev ease

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Cryptographically secure PBKDF2 hashing for passwords
def get_password_hash(password: str) -> str:
    """Hash a password using PBKDF2 SHA256 with a random salt."""
    salt = secrets.token_hex(16)
    pwd_bytes = password.encode('utf-8')
    salt_bytes = salt.encode('utf-8')
    iterations = 100000
    
    hashed = hashlib.pbkdf2_hmac('sha256', pwd_bytes, salt_bytes, iterations)
    # Store iterations, salt, and hash separated by '$'
    return f"pbkdf2_sha256${iterations}${salt}${hashed.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against the stored PBKDF2 hash."""
    try:
        if not hashed_password.startswith("pbkdf2_sha256$"):
            return False
            
        parts = hashed_password.split('$')
        if len(parts) != 4:
            return False
            
        _, iterations_str, salt, stored_hash = parts
        iterations = int(iterations_str)
        
        pwd_bytes = plain_password.encode('utf-8')
        salt_bytes = salt.encode('utf-8')
        
        hashed = hashlib.pbkdf2_hmac('sha256', pwd_bytes, salt_bytes, iterations)
        return secrets.compare_digest(hashed.hex(), stored_hash)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is blocked. Access denied."
        )
    return user

def get_current_active_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted. Admin role required."
        )
    return current_user
