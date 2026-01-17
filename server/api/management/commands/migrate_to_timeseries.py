"""
Django management command to migrate data from regular collection to timeseries collection

Usage:
    python manage.py migrate_to_timeseries [--old-collection SENSOR_DATA] [--new-collection SENSOR_DATA_]
    
This command:
1. Reads all documents from the old collection
2. Transforms them to timeseries format (with metadata field)
3. Inserts them into the new timeseries collection
4. Handles duplicates and errors gracefully
"""

import os
from django.core.management.base import BaseCommand, CommandError
from pymongo import MongoClient, ASCENDING
from pymongo.errors import PyMongoError, BulkWriteError
import certifi
from datetime import datetime, timezone

from api.views import get_mongo_uri, get_mongo_db_name


class Command(BaseCommand):
    help = 'Migrate data from regular MongoDB collection to timeseries collection'

    def add_arguments(self, parser):
        parser.add_argument(
            '--old-collection',
            type=str,
            default='sensor_data',
            help='Name of the old collection to migrate from (default: sensor_data)'
        )
        parser.add_argument(
            '--new-collection',
            type=str,
            default='sensor_data_',
            help='Name of the new timeseries collection (default: sensor_data_)'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=1000,
            help='Number of documents to process per batch (default: 1000)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be migrated without actually migrating'
        )

    def handle(self, *args, **options):
        old_collection_name = options['old_collection']
        new_collection_name = options['new_collection']
        batch_size = options['batch_size']
        dry_run = options['dry_run']

        self.stdout.write('=' * 60)
        self.stdout.write('MongoDB Timeseries Migration')
        self.stdout.write('=' * 60)
        self.stdout.write(f'Old collection: {old_collection_name}')
        self.stdout.write(f'New collection: {new_collection_name}')
        self.stdout.write(f'Batch size: {batch_size}')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No data will be migrated'))
        self.stdout.write('')

        # Get MongoDB connection
        mongo_uri = get_mongo_uri()
        mongo_db_name = get_mongo_db_name()

        if not mongo_uri:
            raise CommandError('MONGO_URI environment variable is not set')

        try:
            # Connect to MongoDB
            client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=10000,
                tlsCAFile=certifi.where(),
                tz_aware=True,
                tzinfo=timezone.utc,
            )
            client.admin.command('ping')
            db = client[mongo_db_name]

            # Get collections
            old_collection = db[old_collection_name]
            new_collection = db[new_collection_name]

            # Check if old collection exists
            if old_collection_name not in db.list_collection_names():
                raise CommandError(f'Old collection "{old_collection_name}" does not exist')

            # Check if new collection is timeseries
            collection_info = db.command('listCollections', filter={'name': new_collection_name})
            is_timeseries = False
            for info in collection_info['cursor']['firstBatch']:
                if 'timeseries' in info.get('options', {}):
                    is_timeseries = True
                    break

            if not is_timeseries:
                self.stdout.write(self.style.WARNING(
                    f'⚠️  Warning: "{new_collection_name}" does not appear to be a timeseries collection'
                ))
                response = input('Continue anyway? (y/n): ')
                if response.lower() != 'y':
                    self.stdout.write('Migration cancelled.')
                    return

            # Count documents in old collection
            total_count = old_collection.count_documents({})
            self.stdout.write(f'Total documents to migrate: {total_count}')
            self.stdout.write('')

            if total_count == 0:
                self.stdout.write(self.style.SUCCESS('No documents to migrate.'))
                return

            if dry_run:
                # Just show a sample of what would be migrated
                self.stdout.write('Sample documents (first 3):')
                sample = list(old_collection.find({}).limit(3))
                for i, doc in enumerate(sample, 1):
                    transformed = self._transform_document(doc)
                    self.stdout.write(f'\nDocument {i}:')
                    self.stdout.write(f'  Original: device_id={doc.get("device_id")}, mac_address={doc.get("mac_address")}')
                    self.stdout.write(f'  Transformed: metadata.device_id={transformed.get("metadata", {}).get("device_id")}, metadata.mac_address={transformed.get("metadata", {}).get("mac_address")}')
                self.stdout.write(f'\n{total_count - 3} more documents would be migrated.')
                return

            # Migrate documents in batches
            migrated_count = 0
            skipped_count = 0
            error_count = 0

            cursor = old_collection.find({}).sort('timestamp', 1)  # Process in chronological order
            batch = []

            self.stdout.write('Starting migration...')
            self.stdout.write('')

            for doc in cursor:
                # Transform document to timeseries format
                transformed_doc = self._transform_document(doc)
                batch.append(transformed_doc)

                if len(batch) >= batch_size:
                    result = self._insert_batch(new_collection, batch)
                    migrated_count += result['inserted']
                    skipped_count += result['skipped']
                    error_count += result['errors']
                    batch = []

                    # Show progress
                    progress = migrated_count + skipped_count + error_count
                    percent = (progress / total_count) * 100
                    self.stdout.write(
                        f'Progress: {progress}/{total_count} ({percent:.1f}%) - '
                        f'Migrated: {migrated_count}, Skipped: {skipped_count}, Errors: {error_count}'
                    )

            # Process remaining documents
            if batch:
                result = self._insert_batch(new_collection, batch)
                migrated_count += result['inserted']
                skipped_count += result['skipped']
                error_count += result['errors']

            # Final summary
            self.stdout.write('')
            self.stdout.write('=' * 60)
            self.stdout.write(self.style.SUCCESS('Migration completed!'))
            self.stdout.write('=' * 60)
            self.stdout.write(f'Total documents processed: {total_count}')
            self.stdout.write(self.style.SUCCESS(f'✓ Migrated: {migrated_count}'))
            if skipped_count > 0:
                self.stdout.write(self.style.WARNING(f'⚠ Skipped (duplicates): {skipped_count}'))
            if error_count > 0:
                self.stdout.write(self.style.ERROR(f'✗ Errors: {error_count}'))
            self.stdout.write('')

        except PyMongoError as e:
            raise CommandError(f'MongoDB error: {e}')
        except Exception as e:
            raise CommandError(f'Unexpected error: {e}')

    def _transform_document(self, doc):
        """
        Transform a document from old format to timeseries format.
        
        Old format:
        {
            'timestamp': datetime,
            'timestamp_str': str,
            'device_id': str,
            'mac_address': str (optional),
            'temperature': float,
            'humidity': float,
            'co2': int,
            'voltage': float (optional),
            'raw_payload': dict (optional)
        }
        
        New format:
        {
            'timestamp': datetime,  # timeField - at root
            'timestamp_str': str,
            'temperature': float,  # measurements at root
            'humidity': float,
            'co2': int,
            'voltage': float (optional),
            'metadata': {  # metaField for grouping
                'device_id': str,
                'mac_address': str (optional)
            },
            'raw_payload': dict (optional) - can be omitted for timeseries
        }
        """
        # Start with the original document
        new_doc = {}

        # Copy timestamp (required timeField)
        new_doc['timestamp'] = doc.get('timestamp')
        if 'timestamp_str' in doc:
            new_doc['timestamp_str'] = doc['timestamp_str']

        # Copy measurements at root level
        if 'temperature' in doc:
            new_doc['temperature'] = doc['temperature']
        if 'humidity' in doc:
            new_doc['humidity'] = doc['humidity']
        if 'co2' in doc:
            new_doc['co2'] = doc['co2']
        if 'voltage' in doc and doc['voltage'] is not None:
            new_doc['voltage'] = doc['voltage']

        # Create metadata field for grouping
        metadata = {}
        if 'device_id' in doc and doc['device_id']:
            metadata['device_id'] = doc['device_id']
        if 'mac_address' in doc and doc['mac_address']:
            metadata['mac_address'] = doc['mac_address']

        # Only add metadata if it has content
        if metadata:
            new_doc['metadata'] = metadata

        # Optionally copy raw_payload (can be large - you might want to omit this)
        # if 'raw_payload' in doc:
        #     new_doc['raw_payload'] = doc['raw_payload']

        return new_doc

    def _insert_batch(self, collection, batch):
        """Insert a batch of documents, handling duplicates and errors."""
        inserted = 0
        skipped = 0
        errors = 0

        if not batch:
            return {'inserted': 0, 'skipped': 0, 'errors': 0}

        try:
            result = collection.insert_many(batch, ordered=False)
            inserted = len(result.inserted_ids)
        except BulkWriteError as e:
            # Count successes and failures
            for error in e.details.get('writeErrors', []):
                if error['code'] == 11000:  # Duplicate key error
                    skipped += 1
                else:
                    errors += 1
            # Count successfully inserted
            inserted = len(batch) - len(e.details.get('writeErrors', []))
        except Exception as e:
            # If entire batch fails, count as errors
            errors = len(batch)
            self.stdout.write(self.style.ERROR(f'Batch insert error: {e}'))

        return {'inserted': inserted, 'skipped': skipped, 'errors': errors}
