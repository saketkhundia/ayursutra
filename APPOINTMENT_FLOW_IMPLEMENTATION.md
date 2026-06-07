# AyurSutra Appointment & Treatment Flow — Implementation Roadmap

## Executive Summary
Your system has **60% of the flow implemented**. The missing 40% is critical for the doctor-centric approval workflow. Below is a priority-ordered implementation guide.

---

## Current State vs Required State

### ✅ What's Already Working
| Component | Status | Location |
|-----------|--------|----------|
| Sessions CRUD | Complete | `server/src/routes/sessions.ts` |
| Session Statuses | All 5 values stored | `sessions.ts` (pending, scheduled, in_progress, completed, cancelled) |
| ML Batch Sequencing | Works for scheduling | `ml-service/scheduling_engine.py` |
| Socket.io Real-time | Emits session events | `server/src/services/realtime.ts` |
| Patient Notifications | Full system (email, in-app, SMS) | `server/src/routes/notifications.ts` |
| Patient Portal | Shows treatment timeline | `client/src/pages/PatientPortal.tsx` |
| Dashboard Badges | Real-time unread count | `client/src/pages/Dashboard.tsx` |

### ❌ What's Missing (Critical)
| Stage | What's Missing | Impact | Priority |
|-------|---|---|---|
| **Stage 2-3** | Doctor doesn't get notified when patient books | Doctors never see appointment requests | 🔴 **CRITICAL** |
| **Stage 3** | No approve/reject endpoint | Can't implement approval workflow | 🔴 **CRITICAL** |
| **Stage 3** | Sessions created as "scheduled", never "pending" | No decision point for doctor | 🔴 **CRITICAL** |
| **Stage 4** | Treatment plan not linked to approved session | Can't anchor treatment start | 🟠 **HIGH** |
| **Stage 5** | No "treatment starts" notification | Patients don't know when course begins | 🟠 **HIGH** |
| **Everywhere** | Therapy sequence rules not validated | Doctor can approve invalid sequences | 🟠 **HIGH** |

---

## Implementation Phases

### Phase 1: Doctor Notification & Approval (3-4 hours)
**Goal**: `pending → approve/reject → scheduled` flow

#### 1.1 Update Session Model
**File**: `server/src/routes/sessions.ts`

```typescript
// When patient books, create with status: "pending", NOT "scheduled"
router.post('/sessions', authRequest('patient'), async (req, res) => {
  const session = {
    status: 'pending',  // ← CHANGED: was 'scheduled'
    requestedAt: new Date(),
    requestedSlot: { date, time },
    practitionerId: req.body.practitioner_id,
    patientId: req.user.id,
    therapyType: req.body.therapy_type,
    aiRecommendation: req.body.ai_recommendation || null,
  };
  
  const docRef = await db.collection('sessions').add(session);
  
  // Emit to doctor → goes to Phase 1.2
  io.to(`doctor:${session.practitionerId}`).emit('new_appointment_request', {
    sessionId: docRef.id,
    patientName: patient.name,
    requestedSlot: session.requestedSlot,
    doshaProfile: patient.dosha_profile,
  });
  
  res.status(201).json({ id: docRef.id, ...session });
});
```

#### 1.2 Create Approval Endpoint
**File**: `server/src/routes/sessions.ts` (NEW)

