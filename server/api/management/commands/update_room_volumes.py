"""
Django management command to update all room volume values to NULL (placeholder).

Usage:
    python manage.py update_room_volumes [--dry-run] [--no-confirm]
"""

from django.core.management.base import BaseCommand
from pymongo import MongoClient
import certifi
import os
from datetime import datetime, timezone

UTC = timezone.utc
TARGET_VOLUME = None  # We want to set it to NULL


class Command(BaseCommand):
    help = 'Update all room volume values to NULL (placeholder) in MongoDB'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without applying them',
        )
        parser.add_argument(
            '--no-confirm',
            action='store_true',
            help='Skip confirmation prompt (use with caution)',
        )

    def get_mongo_connection(self):
        """Establish MongoDB connection."""
        mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
        db_name = os.getenv('MONGO_DB_NAME', 'cognitiv')
        
        self.stdout.write(f"Connecting to MongoDB...")
        self.stdout.write(f"Database: {db_name}")
        
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
            tlsCAFile=certifi.where(),
            tz_aware=True,
            tzinfo=UTC,
        )
        
        # Test connection
        client.admin.command('ping')
        self.stdout.write(self.style.SUCCESS("✓ Connected successfully\n"))
        
        return client[db_name]

    def find_rooms_to_update(self, collection):
        """Find ALL rooms to set their volume to NULL."""
        # We want to update all rooms that don't already have volume explicitly set to None (or missing)
        # But for consistency, we can just target ALL rooms to ensure they are all NULL.
        # Logic: Find all rooms.
        return list(collection.find({}))

    def display_rooms(self, rooms):
        """Display rooms that will be updated."""
        if not rooms:
            self.stdout.write("No rooms found.")
            return
        
        self.stdout.write(f"\nFound {len(rooms)} room(s) to set to NULL volume:\n")
        self.stdout.write(f"{'Room ID':<15} {'Label':<25} {'Current Volume':<15}")
        self.stdout.write("-" * 55)
        
        for room in rooms:
            room_id = room.get('_id', 'N/A')
            label = room.get('label', 'N/A')
            volume = room.get('volume_m3', 'NULL/Missing')
            self.stdout.write(f"{room_id:<15} {label:<25} {str(volume):<15}")
        
        self.stdout.write("")

    def update_rooms(self, collection, rooms, dry_run=False):
        """Update room volumes to NULL."""
        if not rooms:
            return 0
        
        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"[DRY RUN] Would update {len(rooms)} room(s) to volume_m3 = NULL"
            ))
            return 0
        
        updated_count = 0
        failed_updates = []
        
        self.stdout.write(f"\nUpdating {len(rooms)} room(s)...")
        
        for room in rooms:
            room_id = room.get('_id')
            try:
                result = collection.update_one(
                    {'_id': room_id},
                    {
                        '$set': {
                            'volume_m3': TARGET_VOLUME,
                            'last_modified': datetime.now(UTC)
                        }
                    }
                )
                
                if result.acknowledged: # update_one always returns result even if modified_count=0 when setting to same value
                    updated_count += 1
                    self.stdout.write(self.style.SUCCESS(f"  ✓ Updated {room_id}"))
                else:
                    self.stdout.write(self.style.WARNING(f"  ⚠ Not acknowledged for {room_id}"))
            except Exception as e:
                failed_updates.append((room_id, str(e)))
                self.stdout.write(self.style.ERROR(f"  ✗ Failed to update {room_id}: {e}"))
        
        self.stdout.write(f"\nSuccessfully processed: {updated_count}/{len(rooms)}")
        
        if failed_updates:
            self.stdout.write(self.style.ERROR(f"\nFailed updates ({len(failed_updates)}):"))
            for room_id, error in failed_updates:
                self.stdout.write(f"  - {room_id}: {error}")
        
        return updated_count

    def verify_updates(self, collection):
        """Verify that all rooms have NULL volume."""
        self.stdout.write("\nVerifying updates...")
        
        # Find any room where volume_m3 is NOT null
        # In Mongo: $ne: null check exists and is not null.
        # Actually easier: volume_m3: {$ne: None}
        
        remaining = list(collection.find({'volume_m3': {'$ne': None}}))
        
        if remaining:
            self.stdout.write(self.style.WARNING(
                f"⚠ Warning: {len(remaining)} room(s) still have non-NULL volume values:"
            ))
            self.display_rooms(remaining)
            return False
        else:
            self.stdout.write(self.style.SUCCESS("✓ All rooms now have NULL volume values"))
            return True

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        no_confirm = options['no_confirm']
        
        self.stdout.write("=" * 60)
        self.stdout.write("Room Volume reset to NULL Command")
        self.stdout.write("=" * 60)
        self.stdout.write("")
        
        try:
            # Connect to database
            db = self.get_mongo_connection()
            collection = db['room_definitions']
            
            # Find rooms to update
            rooms_to_update = self.find_rooms_to_update(collection)
            self.display_rooms(rooms_to_update)
            
            if not rooms_to_update:
                self.stdout.write(self.style.SUCCESS("No rooms found to update. Exiting."))
                return
            
            # Confirmation prompt (unless --no-confirm or --dry-run)
            if not dry_run and not no_confirm:
                response = input(f"\nUpdate {len(rooms_to_update)} room(s) to volume_m3 = NULL? THIS IS DESTRUCTIVE. (yes/no): ")
                if response.lower() not in ['yes', 'y']:
                    self.stdout.write(self.style.WARNING("Update cancelled."))
                    return
            
            # Perform update
            updated_count = self.update_rooms(collection, rooms_to_update, dry_run=dry_run)
            
            # Verify updates (skip for dry-run)
            if not dry_run:
                self.verify_updates(collection)
            
            self.stdout.write("\n" + "=" * 60)
            if dry_run:
                self.stdout.write(self.style.WARNING("DRY RUN COMPLETE - No changes were made"))
            else:
                self.stdout.write(self.style.SUCCESS(f"UPDATE COMPLETE - {updated_count} room(s) processed"))
            self.stdout.write("=" * 60)
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n✗ Error: {e}"))
            import traceback
            traceback.print_exc()
            raise
