"""
Test script to verify annotated API device resolution
"""
import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_annotated_summary():
    """Test annotated summary with legacy device ID"""
    print("Testing /api/annotated/summary with legacy ID 'ESP8266A2'...")
    
    params = {
        'device_id': 'ESP8266A2',
        'start': '2026-01-01T00:00:00Z',
        'end': '2026-02-28T23:59:59Z'
    }
    
    response = requests.get(f"{BASE_URL}/annotated/summary", params=params)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if data.get('status') == 'success':
            summary = data.get('summary', {})
            total_readings = summary.get('total_readings', 0)
            print(f"\n✓ SUCCESS: Found {total_readings} readings")
            return True
        else:
            print(f"\n✗ FAILED: {data.get('error', 'Unknown error')}")
            return False
    else:
        print(f"\n✗ FAILED: HTTP {response.status_code}")
        print(response.text)
        return False

def test_annotated_summary_with_mac():
    """Test annotated summary with MAC address"""
    print("\n\nTesting /api/annotated/summary with MAC '24:4C:AB:46:A6:69'...")
    
    params = {
        'device_id': '24:4C:AB:46:A6:69',
        'start': '2026-01-01T00:00:00Z',
        'end': '2026-02-28T23:59:59Z'
    }
    
    response = requests.get(f"{BASE_URL}/annotated/summary", params=params)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if data.get('status') == 'success':
            summary = data.get('summary', {})
            total_readings = summary.get('total_readings', 0)
            print(f"\n✓ SUCCESS: Found {total_readings} readings")
            return True
        else:
            print(f"\n✗ FAILED: {data.get('error', 'Unknown error')}")
            return False
    else:
        print(f"\n✗ FAILED: HTTP {response.status_code}")
        print(response.text)
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("ANNOTATED API DEVICE RESOLUTION TEST")
    print("=" * 60)
    
    test1 = test_annotated_summary()
    test2 = test_annotated_summary_with_mac()
    
    print("\n" + "=" * 60)
    if test1 and test2:
        print("✓ ALL TESTS PASSED")
    else:
        print("✗ SOME TESTS FAILED")
    print("=" * 60)