```typescript
// PUT /sessions/:id/approve — Doctor approves appointment
router.put('/sessions/:id/approve', verifyDoctorToken, async (req, res) => {
  const sessionId = req.params.id;
  
  // Approve and set confirmedAt
  await db.collection('sessions').doc(sessionId).update({
    status: 'scheduled',      // pending → scheduled
    confirmedAt: new Date(),
    approvedBy: req.doctor.id,
    approvalNotes: req.body.notes || '',
  });
  
  const session = await db.collection('sessions').doc(sessionId).get();
  const patient = await db.collection('patients').doc(session.data().patientId).get();
  
  // Trigger Phase 1.4: Create treatment plan
  // (See Phase 2.1 below)
  
  // Notify patient → Phase 1.3
  io.to(`patient:${session.data().patientId}`).emit('appointment_confirmed', {
    doctorName: req.doctor.name,
    slots: session.data().requestedSlot,
  });
  
  res.json({ status: 'approved', session: session.data() });
});

// PUT /sessions/:id/reject — Doctor rejects appointment
router.put('/sessions/:id/reject', verifyDoctorToken, async (req, res) => {
  await db.collection('sessions').doc(sessionId).update({
    status: 'cancelled',    // Mark as cancelled with reason
    rejectedAt: new Date(),
    rejectionReason: req.body.reason,
    rejectedBy: req.doctor.id,
  });
  
  // Notify patient of rejection
  io.to(`patient:${session.data().patientId}`).emit('appointment_rejected', {
    reason: req.body.reason,
  });
  
  res.json({ status: 'rejected' });
});
```

#### 1.3 Doctor Dashboard - Pending Requests Panel
**File**: `client/src/pages/Dashboard.tsx` (NEW COMPONENT)

Add a card showing:
```jsx
// Show pending appointments (before doctor action)
const [pendingRequests, setPendingRequests] = useState([]);

useEffect(() => {
  const unsubscribe = onSnapshot(
    query(
      collection(db, 'sessions'),
      where('practitionerId', '==', doctor.id),
      where('status', '==', 'pending')
    ),
    (snap) => setPendingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
  return unsubscribe;
}, []);

// UI to show pending requests with approve/reject buttons
// Call api.approveSession(id, notes) / api.rejectSession(id, reason)
```

#### 1.4 Emit Doctor Notification Events
**File**: `server/src/services/realtime.ts`

```typescript
// When pending appointment created, notify doctor
io.to(`doctor:${practitionerId}`).emit('pending_appointment', {
  sessionId,
  patientName,
  requestedTime,
  doshaProfile,
  aiTherapyRecommendation,
});

// Doctor approves → notify patient
io.to(`patient:${patientId}`).emit('appointment_confirmed', {
  doctorName,
  confirmedTime: session.requestedSlot,
  treatmentStartsAt: session.requestedSlot.date,
});
```

#### 1.5 Update Frontend API
**File**: `client/src/api.ts` (NEW)

```typescript
export const api = {
  // Already exists:
  createSession: (data) => authRequest('/sessions', { method: 'POST', ... }),
  
  // ADD THESE:
  approveAppointment: (sessionId, notes) =>
    authRequest(`/sessions/${sessionId}/approve`, { 
      method: 'PUT', 
      body: JSON.stringify({ notes }) 
    }),
    
  rejectAppointment: (sessionId, reason) =>
    authRequest(`/sessions/${sessionId}/reject`, { 
      method: 'PUT', 
      body: JSON.stringify({ reason }) 
    }),
};
```

**Deliverable**: Doctor sees "5 pending requests" badge → clicks → card panel shows patient name, dosha, requested slot, AI recommendation → clicks Approve (with notes) → patient notified immediately

---

### Phase 2: Treatment Plan Activation (2-3 hours)
**Goal**: Link approved appointment to treatment plan

#### 2.1 Update Approval Endpoint to Create/Activate Plan
**File**: `server/src/routes/sessions.ts` (EXTEND Phase 1.2)

