# Feature: Input Sanitization (Pydantic)

**Priority:** High
**Status:** Spec
**Related:** `docs/specs/active/BACKEND_REFACTOR_PLAN_V2.md` Section 1.4

## Problem
Input validation is currently manual (`normalize_sensor_data`), fragile, and spread across helper functions. Malformed JSON or invalid data types can cause 500 errors or pollute the database.

## Proposed Solution
Adopt **Pydantic** for declarative data validation.

### 1. Schema Definition
Create `server/api/schemas.py`:

```python
from pydantic import BaseModel, Field, field_validator

class SensorData(BaseModel):
    mac_address: str = Field(..., pattern=r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$")
    co2: int = Field(..., ge=0, le=10000)
    temperature: float = Field(..., ge=-50, le=100)
    humidity: float = Field(..., ge=0, le=100)
    timestamp: Optional[datetime] = None
    
    @field_validator('mac_address')
    @classmethod
    def normalize_mac(cls, v):
        return v.upper().replace('-', ':')
```

### 2. Integration
- In `views.py` `receive_data`:
    ```python
    try:
        data = SensorData(**request_body)
    except ValidationError as e:
        return JsonResponse({"error": e.errors()}, status=400)
    ```

### Tasks
- [ ] Install `pydantic`.
- [ ] Create `schemas.py`.
- [ ] Define `SensorData` and `DeviceConfig` schemas.
- [ ] Refactor `receive_data` to use Pydantic.
