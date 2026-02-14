"""
Auth Service - Authentication and authorization logic
Handles API key management and admin authentication
"""

from typing import Optional
import hashlib
import secrets


class AuthService:
    """Service for authentication and authorization"""
    
    @staticmethod
    def generate_api_key() -> str:
        """
        Generate a secure API key.
        
        Returns:
            32-character hexadecimal API key
        """
        return secrets.token_hex(16)
    
    @staticmethod
    def hash_api_key(api_key: str) -> str:
        """
        Hash an API key for storage.
        
        Args:
            api_key: Plain API key
        
        Returns:
            SHA256 hash of the API key
        """
        return hashlib.sha256(api_key.encode()).hexdigest()
    
    @staticmethod
    def verify_api_key(provided_key: str, stored_hash: str) -> bool:
        """
        Verify an API key against its stored hash.
        
        Args:
            provided_key: API key provided by client
            stored_hash: Stored hash from database
        
        Returns:
            True if key matches, False otherwise
        """
        if not provided_key or not stored_hash:
            return False
        
        provided_hash = AuthService.hash_api_key(provided_key)
        return secrets.compare_digest(provided_hash, stored_hash)
    
    @staticmethod
    def get_api_key_prefix(api_key: str) -> str:
        """
        Get the first 8 characters of an API key for identification.
        
        Args:
            api_key: Full API key
        
        Returns:
            First 8 characters
        """
        return api_key[:8] if len(api_key) >= 8 else api_key
