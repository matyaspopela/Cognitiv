#!/usr/bin/env python3
"""
One-time cleanup script to merge and delete legacy devices.

Actions:
1. Merge esp12s_school_01 (4404 points) → ESP-Funkční (MAC: 24:4C:AB:46:A6:69)
2. Delete A2 (9 points)
3. Delete YOUR_DEVICE_ID (5 points)

Run from the server directory:
    python cleanup_devices.py
"""

import requests
import sys

# Configuration - change this to your server URL
LOCAL_URL = "http://localhost:8000"
RENDER_URL = "https://cognitiv.onrender.com"  # Change if different

# Use the URL you want
BASE_URL = LOCAL_URL  # Using localhost

ADMIN_USER = "gymzr_admin"

def make_request(method, endpoint, data=None):
    """Make an authenticated request to the API"""
    url = f"{BASE_URL}/api/{endpoint}"
    headers = {"X-Admin-User": ADMIN_USER}
    
    try:
        if method == "POST":
            response = requests.post(url, json=data, headers=headers)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        else:
            response = requests.get(url, headers=headers)
        
        return response.json()
    except requests.exceptions.ConnectionError:
        return {"status": "error", "message": f"Could not connect to {url}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def main():
    print("=" * 60)
    print("Device Cleanup Script")
    print("=" * 60)
    print(f"\nTarget server: {BASE_URL}")
    print("\nPlanned actions:")
    print("  1. MERGE: esp12s_school_01 (4404 points) → ESP-Funkční")
    print("  2. DELETE: A2 (9 points)")
    print("  3. DELETE: YOUR_DEVICE_ID (5 points)")
    print()
    
    confirm = input("Proceed? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("Cancelled.")
        sys.exit(0)
    
    print("\n" + "-" * 60)
    
    # Step 1: Merge esp12s_school_01 → ESP-Funkční
    print("\n[1/3] Merging esp12s_school_01 → ESP-Funkční...")
    result = make_request("POST", "admin/devices/merge", {
        "source_device_id": "esp12s_school_01",
        "target_mac": "24:4C:AB:46:A6:69"
    })
    if result.get("status") == "success":
        print(f"  ✓ Success! Migrated {result.get('migrated_data_points', 0)} data points")
    else:
        print(f"  ✗ Failed: {result.get('message', 'Unknown error')}")
    
    # Step 2: Delete A2
    print("\n[2/3] Deleting A2...")
    result = make_request("DELETE", "admin/devices/A2/delete")
    if result.get("status") == "success":
        print(f"  ✓ Success! Deleted {result.get('deleted_data_points', 0)} data points")
    else:
        print(f"  ✗ Failed: {result.get('message', 'Unknown error')}")
    
    # Step 3: Delete YOUR_DEVICE_ID
    print("\n[3/3] Deleting YOUR_DEVICE_ID...")
    result = make_request("DELETE", "admin/devices/YOUR_DEVICE_ID/delete")
    if result.get("status") == "success":
        print(f"  ✓ Success! Deleted {result.get('deleted_data_points', 0)} data points")
    else:
        print(f"  ✗ Failed: {result.get('message', 'Unknown error')}")
    
    print("\n" + "=" * 60)
    print("Cleanup complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()