```typescript
router.put('/sessions/:id/approve', verifyDoctorToken, async (req, res) => {
  const session = await db.collection('sessions').doc(sessionId).get();
  const patientId = session.data().patientId;
  
  // 1. Check if treatment plan exists
  let planRef = await db.collection('treatment_plans')
    .where('patientId', '==', patientId)
    .where('status', '==', 'draft')
    .limit(1)
    .get();
  
  let planId;
  if (planRef.empty) {
    // 2. CREATE new treatment plan with startDate = approved session date
    const newPlan = {
      patientId,
      practitionerId: req.doctor.id,
      startDate: new Date(session.data().requestedSlot.date),  // ← KEY: anchored to approved slot
      status: 'active',  // Mark as active immediately
      createdAt: new Date(),
      therapySequence: [],  // Will be populated by ML
    };
    const planDocRef = await db.collection('treatment_plans').add(newPlan);
    planId = planDocRef.id;
  } else {
    planId = planRef.docs[0].id;
    // Update existing draft to active with startDate
    await db.collection('treatment_plans').doc(planId).update({
      status: 'active',
      startDate: new Date(session.data().requestedSlot.date),
    });
  }
  
  // 3. Link session to plan
  await db.collection('sessions').doc(sessionId).update({
    status: 'scheduled',
    confirmedAt: new Date(),
    treatmentPlanId: planId,  // ← Link it
    approvedBy: req.doctor.id,
  });
  
  // 4. Trigger ML to sequence all future sessions → Phase 3
  // await scheduleMLSequencedSessions(patientId, planId, startDate);
  
  res.json({ status: 'approved', planId });
});
```

#### 2.2 Update Treatment Plan Schema
**File**: `server/src/models/database.ts`

```typescript
// treatment_plans collection structure
{
  id: 'plan_123',
  patientId: 'patient_456',
  practitionerId: 'doctor_789',
  startDate: Date,           // ← KEY: from approved appointment
  status: 'active' | 'paused' | 'completed',
  therapySequence: [
    { therapyId: 'vamana_123', startDate, endDate, order: 1 },
    { therapyId: 'virechana_456', startDate, endDate, order: 2 },
  ],
  createdAt: Date,
  updatedAt: Date,
}
```

---

### Phase 3: ML-Driven Session Sequencing (3-4 hours)
**Goal**: Auto-create all future sessions from approved date

#### 3.1 Call ML Engine on Approval
**File**: `server/src/routes/sessions.ts` (EXTEND Phase 2.1)

```typescript
// After approval, trigger ML to create sequence
async function scheduleMLSequencedSessions(patientId, planId, startDate) {
  try {
    const response = await fetch(`${config.ML_SERVICE_URL}/api/ai/schedule/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patientId,
        plan_id: planId,
        start_date: startDate.toISOString(),
        treatment_duration_days: 21,  // typical Panchakarma
        therapies: ['Vamana', 'Virechana', 'Basti'],  // from plan
      }),
    });
    
    const mlResult = await response.json();
    
    // 3.2 Write batched sessions to Firestore
    const batch = db.batch();
    mlResult.suggested_sessions.forEach((session) => {
      const docRef = db.collection('sessions').doc();
      batch.set(docRef, {
        patientId,
        practitionerId: planId,  // associate with plan
        therapyType: session.therapy_name,
        scheduledFor: new Date(session.suggested_date),
        status: 'scheduled',      // These are confirmed (different from patient-initiated)
        createdViaML: true,
        treatmentPlanId: planId,
        autoScheduled: true,
        createdAt: new Date(),
      });
    });
    await batch.commit();
    
    // 3.3 Notify patient
    io.to(`patient:${patientId}`).emit('treatment_plan_created', {
      planId,
      startDate,
      sessionCount: mlResult.suggested_sessions.length,
      firstTherapy: mlResult.suggested_sessions[0].therapy_name,
    });
  } catch (error) {
    logger.error('ML sequencing failed:', error);
  }
}
```

#### 3.2 Update ML Service Response Format
**File**: `ml-service/app.py` (CHECK/EXTEND)

The `/api/ai/schedule/auto` should return:
```json
{
  "success": true,
  "suggested_sessions": [
    {
      "session_number": 1,
      "therapy_name": "Vamana",
      "suggested_date": "2026-04-20T09:00:00Z",
      "duration_minutes": 120,
      "notes": "Primary detoxification..."
    },
    ...
  ]
}
```

---

### Phase 4: Validation & Conflict Prevention (2 hours)
**Goal**: Enforce therapy sequences and prevent conflicts

#### 4.1 Validate Therapy Sequence
**File**: `server/src/routes/sessions.ts` (NEW helper function)

```typescript
// Before approving, validate the therapy sequence
async function validateTherapySequence(treatmentPlanId, proposedTherapy) {
  const plan = await db.collection('treatment_plans').doc(treatmentPlanId).get();
  const sequence = plan.data().therapySequence;
  
  // Define therapy dependency rules
  const THERAPY_RULES = {
    'Vamana': { prerequisite: null, minRestDays: 0 },
    'Virechana': { prerequisite: 'Vamana', minRestDays: 2 },
    'Basti': { prerequisite: 'Virechana', minRestDays: 2 },
  };
  
  const rule = THERAPY_RULES[proposedTherapy];
  if (!rule) throw new Error('Unknown therapy type');
  
  if (rule.prerequisite) {
    // Check if prerequisite therapy is completed
    const prereq = await db.collection('sessions')
      .where('treatmentPlanId', '==', treatmentPlanId)
      .where('therapyType', '==', rule.prerequisite)
      .where('status', '==', 'completed')
      .get();
    
    if (prereq.empty) {
      throw new Error(`Cannot schedule ${proposedTherapy} before completing ${rule.prerequisite}`);
    }
  }
  
  return true;
}
```

---

### Phase 5: Patient Notifications & Timeline (2 hours)
**Goal**: Patient sees complete treatment timeline and gets all updates

#### 5.1 Extend Patient Portal
**File**: `client/src/pages/PatientPortal.tsx` (UPDATE)

```jsx
// Show full treatment timeline
const [treatmentPlan, setTreatmentPlan] = useState(null);
const [upcomingSessions, setUpcomingSessions] = useState([]);

