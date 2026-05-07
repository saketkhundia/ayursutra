"""
ATASS Therapy Personalization Engine
Feedback-driven therapy recommendations using patient response analysis,
dosha-based optimization, and treatment efficacy scoring.
"""

import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.cluster import KMeans


# Dosha-therapy efficacy baseline (empirical Ayurvedic knowledge)
DOSHA_THERAPY_AFFINITY = {
    'Vata': {
        'Basti': 0.95, 'Abhyanga': 0.90, 'Swedana': 0.80, 'Shirodhara': 0.85,
        'Nasya': 0.70, 'Vamana': 0.40, 'Virechana': 0.50, 'Raktamokshana': 0.45,
    },
    'Pitta': {
        'Virechana': 0.95, 'Shirodhara': 0.90, 'Abhyanga': 0.80, 'Nasya': 0.75,
        'Raktamokshana': 0.80, 'Basti': 0.60, 'Swedana': 0.40, 'Vamana': 0.50,
    },
    'Kapha': {
        'Vamana': 0.95, 'Nasya': 0.85, 'Swedana': 0.85, 'Abhyanga': 0.75,
        'Virechana': 0.70, 'Basti': 0.55, 'Raktamokshana': 0.60, 'Shirodhara': 0.50,
    },
}

# Expand for combination doshas
for combo in ['Vata-Pitta', 'Pitta-Kapha', 'Vata-Kapha', 'Tridosha']:
    parts = combo.replace('Tridosha', 'Vata-Pitta-Kapha').split('-')
    DOSHA_THERAPY_AFFINITY[combo] = {}
    for therapy in DOSHA_THERAPY_AFFINITY['Vata']:
        scores = [DOSHA_THERAPY_AFFINITY.get(p, {}).get(therapy, 0.5) for p in parts]
        DOSHA_THERAPY_AFFINITY[combo][therapy] = round(np.mean(scores), 2)


def analyze_patient_response(feedback_history):
    """
    Analyze patient's response patterns from feedback history.
    Returns response profile with trend analysis.
    """
    if not feedback_history or len(feedback_history) < 2:
        return {
            'has_sufficient_data': False,
            'message': 'Need at least 2 feedback entries for analysis.',
            'metrics': {}
        }

    metrics = ['overall_rating', 'pain_level', 'energy_level', 'sleep_quality', 'digestion_rating']
    analysis = {}

    for metric in metrics:
        values = [f.get(metric) for f in feedback_history if f.get(metric) is not None]
        if len(values) < 2:
            continue

        values_arr = np.array(values, dtype=float)
        trend = np.polyfit(range(len(values_arr)), values_arr, 1)[0]

        analysis[metric] = {
            'current': float(values_arr[-1]),
            'average': round(float(np.mean(values_arr)), 2),
            'trend': round(float(trend), 3),
            'trend_direction': 'improving' if trend > 0.05 else ('declining' if trend < -0.05 else 'stable'),
            'min': float(np.min(values_arr)),
            'max': float(np.max(values_arr)),
            'volatility': round(float(np.std(values_arr)), 2),
        }

    # Overall health score (weighted)
    weights = {'overall_rating': 0.3, 'energy_level': 0.2, 'sleep_quality': 0.2,
               'digestion_rating': 0.2, 'pain_level': -0.1}  # Pain is inverse
    health_score = 0
    total_weight = 0
    for metric, weight in weights.items():
        if metric in analysis:
            val = analysis[metric]['current']
            if metric == 'pain_level':
                val = 6 - val  # Invert pain (lower is better)
            health_score += val * abs(weight)
            total_weight += abs(weight)

    health_score = round((health_score / total_weight) * 20 if total_weight > 0 else 0, 1)

    # Detect side effects pattern
    side_effects = [f.get('side_effects', '') for f in feedback_history if f.get('side_effects')]
    has_recurring_side_effects = len(side_effects) >= 2

    return {
        'has_sufficient_data': True,
        'metrics': analysis,
        'health_score': health_score,
        'side_effects_concern': has_recurring_side_effects,
        'side_effects_count': len(side_effects),
        'total_sessions_analyzed': len(feedback_history),
    }


