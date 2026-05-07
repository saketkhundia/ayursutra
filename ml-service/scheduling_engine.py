"""
ATASS AI Scheduling Engine
Intelligent therapy session scheduling with conflict resolution,
patient preference learning, and optimal slot suggestion.
"""

from datetime import datetime, timedelta
import numpy as np


# Therapy compatibility matrix - some therapies work best in sequence
THERAPY_SEQUENCES = {
    'Vamana': {'prep': ['Abhyanga', 'Swedana'], 'follow': ['rest']},
    'Virechana': {'prep': ['Abhyanga', 'Swedana'], 'follow': ['Basti']},
    'Basti': {'prep': ['Abhyanga'], 'follow': ['Nasya']},
    'Nasya': {'prep': ['Abhyanga', 'Swedana'], 'follow': ['Shirodhara']},
    'Raktamokshana': {'prep': ['Abhyanga'], 'follow': ['rest']},
    'Abhyanga': {'prep': [], 'follow': ['Swedana', 'Basti', 'Nasya']},
    'Swedana': {'prep': ['Abhyanga'], 'follow': ['Vamana', 'Virechana', 'Basti']},
    'Shirodhara': {'prep': ['Abhyanga'], 'follow': ['rest']},
}

# Optimal time slots for different therapy types (based on Ayurvedic principles)
OPTIMAL_TIMES = {
    'Vamana': ['06:00', '07:00', '08:00'],        # Early morning (Kapha time)
    'Virechana': ['09:00', '10:00'],               # Mid-morning
    'Basti': ['07:00', '08:00', '09:00', '10:00'], # Morning
    'Nasya': ['08:00', '09:00', '10:00'],          # After sunrise
    'Raktamokshana': ['09:00', '10:00', '11:00'],  # Mid-morning
    'Abhyanga': ['07:00', '08:00', '09:00', '14:00', '15:00'],  # Flexible
    'Swedana': ['08:00', '09:00', '10:00', '14:00'],            # After Abhyanga
    'Shirodhara': ['09:00', '10:00', '14:00', '15:00'],         # Calm periods
}

# Dosha-specific scheduling preferences
DOSHA_PREFERENCES = {
    'Vata': {'best_times': ['09:00', '10:00', '14:00'], 'avoid_times': ['06:00', '17:00'], 'rest_days_between': 2},
    'Pitta': {'best_times': ['08:00', '09:00', '15:00', '16:00'], 'avoid_times': ['12:00', '13:00'], 'rest_days_between': 1},
    'Kapha': {'best_times': ['06:00', '07:00', '08:00'], 'avoid_times': ['14:00', '15:00'], 'rest_days_between': 1},
    'Vata-Pitta': {'best_times': ['09:00', '10:00'], 'avoid_times': ['06:00', '12:00'], 'rest_days_between': 2},
    'Pitta-Kapha': {'best_times': ['07:00', '08:00', '15:00'], 'avoid_times': ['12:00'], 'rest_days_between': 1},
    'Vata-Kapha': {'best_times': ['08:00', '09:00'], 'avoid_times': ['06:00', '14:00'], 'rest_days_between': 2},
    'Tridosha': {'best_times': ['09:00', '10:00'], 'avoid_times': [], 'rest_days_between': 2},
}


def score_time_slot(therapy_name, time_str, dosha, practitioner_load, patient_history):
    """Score a time slot (0-100) based on multiple factors."""
    score = 50.0  # Base score

    # Factor 1: Optimal therapy time (0-25 points)
    optimal = OPTIMAL_TIMES.get(therapy_name, [])
    if time_str in optimal:
        score += 25
    elif any(abs(int(time_str.split(':')[0]) - int(o.split(':')[0])) <= 1 for o in optimal):
        score += 12

    # Factor 2: Dosha preference alignment (0-20 points)
    dosha_key = dosha if dosha in DOSHA_PREFERENCES else 'Tridosha'
    dosha_pref = DOSHA_PREFERENCES[dosha_key]
    if time_str in dosha_pref['best_times']:
        score += 20
    elif time_str in dosha_pref.get('avoid_times', []):
        score -= 15

    # Factor 3: Practitioner workload balance (0-15 points)
    # Lower load = higher score
    if practitioner_load < 3:
        score += 15
    elif practitioner_load < 5:
        score += 8
    else:
        score -= 5

    # Factor 4: Patient history patterns (0-15 points)
    if patient_history:
        prev_times = [h.get('time', '') for h in patient_history if h.get('score', 0) and h['score'] >= 75]
        if time_str in prev_times:
            score += 15  # Patient had good outcomes at this time
        prev_bad_times = [h.get('time', '') for h in patient_history if h.get('score', 0) and h['score'] < 60]
        if time_str in prev_bad_times:
            score -= 10

    # Factor 5: Time of day general preference (0-5 points)
    hour = int(time_str.split(':')[0])
    if 8 <= hour <= 11:
        score += 5  # Morning preference for most therapies

    return max(0, min(100, score))