useEffect(() => {
  // Fetch active treatment plan
  onSnapshot(
    query(
      collection(db, 'treatment_plans'),
      where('patientId', '==', patient.id),
      where('status', '==', 'active')
    ),
    (snap) => {
      if (!snap.empty) {
        const plan = snap.docs[0].data();
        setTreatmentPlan(plan);
        
        // "Your Panchakarma course starts on [date] and runs for [duration]"
        // Fetch all sessions for this plan
      }
    }
  );
}, []);

// Display
<div className="treatment-timeline">
  <h3>Your Treatment Timeline</h3>
  <p>Course Duration: {treatmentStartDate} to {treatmentEndDate}</p>
  
  <div className="session-list">
    {upcomingSessions.map(session => (
      <div className="session-card">
        <span>{session.therapyType}</span>
        <span>{formatDate(session.scheduledFor)}</span>
        <span className="status">{session.status}</span>
      </div>
    ))}
  </div>
</div>
```

#### 5.2 Notification Types to Send
**File**: `server/src/services/notification-service.ts` (UPDATE)

| Event | To | Message |
|-------|----|----|
| **Appointment Confirmed** | Patient | "Your appointment with Dr. [name] on [date] is confirmed. Your Panchakarma course begins then." |
| **Treatment Plan Created** | Patient | "Your personalized treatment plan is ready: [X] sessions over [Y] days" |
| **Session Reminder** | Patient | "Session tomorrow: [Therapy] at [time]" |
| **Session Completed** | Patient | "Session completed! Next: [therapy] on [date]" |

---

## Implementation Checklist

### Phase 1: Doctor Notification & Approval
- [ ] Update session creation to use `status: 'pending'`
- [ ] Create `PUT /sessions/:id/approve` endpoint
- [ ] Create `PUT /sessions/:id/reject` endpoint  
- [ ] Add doctor notification events to Socket.io
- [ ] Create "Pending Requests" panel in Dashboard
- [ ] Add API methods to frontend (approveAppointment, rejectAppointment)
- [ ] Add UI buttons to approve/reject with notes/reason fields

### Phase 2: Treatment Plan Activation
- [ ] Update plan creation to link with approved session
- [ ] Set `startDate` from approved appointment slot
- [ ] Mark plan as `active` on approval
- [ ] Link session to plan (treatmentPlanId field)

### Phase 3: ML Session Sequencing
- [ ] Call ML `/api/ai/schedule/auto` on approval
- [ ] Batch-write sequenced sessions to Firestore
- [ ] Notify patient of full timeline
- [ ] Handle ML failures gracefully

### Phase 4: Validation
- [ ] Implement therapy sequence validation
- [ ] Add rest-day enforcement between therapies
- [ ] Add conflict detection in scheduling

### Phase 5: Patient Experience
- [ ] Extend patient portal to show full timeline
- [ ] Add treatment start notification
- [ ] Add session reminders
- [ ] Add post-session feedback collection

---

## Testing Scenarios

### Scenario 1: Full Approval Flow
1. Patient books slot with Dr. A
2. Dr. A sees "1 pending request"
3. Dr. A reviews patient dosha + AI recommendation
4. Dr. A clicks "Approve with treatment plan"
5. ML auto-generates 7 sessions from appointment date
6. Patient gets notification: "Treatment starts [date]"
7. Patient sees full timeline

### Scenario 2: Rejection Flow
1. Patient books slot
2. Dr. A clicks "Reject" with reason "Slot no longer available"
3. Patient notified immediately
4. Patient can choose different slot

### Scenario 3: Treatment Continuation
1. Patient completes "Vamana" session
2. Doctor logs outcome (feedback)
3. Next session "Virechana" automatically starts after 2-day rest
4. ML adjusts remaining sessions based on feedback

---

## Database Queries Needed

```typescript
// Get doctor's pending appointments (by status 'pending')
db.collection('sessions')
  .where('practitionerId', '==', doctorId)
  .where('status', '==', 'pending')
  
