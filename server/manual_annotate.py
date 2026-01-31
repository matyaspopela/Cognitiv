import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add current directory to path to ensure api imports work
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

# Load .env file from project root
env_path = current_dir.parent / '.env'
if env_path.exists():
    load_dotenv(env_path, override=True)
    print(f"[INFO] Loaded environment from {env_path}")
else:
    print(f"[WARN] No .env file found at {env_path}")
    print("[INFO] relying on existing environment variables")

try:
    from api.annotation.annotator import annotate_today, get_mongo_db_name, get_mongo_uri
except ImportError as e:
    print(f"[ERROR] Could not import annotation module: {e}")
    print("Ensure you are running this script from the 'server' directory.")
    sys.exit(1)

def main():
    db_name = get_mongo_db_name()
    uri = get_mongo_uri()
    
    # Mask password for display
    uri_display = uri
    if '@' in uri:
        parts = uri.split('@')
        if '://' in parts[0]:
            scheme_auth = parts[0].split('://')
            if ':' in scheme_auth[1]:
                user = scheme_auth[1].split(':')[0]
                uri_display = f"{scheme_auth[0]}://{user}:***@{parts[1]}"
    
    print("\n" + "="*50)
    print("MANUAL CO2 ANNOTATION TOOL")
    print("="*50)
    print(f"Database:   {db_name}")
    print(f"URI:        {uri_display}")
    print("="*50)
    
    if db_name == 'cognitiv':
        print("\n⚠️  WARNING: You are calculating stats for the PRODUCTION database.")
    else:
        print("\nRunning in DEVELOPMENT mode.")
        
    print("\nThis will:")
    print("1. Fetch today's timetable from Bakalari API")
    print("2. Fetch today's sensor readings from MongoDB")
    print("3. Annotate readings with lesson/subject info")
    print("4. Generate hourly buckets for the dashboard")
    
    confirm = input("\nDo you want to proceed? (y/N): ")
    if confirm.lower() != 'y':
        print("Aborted.")
        sys.exit(0)

    try:
        print("\nStarting annotation...")
        summary = annotate_today()
        
        print("\n" + "="*50)
        print("ANNOTATION SUCCESSFUL")
        print("="*50)
        print(f"Date:            {summary.get('date')}")
        print(f"Total Readings:  {summary.get('total_readings')}")
        print(f"Rooms Processed: {summary.get('rooms_annotated')}")
        print(f"Buckets Created: {summary.get('buckets_created')}")
        print("="*50)
        
    except Exception as e:
        print(f"\n[ERROR] Annotation failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
