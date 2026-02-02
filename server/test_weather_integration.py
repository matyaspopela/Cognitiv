#!/usr/bin/env python
"""Test script to verify weather integration in annotation."""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'server.settings')
django.setup()

from pymongo import MongoClient
import certifi
from datetime import datetime, date, timedelta

# Get latest sensor reading date
client = MongoClient(os.getenv('MONGO_URI'), tlsCAFile=certifi.where())
db = client[os.getenv('MONGO_DB_NAME', 'cognitiv')]
sensor_coll = db['sensor_data_']

latest = sensor_coll.find_one(sort=[('timestamp', -1)])
if latest:
    latest_date = latest['timestamp'].date()
    print(f"Latest sensor data: {latest_date}")
    
    # Test annotation for that date
    from api.annotation.annotator import annotate_day
    print(f"\nRunning annotation for {latest_date}...")
    result = annotate_day(latest_date)
    print(f"\nAnnotation result: {result}")
    
    # Check if weather data was added
    if result['buckets_created'] > 0:
        annotated_coll = db['annotated_readings']
        sample = annotated_coll.find_one({'bucket_start': {'$gte': datetime.combine(latest_date, datetime.min.time())}})
        
        if sample:
            has_weather = 'weather' in sample.get('context', {})
            print(f"\n✓ Sample bucket has weather data: {has_weather}")
            if has_weather:
                weather = sample['context']['weather']
                print(f"  Weather: {weather}")
        else:
            print("\n⚠️ No buckets found for verification")
else:
    print("No sensor data found in database")
