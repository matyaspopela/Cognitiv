#!/usr/bin/env python3
import os
import csv
import sys
from datetime import datetime
from dotenv import load_dotenv
from pymongo import MongoClient

def main():
    # Load environment variables
    load_dotenv()

    # Get MongoDB URI
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        print("Error: MONGO_URI not found in environment variables.")
        sys.exit(1)

    try:
        # Connect to MongoDB
        client = MongoClient(mongo_uri)
        db = client["cognitiv"]
        collection = db["sensor_data_"]

        # Define output file
        output_file = "sensor_data_export.csv"
        
        print(f"Connected to MongoDB. Exporting data from {collection.full_name}...")

        # Count documents to give progress info
        total_docs = collection.count_documents({})
        print(f"Found {total_docs} documents.")

        # Query projection
        projection = {
            "timestamp": 1,
            "co2": 1,
            "temperature": 1,
            "humidity": 1,
            "_id": 0
        }

        # Open CSV file for writing
        with open(output_file, 'w', newline='') as csvfile:
            fieldnames = ['timestamp', 'co2', 'temperature', 'humidity']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            writer.writeheader()

            cursor = collection.find({}, projection).sort("timestamp", 1)
            
            count = 0
            for doc in cursor:
                # Handle potential missing fields gracefully
                row = {
                    'timestamp': doc.get('timestamp', ''),
                    'co2': doc.get('co2', ''),
                    'temperature': doc.get('temperature', ''),
                    'humidity': doc.get('humidity', '')
                }
                
                # Format timestamp if it's a datetime object
                if isinstance(row['timestamp'], datetime):
                    row['timestamp'] = row['timestamp'].isoformat()
                
                writer.writerow(row)
                count += 1
                
                if count % 1000 == 0:
                    print(f"Exported {count} records...", end='\r')

        print(f"\nExport complete! {count} records written to {output_file}")

    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    main()