def find_optimal_slots(
    therapy_name,
    therapy_duration,
    patient_dosha,
    practitioner_id,
    existing_sessions,
    patient_history,
    start_date,
    num_days=14,
    slots_per_day=3,
    doctor_availability=None
):
    """Find optimal available time slots for scheduling.
    
    Args:
        doctor_availability: List of dicts with {day_of_week, start_time, end_time}
                           representing doctor's manually posted availability
    """
    available_slots = []
    time_options = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
                    '14:00', '15:00', '16:00', '17:00']

    start = datetime.strptime(start_date, '%Y-%m-%d')

    for day_offset in range(num_days):
        current_date = start + timedelta(days=day_offset)
        # Skip Sundays
        if current_date.weekday() == 6:
            continue

        date_str = current_date.strftime('%Y-%m-%d')
        day_of_week = current_date.weekday()  # 0=Monday, 6=Sunday
        
        # Check if doctor is available on this day of week
        day_availability = []
        if doctor_availability:
            day_availability = [av for av in doctor_availability if av.get('day_of_week') == day_of_week]
            if not day_availability:
                # Doctor not available on this day, skip it
                continue

        # Get existing sessions for this date and practitioner
        day_sessions = [
            s for s in existing_sessions
            if s.get('scheduled_date') == date_str
            and s.get('practitioner_id') == practitioner_id
            and s.get('status') != 'cancelled'
        ]

        practitioner_load = len(day_sessions)

        for time_str in time_options:
            # Check if time is within doctor's available window (if availability is posted)
            if day_availability:
                slot_hour = int(time_str.split(':')[0])
                slot_min = int(time_str.split(':')[1])
                slot_start_minutes = slot_hour * 60 + slot_min
                
                is_available = False
                for av_window in day_availability:
                    av_start = int(av_window['start_time'].split(':')[0]) * 60 + int(av_window['start_time'].split(':')[1])
                    av_end = int(av_window['end_time'].split(':')[0]) * 60 + int(av_window['end_time'].split(':')[1])
                    
                    # Check if slot fits within availability window
                    slot_end_minutes = slot_start_minutes + therapy_duration
                    if slot_start_minutes >= av_start and slot_end_minutes <= av_end:
                        is_available = True
                        break
                
                if not is_available:
                    # Skip this time - doctor not available
                    continue
            
            # Check for conflicts
            has_conflict = False
            slot_start = int(time_str.split(':')[0]) * 60 + int(time_str.split(':')[1])
            slot_end = slot_start + therapy_duration

            for sess in day_sessions:
                sess_start = int(sess['scheduled_time'].split(':')[0]) * 60 + int(sess['scheduled_time'].split(':')[1])
                sess_end = sess_start + sess.get('duration_minutes', 60)
                if slot_start < sess_end and slot_end > sess_start:
                    has_conflict = True
                    break

            # Also check patient conflicts
            patient_day_sessions = [
                s for s in existing_sessions
                if s.get('scheduled_date') == date_str
                and s.get('patient_id') == practitioner_id  # Will be overridden
                and s.get('status') != 'cancelled'
            ]

            if has_conflict:
                continue

            score = score_time_slot(
                therapy_name, time_str, patient_dosha,
                practitioner_load, patient_history
            )

            available_slots.append({
                'date': date_str,
                'time': time_str,
                'score': round(score, 1),
                'confidence': round(min(score / 100, 0.99), 2),
                'reasons': _get_slot_reasons(therapy_name, time_str, patient_dosha, score, practitioner_load)
            })

    # Sort by score descending, return top slots
    available_slots.sort(key=lambda x: x['score'], reverse=True)

    # Group by date and return top slots_per_day per date
    result = []
    date_counts = {}
    for slot in available_slots:
        d = slot['date']
        date_counts[d] = date_counts.get(d, 0) + 1
        if date_counts[d] <= slots_per_day:
            result.append(slot)

    return result[:num_days * slots_per_day]


