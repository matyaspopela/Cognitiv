"""
Pydantic Schemas for Input Validation
Provides strict type validation and automatic data normalization
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from datetime import datetime
from typing import Optional


class SensorDataSchema(BaseModel):
    """
    Schema for sensor data ingestion.
    Validates and normalizes incoming sensor readings.
    """
    
    model_config = ConfigDict(str_strip_whitespace=True)
    
    mac_address: str = Field(
        ..., 
        min_length=12, 
        max_length=17,
        description="Device MAC address in any format (AA:BB:CC:DD:EE:FF, aa-bb-cc-dd-ee-ff, or aabbccddeeff)"
    )
    co2: int = Field(
        ..., 
        ge=400, 
        le=5000,
        description="CO2 concentration in ppm (400-5000)"
    )
    temperature: float = Field(
        ..., 
        ge=-50, 
        le=100,
        description="Temperature in Celsius (-50 to 100)"
    )
    humidity: float = Field(
        ..., 
        ge=0, 
        le=100,
        description="Relative humidity percentage (0-100)"
    )
    timestamp: Optional[datetime] = Field(
        default=None,
        description="Measurement timestamp (UTC). Auto-generated if not provided."
    )
    device_id: Optional[str] = Field(
        default=None,
        description="Legacy device identifier (optional)"
    )
    
    @field_validator('mac_address')
    @classmethod
    def normalize_mac(cls, v: str) -> str:
        """Normalize MAC address to uppercase colon-separated format"""
        from api.services import DeviceService
        try:
            return DeviceService.normalize_mac_address(v)
        except ValueError as e:
            raise ValueError(f"Invalid MAC address format: {e}")
    
    @field_validator('timestamp', mode='before')
    @classmethod
    def set_default_timestamp(cls, v):
        """Set current UTC time if timestamp not provided"""
        if v is None:
            from datetime import timezone
            return datetime.now(timezone.utc)
        return v


class AdminLoginSchema(BaseModel):
    """Schema for admin login requests"""
    
    model_config = ConfigDict(str_strip_whitespace=True)
    
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1)


class DeviceRenameSchema(BaseModel):
    """Schema for device rename requests"""
    
    model_config = ConfigDict(str_strip_whitespace=True)
    
    display_name: str = Field(..., min_length=1, max_length=100)


class WhitelistUpdateSchema(BaseModel):
    """Schema for whitelist status updates"""
    
    whitelisted: bool = Field(...)
