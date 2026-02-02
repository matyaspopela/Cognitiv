"""
Hall of Shame Data Aggregator

Queries annotated_readings collection to generate CO2 rankings by subject/room/teacher.
Used for PDF infographic "Hall of Shame" widget.
"""

from typing import List, Dict, Optional
from datetime import datetime
import os
from pymongo import MongoClient
import certifi


def get_mongo_uri() -> str:
    """Get MongoDB URI from environment."""
    return os.getenv('MONGO_URI', 'mongodb://localhost:27017/')


def get_mongo_db_name() -> str:
    """Get MongoDB database name."""
    return os.getenv('MONGO_DB_NAME', 'cognitiv')


def get_annotated_readings_collection():
    """Get annotated readings collection."""
    client = MongoClient(
        get_mongo_uri(),
        serverSelectionTimeoutMS=5000,
        tlsCAFile=certifi.where(),
        tz_aware=True,
    )
    db = client[get_mongo_db_name()]
    return db['annotated_readings']


class HallOfShameAggregator:
    """
    Aggregates CO2 data from annotated_readings to generate rankings.
    
    Rankings can be by:
    - Subject (Math, Science, etc.)
    - Room (device_id)
    - Teacher
    """
    
    def __init__(self):
        self.collection = get_annotated_readings_collection()
    
    def get_rankings(
        self,
        start_date: str,
        end_date: str,
        group_by: str = 'subject',
        limit: int = 10
    ) -> List[Dict]:
        """
        Get CO2 rankings (worst to best).
        
        Args:
            start_date: ISO format date string (YYYY-MM-DD)
            end_date: ISO format date string (YYYY-MM-DD)
            group_by: 'subject', 'room', or 'teacher'
            limit: Maximum number of results
        
        Returns:
            List of dicts with 'name', 'avg_co2', 'max_co2', 'count'
        """
        # Convert date strings to datetime
        try:
            start_dt = datetime.fromisoformat(start_date)
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            return []
        
        # Determine grouping field
        group_field_map = {
            'subject': 'readings.subject',
            'room': 'device_id',
            'teacher': 'readings.teacher'
        }
        
        group_field = group_field_map.get(group_by, 'readings.subject')
        
        # MongoDB aggregation pipeline
        pipeline = [
            # Match date range
            {
                '$match': {
                    'timestamp': {
                        '$gte': start_dt,
                        '$lte': end_dt
                    }
                }
            },
            # Unwind readings array
            {
                '$unwind': '$readings'
            },
            # Group by selected field
            {
                '$group': {
                    '_id': f'${group_field}',
                    'avg_co2': {'$avg': '$readings.co2'},
                    'max_co2': {'$max': '$readings.co2'},
                    'count': {'$sum': 1}
                }
            },
            # Filter out null groups
            {
                '$match': {
                    '_id': {'$ne': None}
                }
            },
            # Sort by average CO2 (descending - worst first)
            {
                '$sort': {'avg_co2': -1}
            },
            # Limit results
            {
                '$limit': limit
            }
        ]
        
        try:
            results = list(self.collection.aggregate(pipeline))
            
            # Format results
            formatted = []
            for result in results:
                formatted.append({
                    'name': result['_id'],
                    'avg_co2': result['avg_co2'],
                    'max_co2': result['max_co2'],
                    'count': result['count'],
                    'type': group_by
                })
            
            return formatted
        
        except Exception as e:
            print(f"Error in Hall of Shame aggregation: {e}")
            return []
    
    def get_weekly_trends(
        self,
        start_date: str,
        end_date: str,
        group_by: str = 'subject',
        limit: int = 8
    ) -> Dict[str, List[float]]:
        """
        Get daily CO2 averages for sparkline visualization.
        
        Args:
            start_date: ISO format date string
            end_date: ISO format date string
            group_by: 'subject', 'room', or 'teacher'
            limit: Maximum number of entities to return trends for
        
        Returns:
            Dict mapping entity name to list of daily CO2 averages
        """
        try:
            start_dt = datetime.fromisoformat(start_date)
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            return {}
        
        # Determine grouping field
        group_field_map = {
            'subject': 'readings.subject',
            'room': 'device_id',
            'teacher': 'readings.teacher'
        }
        
        group_field = group_field_map.get(group_by, 'readings.subject')
        
        # Pipeline to get daily averages per entity
        pipeline = [
            {
                '$match': {
                    'timestamp': {
                        '$gte': start_dt,
                        '$lte': end_dt
                    }
                }
            },
            {
                '$unwind': '$readings'
            },
            {
                '$group': {
                    '_id': {
                        'entity': f'${group_field}',
                        'date': {
                            '$dateToString': {
                                'format': '%Y-%m-%d',
                                'date': '$timestamp'
                            }
                        }
                    },
                    'daily_avg_co2': {'$avg': '$readings.co2'}
                }
            },
            {
                '$match': {
                    '_id.entity': {'$ne': None}
                }
            },
            {
                '$sort': {
                    '_id.entity': 1,
                    '_id.date': 1
                }
            }
        ]
        
        try:
            results = list(self.collection.aggregate(pipeline))
            
            # Organize by entity
            trends = {}
            for result in results:
                entity = result['_id']['entity']
                daily_avg = result['daily_avg_co2']
                
                if entity not in trends:
                    trends[entity] = []
                
                trends[entity].append(daily_avg)
            
            # Limit to top N entities (by average CO2)
            entity_averages = {
                entity: sum(values) / len(values)
                for entity, values in trends.items()
            }
            
            top_entities = sorted(
                entity_averages.keys(),
                key=lambda e: entity_averages[e],
                reverse=True
            )[:limit]
            
            return {entity: trends[entity] for entity in top_entities}
        
        except Exception as e:
            print(f"Error in weekly trends aggregation: {e}")
            return {}
    
    def get_summary_stats(
        self,
        start_date: str,
        end_date: str
    ) -> Dict:
        """
        Get overall summary statistics.
        
        Args:
            start_date: ISO format date string
            end_date: ISO format date string
        
        Returns:
            Dict with avg_co2, max_co2, total_rooms
        """
        try:
            start_dt = datetime.fromisoformat(start_date)
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            return {}
        
        pipeline = [
            {
                '$match': {
                    'timestamp': {
                        '$gte': start_dt,
                        '$lte': end_dt
                    }
                }
            },
            {
                '$unwind': '$readings'
            },
            {
                '$group': {
                    '_id': None,
                    'avg_co2': {'$avg': '$readings.co2'},
                    'max_co2': {'$max': '$readings.co2'},
                    'rooms': {'$addToSet': '$device_id'}
                }
            }
        ]
        
        try:
            results = list(self.collection.aggregate(pipeline))
            
            if results:
                result = results[0]
                return {
                    'avg_co2': result['avg_co2'],
                    'max_co2': result['max_co2'],
                    'total_rooms': len(result['rooms'])
                }
            
            return {'avg_co2': 0, 'max_co2': 0, 'total_rooms': 0}
        
        except Exception as e:
            print(f"Error in summary stats aggregation: {e}")
            return {'avg_co2': 0, 'max_co2': 0, 'total_rooms': 0}


def get_hall_of_shame_data(start_date: str, end_date: str, group_by: str = 'subject') -> Dict:
    """
    Convenience function to get all Hall of Shame data.
    
    Args:
        start_date: ISO date string
        end_date: ISO date string
        group_by: 'subject', 'room', or 'teacher'
    
    Returns:
        Dict with hall_of_shame, weekly_trends, summary_stats
    """
    aggregator = HallOfShameAggregator()
    
    return {
        'hall_of_shame': aggregator.get_rankings(start_date, end_date, group_by=group_by),
        'weekly_trends': aggregator.get_weekly_trends(start_date, end_date, group_by=group_by),
        'summary_stats': aggregator.get_summary_stats(start_date, end_date),
        'aqi_value': 'N/A'  # Placeholder for future implementation
    }