def _get_slot_reasons(therapy_name, time_str, dosha, score, load):
    """Generate human-readable reasons for slot recommendation."""
    reasons = []
    optimal = OPTIMAL_TIMES.get(therapy_name, [])
    if time_str in optimal:
        reasons.append(f'Optimal Ayurvedic time for {therapy_name}')

    dosha_key = dosha if dosha in DOSHA_PREFERENCES else 'Tridosha'
    dosha_pref = DOSHA_PREFERENCES[dosha_key]
    if time_str in dosha_pref['best_times']:
        reasons.append(f'Ideal for {dosha_key} constitution')

    if load < 3:
        reasons.append('Low practitioner workload')

    if score >= 80:
        reasons.append('Highly recommended slot')
    elif score >= 60:
        reasons.append('Good scheduling option')

    return reasons if reasons else ['Available time slot']


def auto_schedule_with_ai(
    therapy_name,
    therapy_duration,
    patient_dosha,
    practitioner_id,
    existing_sessions,
    patient_history,
    start_date,
    num_sessions,
    frequency_days,
    preferred_time=None,
    doctor_availability=None
):
    """
    AI-powered batch scheduling with conflict resolution.
    Returns optimized session schedule.
    """
    scheduled = []
    current_date = datetime.strptime(start_date, '%Y-%m-%d')

    dosha_key = patient_dosha if patient_dosha in DOSHA_PREFERENCES else 'Tridosha'
    min_rest = DOSHA_PREFERENCES[dosha_key]['rest_days_between']
    effective_frequency = max(frequency_days, min_rest)

    # Build a running list of sessions (existing + newly scheduled)
    all_sessions = list(existing_sessions)

    for i in range(num_sessions):
        target_date = current_date + timedelta(days=i * effective_frequency)

        # Skip Sundays
        while target_date.weekday() == 6:
            target_date += timedelta(days=1)

        date_str = target_date.strftime('%Y-%m-%d')

        # Find best slot for this date
        slots = find_optimal_slots(
            therapy_name, therapy_duration, patient_dosha,
            practitioner_id, all_sessions, patient_history,
            date_str, num_days=3, slots_per_day=5, doctor_availability=doctor_availability
        )

        # Filter to target date (or nearby if conflicts)
        date_slots = [s for s in slots if s['date'] == date_str]
        if not date_slots:
            date_slots = slots[:1]  # Take best alternative

        if preferred_time:
            # Prefer exact time, fall back to best available
            exact = [s for s in date_slots if s['time'] == preferred_time]
            if exact:
                chosen = exact[0]
            else:
                chosen = date_slots[0] if date_slots else None
        else:
            chosen = date_slots[0] if date_slots else None

        if chosen:
            session = {
                'date': chosen['date'],
                'time': chosen['time'],
                'ai_score': chosen['score'],
                'confidence': chosen['confidence'],
                'reasons': chosen['reasons'],
                'conflict_resolved': chosen['date'] != date_str
            }
            scheduled.append(session)

            # Add to running sessions to prevent future conflicts
            all_sessions.append({
                'scheduled_date': chosen['date'],
                'scheduled_time': chosen['time'],
                'practitioner_id': practitioner_id,
                'duration_minutes': therapy_duration,
                'status': 'scheduled'
            })

    avg_confidence = np.mean([s['confidence'] for s in scheduled]) if scheduled else 0

    return {
        'sessions': scheduled,
        'total_scheduled': len(scheduled),
        'average_confidence': round(float(avg_confidence), 2),
        'effective_frequency': effective_frequency,
        'dosha_adjusted': effective_frequency != frequency_days,
        'summary': _generate_schedule_summary(scheduled, therapy_name, patient_dosha)
    }


def _generate_schedule_summary(sessions, therapy_name, dosha):
    """Generate natural language summary of the AI schedule."""
    if not sessions:
        return 'Unable to find suitable slots. Try adjusting the date range or practitioner.'

    high_conf = len([s for s in sessions if s['confidence'] >= 0.7])
    conflicts = len([s for s in sessions if s.get('conflict_resolved')])

    summary = f'Scheduled {len(sessions)} {therapy_name} sessions optimized for {dosha} constitution. '
    if high_conf == len(sessions):
        summary += 'All slots have high confidence scores. '
    elif high_conf > 0:
        summary += f'{high_conf} sessions at optimal times. '
    if conflicts > 0:
        summary += f'{conflicts} sessions were adjusted to resolve conflicts. '

    return summary.strip()
