"""
Scheduler for automatic daily annotation.
Uses APScheduler to run annotation job every morning at 17:00 PM.
"""

import os
import atexit
from datetime import date, timedelta

# APScheduler imports
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    SCHEDULER_AVAILABLE = True
except ImportError:
    print("⚠️  APScheduler not installed. Run: pip install APScheduler")
    SCHEDULER_AVAILABLE = False
    BackgroundScheduler = None
    CronTrigger = None


# Scheduler instance
_scheduler = None
_scheduler_started = False


def annotate_today_job():
    """
    Job function to annotate today's sensor data.
    Called automatically by the scheduler at end of day.
    
    Uses annotate_today() instead of annotate_yesterday() because the
    BakalAPI only returns the current week's timetable. Running at 23:00
    ensures timetable entries are still available for accurate matching.
    """
    from .annotator import annotate_today
    
    print("\n" + "="*60)
    print("🕕 Running scheduled annotation job...")
    print("="*60)
    
    try:
        result = annotate_today()
        summary = result.get('summary', {})
        print(f"✓ Scheduled annotation complete:")
        print(f"   Date: {result.get('date')}")
        print(f"   Total readings: {summary.get('total_readings', 0)}")
        print(f"   Rooms: {summary.get('rooms_annotated', 0)}")
        print(f"   Lessons: {summary.get('lessons_captured', 0)}")
    except Exception as e:
        print(f"✗ Scheduled annotation failed: {e}")


def get_scheduler():
    """Get or create the scheduler instance."""
    global _scheduler
    
    if not SCHEDULER_AVAILABLE:
        return None
    
    if _scheduler is None:
        _scheduler = BackgroundScheduler(
            timezone='Europe/Prague',
            job_defaults={
                'coalesce': True,  # Merge missed jobs
                'max_instances': 1  # Only one instance at a time
            }
        )
    
    return _scheduler


def start_scheduler():
    """
    Start the annotation scheduler.
    Should be called once when the Django app starts.
    """
    global _scheduler_started
    
    if not SCHEDULER_AVAILABLE:
        print("⚠️  Scheduler not available (APScheduler not installed)")
        return False
    
    if _scheduler_started:
        print("⚠️  Scheduler already started")
        return True
    
    scheduler = get_scheduler()
    if scheduler is None:
        return False
    
    # Check if we should enable the scheduler
    # Can be disabled via environment variable
    if os.getenv('DISABLE_ANNOTATION_SCHEDULER', '').lower() in ('true', '1', 'yes'):
        print("📅 Annotation scheduler disabled via environment variable")
        return False
    
    # Add the daily annotation job
    # Runs at 17:00 local time (Europe/Prague) to annotate today's data
    # after readings end at 16:00
    scheduler.add_job(
        annotate_today_job,
        trigger=CronTrigger(hour=17, minute=0),
        id='daily_annotation',
        name='Daily Sensor Annotation',
        replace_existing=True
    )
    
    # Start the scheduler
    try:
        scheduler.start()
        _scheduler_started = True
        
        # Register shutdown handler
        atexit.register(stop_scheduler)
        
        print("📅 Annotation scheduler started (daily at 17:00)")
        return True
    except Exception as e:
        print(f"✗ Failed to start scheduler: {e}")
        return False


def stop_scheduler():
    """Stop the scheduler gracefully."""
    global _scheduler, _scheduler_started
    
    if _scheduler is not None and _scheduler_started:
        try:
            _scheduler.shutdown(wait=False)
            print("📅 Annotation scheduler stopped")
        except:
            pass
        _scheduler_started = False


def get_scheduler_status():
    """Get the current status of the scheduler."""
    if not SCHEDULER_AVAILABLE:
        return {
            'available': False,
            'running': False,
            'message': 'APScheduler not installed'
        }
    
    scheduler = get_scheduler()
    if scheduler is None:
        return {
            'available': True,
            'running': False,
            'message': 'Scheduler not initialized'
        }
    
    jobs = []
    if _scheduler_started:
        for job in scheduler.get_jobs():
            jobs.append({
                'id': job.id,
                'name': job.name,
                'next_run': job.next_run_time.isoformat() if job.next_run_time else None
            })
    
    return {
        'available': True,
        'running': _scheduler_started,
        'jobs': jobs,
        'message': 'Scheduler running' if _scheduler_started else 'Scheduler not started'
    }


def trigger_annotation_now(target_date: date = None):
    """
    Manually trigger annotation for a specific date.
    
    Args:
        target_date: Date to annotate (defaults to yesterday)
    
    Returns:
        The annotated document
    """
    from .annotator import annotate_day, annotate_yesterday
    
    if target_date is None:
        return annotate_yesterday()
    else:
        return annotate_day(target_date)