def get_therapy_recommendations(patient_dosha, feedback_history, available_therapies, current_therapy=None):
    """
    Generate personalized therapy recommendations based on:
    1. Dosha-therapy affinity
    2. Patient feedback patterns
    3. Side effect history
    4. Treatment efficacy scoring
    """
    dosha_key = patient_dosha if patient_dosha in DOSHA_THERAPY_AFFINITY else 'Tridosha'
    affinity = DOSHA_THERAPY_AFFINITY[dosha_key]

    response_analysis = analyze_patient_response(feedback_history)
    recommendations = []

    # Build therapy-specific feedback map
    therapy_feedback = {}
    for f in feedback_history:
        therapy = f.get('therapy_name', 'Unknown')
        if therapy not in therapy_feedback:
            therapy_feedback[therapy] = []
        therapy_feedback[therapy].append(f)

    for therapy in available_therapies:
        name = therapy.get('name', '')
        base_score = affinity.get(name, 0.5)

        # Adjust based on patient-specific feedback for this therapy
        t_feedback = therapy_feedback.get(name, [])
        feedback_adjustment = 0
        if t_feedback:
            avg_rating = np.mean([f.get('overall_rating', 3) for f in t_feedback])
            feedback_adjustment = (avg_rating - 3) * 0.1  # +/- 0.2 adjustment
            # Penalize if side effects reported for this therapy
            side_effects = [f for f in t_feedback if f.get('side_effects')]
            if side_effects:
                feedback_adjustment -= 0.15 * len(side_effects) / len(t_feedback)

        # Adjust based on overall trends
        trend_adjustment = 0
        if response_analysis.get('has_sufficient_data'):
            overall_trend = response_analysis['metrics'].get('overall_rating', {}).get('trend', 0)
            if overall_trend > 0.1:
                trend_adjustment = 0.05  # Positive trend, maintain approach
            elif overall_trend < -0.1:
                trend_adjustment = -0.1  # Declining, may need different therapy

        final_score = max(0, min(1, base_score + feedback_adjustment + trend_adjustment))

        # Determine confidence level
        data_points = len(t_feedback)
        confidence = min(0.5 + data_points * 0.1, 0.95) if data_points > 0 else 0.4

        reasons = _generate_recommendation_reasons(
            name, dosha_key, base_score, feedback_adjustment, t_feedback, response_analysis
        )

        recommendations.append({
            'therapy_id': therapy.get('id', ''),
            'therapy_name': name,
            'category': therapy.get('category', ''),
            'score': round(final_score * 100, 1),
            'confidence': round(confidence, 2),
            'dosha_affinity': round(base_score * 100, 1),
            'feedback_adjustment': round(feedback_adjustment * 100, 1),
            'reasons': reasons,
            'is_current': name == current_therapy,
            'sessions_completed': data_points,
            'recommendation': _get_recommendation_label(final_score),
        })

    recommendations.sort(key=lambda x: x['score'], reverse=True)
    return recommendations


def _get_recommendation_label(score):
    if score >= 0.85:
        return 'Highly Recommended'
    elif score >= 0.70:
        return 'Recommended'
    elif score >= 0.50:
        return 'Consider'
    elif score >= 0.35:
        return 'Use with Caution'
    else:
        return 'Not Recommended'


