"""
ATASS ML Service - Flask API
Exposes AI scheduling and therapy personalization endpoints.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from scheduling_engine import find_optimal_slots, auto_schedule_with_ai
from personalization_engine import (
    analyze_patient_response,
    get_therapy_recommendations,
    generate_treatment_insights,
)

app = Flask(__name__)
CORS(app)


@app.route('/api/ai/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'ATASS ML Engine', 'version': '1.0.0'})


@app.route('/api/ai/schedule/suggest', methods=['POST'])
def suggest_slots():
    """Find optimal time slots for a therapy session."""
    try:
        data = request.get_json()

        required = ['therapy_name', 'therapy_duration', 'patient_dosha', 'practitioner_id', 'start_date']
        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

        slots = find_optimal_slots(
            therapy_name=data['therapy_name'],
            therapy_duration=data.get('therapy_duration', 60),
            patient_dosha=data.get('patient_dosha', 'Tridosha'),
            practitioner_id=data['practitioner_id'],
            existing_sessions=data.get('existing_sessions', []),
            patient_history=data.get('patient_history', []),
            start_date=data['start_date'],
            num_days=data.get('num_days', 14),
            slots_per_day=data.get('slots_per_day', 3),
            doctor_availability=data.get('doctor_availability'),
        )

        return jsonify({
            'slots': slots,
            'total_options': len(slots),
            'therapy': data['therapy_name'],
            'dosha': data.get('patient_dosha', 'Tridosha'),
        })
    except Exception as e:
        import traceback
        print(f"ERROR in suggest_slots: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/ai/schedule/auto', methods=['POST'])
def ai_auto_schedule():
    """AI-powered batch scheduling with conflict resolution."""
    try:
        data = request.get_json()

        required = ['therapy_name', 'therapy_duration', 'patient_dosha',
                    'practitioner_id', 'start_date', 'num_sessions']
        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

        result = auto_schedule_with_ai(
            therapy_name=data['therapy_name'],
            therapy_duration=data.get('therapy_duration', 60),
            patient_dosha=data.get('patient_dosha', 'Tridosha'),
            practitioner_id=data['practitioner_id'],
            existing_sessions=data.get('existing_sessions', []),
            patient_history=data.get('patient_history', []),
            start_date=data['start_date'],
            num_sessions=data['num_sessions'],
            frequency_days=data.get('frequency_days', 3),
            preferred_time=data.get('preferred_time'),
            doctor_availability=data.get('doctor_availability'),
        )

        return jsonify(result)
    except Exception as e:
        import traceback
        print(f"ERROR in ai_auto_schedule: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/ai/personalize/analyze', methods=['POST'])
def analyze_response():
    """Analyze patient response patterns from feedback."""
    data = request.get_json()
    feedback = data.get('feedback_history', [])
    result = analyze_patient_response(feedback)
    return jsonify(result)


@app.route('/api/ai/personalize/recommend', methods=['POST'])
def recommend_therapies():
    """Get personalized therapy recommendations."""
    data = request.get_json()

    recommendations = get_therapy_recommendations(
        patient_dosha=data.get('patient_dosha', 'Tridosha'),
        feedback_history=data.get('feedback_history', []),
        available_therapies=data.get('available_therapies', []),
        current_therapy=data.get('current_therapy'),
    )

    return jsonify({
        'recommendations': recommendations,
        'patient_dosha': data.get('patient_dosha', 'Tridosha'),
        'data_points': len(data.get('feedback_history', [])),
    })


@app.route('/api/ai/personalize/insights', methods=['POST'])
def treatment_insights():
    """Generate AI treatment insights and predictions."""
    data = request.get_json()

    result = generate_treatment_insights(
        patient_data=data.get('patient_data', {}),
        feedback_history=data.get('feedback_history', []),
        sessions=data.get('sessions', []),
    )

    return jsonify(result)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