// Get all sessions for a treatment plan (by plan)
db.collection('sessions')
  .where('treatmentPlanId', '==', planId)
  
// Get patient's active treatment plan
db.collection('treatment_plans')
  .where('patientId', '==', patientId)
  .where('status', '==', 'active')
```

---

## Key Files to Modify

### Backend
- `server/src/routes/sessions.ts` — Add /approve, /reject endpoints
- `server/src/services/realtime.ts` — Add doctor notification events
- `server/src/services/notification-service.ts` — Add appointment notifications
- `server/src/config.ts` — Add therapy sequence rules

### Frontend
- `client/src/api.ts` — Add approveAppointment, rejectAppointment methods
- `client/src/pages/Dashboard.tsx` — Add "Pending Requests" panel
- `client/src/pages/DoctorProfile.tsx` — Show pending badge
- `client/src/pages/PatientPortal.tsx` — Show full treatment timeline

### ML Service
- `ml-service/app.py` — Ensure `/api/ai/schedule/auto` returns correct format
- `ml-service/scheduling_engine.py` — Validate therapy sequence

---

## Effort Estimate

| Phase | Hours | Priority |
|-------|-------|----------|
| Phase 1: Doctor Approval | 3-4h | 🔴 CRITICAL |
| Phase 2: Treatment Plan | 2-3h | 🔴 CRITICAL |
| Phase 3: ML Sequencing | 3-4h | 🟠 HIGH |
| Phase 4: Validation | 2h | 🟠 HIGH |
| Phase 5: Patient UX | 2h | 🟡 MEDIUM |
| **Testing & Fixes** | **2-3h** | — |
| **Total** | **14-17 hours** | — |

---

## Success Criteria

✅ Doctor sees "5 pending appointments" badge  
✅ Doctor clicks appointment → sees full details + AI recommendation  
✅ Doctor approves → patient notified in <2 seconds  
✅ ML creates 7+ sequenced sessions in batch  
✅ Patient sees full 3-week treatment timeline  
✅ Sessions progress: pending → approved → scheduled → in_progress → completed  
✅ Therapy sequence validated (no Virechana before Vamana)  
✅ Real-time Socket.io updates for all status changes