def _generate_recommendation_reasons(therapy, dosha, base, fb_adj, feedback, analysis):
    reasons = []
    if base >= 0.8:
        reasons.append(f'Strong natural affinity for {dosha} constitution')
    elif base >= 0.6:
        reasons.append(f'Good compatibility with {dosha} dosha')

    if feedback:
        avg = np.mean([f.get('overall_rating', 3) for f in feedback])
        if avg >= 4:
            reasons.append(f'Patient rated this therapy highly ({avg:.1f}/5)')
        elif avg <= 2:
            reasons.append(f'Low patient satisfaction ({avg:.1f}/5)')

        sides = [f for f in feedback if f.get('side_effects')]
        if sides:
            reasons.append(f'Side effects reported in {len(sides)} session(s)')
        else:
            reasons.append('No side effects reported')

    if analysis.get('has_sufficient_data'):
        energy = analysis['metrics'].get('energy_level', {})
        if energy.get('trend_direction') == 'improving':
            reasons.append('Energy levels trending upward')
        elif energy.get('trend_direction') == 'declining':
            reasons.append('Consider adjusting treatment approach')

    return reasons if reasons else [f'Standard recommendation for {dosha}']


def generate_treatment_insights(patient_data, feedback_history, sessions):
    """
    Generate AI-powered treatment insights and predictions.
    """
    response = analyze_patient_response(feedback_history)

    insights = []

    # Insight 1: Overall progress assessment
    if response.get('has_sufficient_data'):
        hs = response.get('health_score', 0)
        if hs >= 80:
            insights.append({
                'type': 'success',
                'title': 'Excellent Progress',
                'message': f'Health score of {hs}/100 indicates strong treatment response. Continue current approach.',
                'priority': 'low'
            })
        elif hs >= 60:
            insights.append({
                'type': 'info',
                'title': 'Steady Progress',
                'message': f'Health score of {hs}/100 shows gradual improvement. Monitor trends closely.',
                'priority': 'medium'
            })
        else:
            insights.append({
                'type': 'warning',
                'title': 'Treatment Review Needed',
                'message': f'Health score of {hs}/100 suggests treatment adjustments may be beneficial.',
                'priority': 'high'
            })

    # Insight 2: Side effects concern
    if response.get('side_effects_concern'):
        insights.append({
            'type': 'alert',
            'title': 'Recurring Side Effects',
            'message': f'Side effects reported in {response["side_effects_count"]} sessions. Consider therapy modification.',
            'priority': 'high'
        })

    # Insight 3: Session completion rate
    if sessions:
        completed = len([s for s in sessions if s.get('status') == 'completed'])
        total = len(sessions)
        rate = completed / total if total > 0 else 0
        if rate < 0.6:
            insights.append({
                'type': 'warning',
                'title': 'Low Completion Rate',
                'message': f'Only {completed}/{total} sessions completed ({rate*100:.0f}%). Review scheduling or patient engagement.',
                'priority': 'medium'
            })

    # Insight 4: Metric-specific insights
    if response.get('has_sufficient_data'):
        for metric, data in response.get('metrics', {}).items():
            if data.get('trend_direction') == 'declining' and data.get('volatility', 0) > 0.8:
                label = metric.replace('_', ' ').title()
                insights.append({
                    'type': 'warning',
                    'title': f'{label} Declining',
                    'message': f'{label} shows a declining trend with high variability. Consider targeted intervention.',
                    'priority': 'medium'
                })

    # Insight 5: Predicted recovery timeline
    if response.get('has_sufficient_data') and sessions:
        overall = response['metrics'].get('overall_rating', {})
        if overall.get('trend', 0) > 0:
            current = overall.get('current', 3)
            trend = overall['trend']
            sessions_to_target = max(0, int((4.5 - current) / trend)) if trend > 0 else 0
            if sessions_to_target > 0 and sessions_to_target < 30:
                insights.append({
                    'type': 'prediction',
                    'title': 'Recovery Estimate',
                    'message': f'At current progress rate, target wellness score may be reached in ~{sessions_to_target} more sessions.',
                    'priority': 'low'
                })

    return {
        'insights': sorted(insights, key=lambda x: {'high': 0, 'medium': 1, 'low': 2}.get(x['priority'], 3)),
        'response_analysis': response,
    }
