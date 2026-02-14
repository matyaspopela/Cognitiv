"""
Data Service - Business logic for sensor data management
Handles data ingestion, validation, normalization, and retrieval
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timezone
import os

from ..db import get_mongo_collection


class DataService:
    """Service for managing sensor data"""
    
    @staticmethod
    def normalize_sensor_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize incoming sensor data to standardized keys.
        
        Args:
            data: Raw sensor data
        
        Returns:
            Normalized sensor data
        
        Raises:
            KeyError: If required fields are missing
        """
        normalized = {}
        
        try:
            normalized['timestamp'] = data['timestamp']
        except KeyError as exc:
            raise KeyError(f"Missing required field: {exc.args[0]}")
        
        # Optional device_id (legacy)
        if 'device_id' in data:
            normalized['device_id'] = data['device_id']
        
        # Required mac_address (new standard)
        if 'mac_address' in data:
            normalized['mac_address'] = data['mac_address']
        
        # Extract temperature (support both 'temperature' and legacy 'temp_scd41' keys)
        temperature = data.get('temperature') or data.get('temp_scd41')
        humidity = data.get('humidity') or data.get('humidity_scd41')
        
        if temperature is None:
            raise KeyError("temperature")
        if humidity is None:
            raise KeyError("humidity")
        
        normalized['temperature'] = temperature
        normalized['humidity'] = humidity
        
        if 'co2' not in data:
            raise KeyError("co2")
        normalized['co2'] = data['co2']
        
        return normalized
    
    @staticmethod
    def validate_sensor_data(data: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Validate sensor data ranges and types.
        
        Args:
            data: Normalized sensor data
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        required_fields = ['timestamp', 'mac_address', 'temperature', 'humidity', 'co2']
        
        # Check required fields
        for field in required_fields:
            if field not in data:
                return False, f"Missing required field: {field}"
        
        # Validate data ranges
        try:
            temperature = float(data['temperature'])
            humidity = float(data['humidity'])
            co2 = int(data['co2'])
            
            # Temperature range: -10°C to 50°C
            if not (-10 <= temperature <= 50):
                return False, "Temperature out of range (-10 to 50 °C)"
            
            # Humidity range: 0% to 100%
            if not (0 <= humidity <= 100):
                return False, "Humidity out of range (0 to 100 %)"
            
            # CO2 range: 400 to 5000 ppm (normal indoor range)
            if not (400 <= co2 <= 5000):
                return False, "CO₂ out of range (400 to 5000 ppm)"
            
            return True, "Valid"
        
        except (ValueError, TypeError) as e:
            return False, f"Invalid data type: {str(e)}"
    
    @staticmethod
    def ingest_data(sensor_data: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Process and store sensor data.
        
        Args:
            sensor_data: Normalized and validated sensor data
        
        Returns:
            Tuple of (success, message)
        """
        try:
            collection = get_mongo_collection()
            
            # Check if timeseries collection
            db = collection.database
            collection_info = db.command('listCollections', filter={'name': collection.name})
            is_timeseries = any('timeseries' in info.get('options', {}) 
                              for info in collection_info['cursor']['firstBatch'])
            
            # Prepare document
            if is_timeseries:
                # Timeseries format: metadata field
                doc = {
                    'timestamp': sensor_data['timestamp'],
                    'temperature': sensor_data['temperature'],
                    'humidity': sensor_data['humidity'],
                    'co2': sensor_data['co2'],
                    'metadata': {}
                }
                if 'mac_address' in sensor_data:
                    doc['metadata']['mac_address'] = sensor_data['mac_address']
                if 'device_id' in sensor_data:
                    doc['metadata']['device_id'] = sensor_data['device_id']
            else:
                # Regular format
                doc = sensor_data.copy()
            
            collection.insert_one(doc)
            return True, "Data stored successfully"
        
        except Exception as e:
            print(f"[ERROR] Data ingestion failed: {e}")
            return False, f"Storage error: {str(e)}"
    
    @staticmethod
    def get_latest_reading(mac_address: str) -> Optional[Dict[str, Any]]:
        """
        Get the most recent reading for a device.
        
        Args:
            mac_address: Device MAC address
        
        Returns:
            Latest reading document or None
        """
        try:
            collection = get_mongo_collection()
            
            # Try timeseries format first
            reading = collection.find_one(
                {'metadata.mac_address': mac_address},
                sort=[('timestamp', -1)]
            )
            
            # Fallback to regular format
            if not reading:
                reading = collection.find_one(
                    {'mac_address': mac_address},
                    sort=[('timestamp', -1)]
                )
            
            return reading
        except Exception as e:
            print(f"[ERROR] Failed to get latest reading: {e}")
            return None
