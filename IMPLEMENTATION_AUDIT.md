# AyurSutra - Implementation Audit Report

**Date:** April 16, 2026  
**Scope:** Sessions Management, Doctor Notifications, Treatment Plans, ML Scheduling, Patient Portal

---

## 1. SESSIONS MANAGEMENT ✅ MOSTLY COMPLETE

### 1.1 Sessions Collection Schema & Status Field
**Status:** ✅ **FULLY IMPLEMENTED**

- **File:** [server/src/models/database.ts](server/src/models/database.ts)
- **Collection:** `therapy_sessions`
- **Schema fields:**
  ```typescript
  {
    id: string (UUID)
    treatment_plan_id: string
    therapy_type_id: string
    patient_id: string
    practitioner_id: string
    scheduled_date: string (YYYY-MM-DD)
    scheduled_time: string (HH:MM)
    duration_minutes: number
    status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show'
    actual_start_time: string | null
    actual_end_time: string | null
    session_notes: string | null
    progress_score: number | null
    ai_confidence: number | null
    created_at: ISO timestamp
    updated_at: ISO timestamp
  }
  ```

### 1.2 Session Creation Endpoint (When Patient Books)
**Status:** ✅ **FULLY IMPLEMENTED**

- **Endpoint:** `POST /api/sessions`
- **File:** [server/src/routes/sessions.ts](server/src/routes/sessions.ts#L60-L130)
- **Features:**
  - ✅ Validates all required fields
  - ✅ Checks for scheduling conflicts (practitioner availability)
  - ✅ Prevents double-booking with time overlap detection
  - ✅ Creates session with status `'scheduled'`
  - ✅ Auto-generates patient notifications (pre-procedure, post-procedure, reminder)
  - ✅ Emits real-time socket event `session:created`
  - ✅ Emits dashboard refresh

### 1.3 Session Status Update Endpoints (Approve/Reject)
**Status:** ⚠️ **PARTIALLY IMPLEMENTED**

- **File:** [server/src/routes/sessions.ts](server/src/routes/sessions.ts#L195-L220)
- **Endpoint:** `PATCH /api/sessions/:id/status`
- **Supported statuses:** `scheduled`, `in-progress`, `completed`, `cancelled`, `no-show`
- **Note:** ⚠️ **MISSING APPROVAL FLOW**
  - No "pending" status for appointment requests
  - Sessions go directly to "scheduled" when created
  - No doctor approval/rejection workflow before session confirmation
  - Would need: Add `pending` status, approval endpoint, rejection logic

### 1.4 Session Status Values/Enums Used
**Status:** ✅ **FULLY IMPLEMENTED**

- **Defined in:** [server/src/routes/sessions.ts](server/src/routes/sessions.ts#L200)
- **Valid statuses:** `['scheduled', 'in-progress', 'completed', 'cancelled', 'no-show']`
- **Used across:** Dashboard, patient portal, therapy tracking
- **Validation:** Enforced at route level with error if invalid status provided

---

## 2. DOCTOR NOTIFICATIONS ✅ MOSTLY COMPLETE

### 2.1 Notification System for New Appointment Requests
**Status:** ⚠️ **PARTIAL - SCHEDULED SESSIONS ONLY**

- **File:** [server/src/services/notification-service.ts](server/src/services/notification-service.ts)
- **Current implementation:**
  - ✅ Notifications created automatically when session is created
  - ✅ Multi-channel support: In-App, Email (Nodemailer/SMTP), SMS (Twilio), Push (FCM)
  - ✅ Notification preferences per patient
  - ⚠️ **MISSING:** Doctor-specific notifications for new requests
    - Notifications only go to patient currently
    - No doctor notification when patient books appointment
    - Would need to emit event for doctor's room

### 2.2 Socket.io Event Emitters for Appointments
**Status:** ✅ **FULLY IMPLEMENTED**

- **File:** [server/src/services/realtime.ts](server/src/services/realtime.ts)
- **Events emitted:**
  - ✅ `session:created` - when new session created (broadcast to dashboard)
  - ✅ `session:updated` - when session status changes
  - ✅ `notification:new` - when notification created
  - ✅ `therapy-progress:refresh` - patient-specific real-time updates
  - ✅ `dashboard:refresh` - dashboard-wide updates
- **Socket rooms:**
  - `dashboard` - doctor dashboard viewers
  - `patient:{patientId}` - patient-specific channels
  - `practitioner:{practitionerId}` - doctor-specific channels
  - `user:{userId}` - general user channels

### 2.3 Email/Nodemailer Setup for Appointments
**Status:** ✅ **FULLY IMPLEMENTED**

- **File:** [server/src/services/notification-service.ts](server/src/services/notification-service.ts#L143-L190)
- **Configuration:** [server/src/config.ts](server/src/config.ts)
- **Features:**
  - ✅ Nodemailer SMTP transporter configured
  - ✅ HTML email templates with branded header
  - ✅ Graceful fallback: simulates sending if SMTP not configured
  - ✅ Multi-channel delivery with fallback routing
  - ⚠️ **TODO:** Appointment-specific email templates (not just pre/post-procedure)

### 2.4 Dashboard Notification Badges
**Status:** ✅ **FULLY IMPLEMENTED**

- **Badge display:**
  - ✅ Unread notification count on Dashboard: [Dashboard.tsx](client/src/pages/Dashboard.tsx#L119)
  - ✅ StatCard showing `Unread Notifications` value
  - ✅ Real-time count from: `GET /api/dashboard` (returns `unreadNotifications`)
- **Implementation:** [server/src/routes/dashboard.ts](server/src/routes/dashboard.ts)
  - Counts notifications where `is_read = 0`

---

## 3. TREATMENT PLAN LOGIC ✅ MOSTLY COMPLETE

### 3.1 Treatment Plan Creation/Linking to Sessions
**Status:** ✅ **FULLY IMPLEMENTED**

- **Files:**
  - Plan creation: [server/src/routes/treatmentPlans.ts](server/src/routes/treatmentPlans.ts#L48-L72)
  - Session linking: Sessions automatically reference `treatment_plan_id`
- **Schema:**
  ```typescript
  {
    id: UUID
    patient_id: string
    practitioner_id: string
    diagnosis: string
    plan_name: string
    start_date: string (YYYY-MM-DD)
    end_date: string (YYYY-MM-DD)
    status: 'active' | 'inactive' (stored as string)
    notes: string | null
    created_at: ISO timestamp
    updated_at: ISO timestamp
  }
  ```
- **Linking:** Each session stores `treatment_plan_id` to link back to plan

### 3.2 Plan Sequence/Timeline Management
**Status:** ⚠️ **PARTIAL - BASIC STRUCTURE ONLY**

- **Basic timeline:** Start and end dates stored in treatment plan
- **Session sequencing:** Sessions ordered by `scheduled_date` and `scheduled_time`
- **Advanced features missing:**
  - ❌ No therapy dependency/sequencing rules enforced
  - ❌ No state machine for therapy sequences (Vamana → Virechana → Basti order)
  - ⚠️ ML layer has sequence definitions but not enforced in sessions
  - ℹ️ Sequences defined in: [ml-service/scheduling_engine.py](ml-service/scheduling_engine.py#L9-L16)
    ```python
    THERAPY_SEQUENCES = {
      'Vamana': {'prep': ['Abhyanga', 'Swedana'], 'follow': ['rest']},
      'Virechana': {'prep': ['Abhyanga', 'Swedana'], 'follow': ['Basti']},
      # ... more sequences
    }
    ```

### 3.3 Start Date from Approved Session
**Status:** ⚠️ **PARTIAL - START DATE USED BUT NO APPROVAL**

- **Location:** Treatment plan stores `start_date`
- **Usage:** Sessions created relative to plan's start date
- **Issue:** No "approval" workflow exists
  - Sessions created directly as "scheduled"
  - Would need: approval step before plan activation

---

## 4. ML SCHEDULING ENGINE ✅ MOSTLY COMPLETE

### 4.1 Batch Session Creation Logic
**Status:** ✅ **FULLY IMPLEMENTED**

- **Endpoint:** `POST /api/sessions/auto-schedule`
- **File:** [server/src/routes/sessions.ts](server/src/routes/sessions.ts#L134-L194)
- **Features:**
  - ✅ Creates multiple sessions in loop
  - ✅ Spaces sessions by `frequency_days`
  - ✅ Creates notifications for each session
  - ✅ Returns array of created sessions with IDs
  - ✅ Emits therapy progress refresh to patient

### 4.2 Session Sequencing from Start Date
**Status:** ✅ **FULLY IMPLEMENTED**

- **Backend sequencing:**
  - [server/src/routes/sessions.ts](server/src/routes/sessions.ts#L150-L165) - Simple date arithmetic
  - [ml-service/scheduling_engine.py](ml-service/scheduling_engine.py) - Advanced ML scoring
  
- **ML scheduling process:**
  1. Takes `start_date`, `num_sessions`, `frequency_days`
  2. Calculates dates by adding `frequency_days` for each session
  3. Respects:
     - ✅ Existing schedules (conflict detection)
     - ✅ Practitioner workload
     - ✅ Therapy optimal times (Ayurvedic principles)
     - ✅ Dosha preferences
     - ⚠️ ❌ Does NOT enforce therapy sequences (Vamana before Virechana, etc.)

### 4.3 Integration with Approved Appointments
**Status:** ⚠️ **PARTIAL - SEQUENCES DEFINED BUT NOT ENFORCED**

- **ML routes:** [server/src/routes/ai.ts](server/src/routes/ai.ts)
  - `POST /api/ai/schedule/suggest` - Gets slot suggestions from ML
  - `POST /api/ai/schedule/auto` - Auto-schedules via ML service
  
- **Python ML service:** [ml-service/scheduling_engine.py](ml-service/scheduling_engine.py)
  - ✅ `find_optimal_slots()` - Returns scored time slots
  - ✅ `auto_schedule_with_ai()` - Creates batch sessions with AI confidence scores
  - ✅ Scoring factors:
    - Optimal therapy times
    - Dosha preference alignment
    - Practitioner workload
    - Patient history patterns
  - ❌ Does NOT check therapy sequences/dependencies
  - ❌ Sequences defined but not applied during scheduling

---

## 5. PATIENT NOTIFICATIONS & PORTAL ✅ MOSTLY COMPLETE

### 5.1 Patient Notification on Appointment Approval
**Status:** ⚠️ **PARTIAL - NO APPROVAL WORKFLOW**

- **Current:** Patient gets notified when session is created (not approved)
- **Notifications created:**
  - Pre-procedure instructions (if therapy has them)
  - Post-procedure instructions (if therapy has them)
  - General reminder notification
- **File:** [server/src/routes/sessions.ts](server/src/routes/sessions.ts#L160-L188)
- **Channels:** In-app, Email, SMS (configured)
- **Missing:** Doctor approval step before this happens

### 5.2 Patient Portal Showing Treatment Timeline
**Status:** ✅ **FULLY IMPLEMENTED**

- **Route:** `GET /api/patient/therapy-progress` (patient-authenticated)
- **File:** [server/src/routes/patientPortal.ts](server/src/routes/patientPortal.ts)
- **Returns:**
  ```typescript
  {
    sessions: Session[]      // All patient's sessions
    plans: TreatmentPlan[]   // All patient's treatment plans
    milestones: Milestone[]  // Recovery milestones
  }
  ```
- **Client display:** [client/src/pages/PatientProgress.tsx](client/src/pages/PatientProgress.tsx)
  - ✅ Treatment plan progress bars
  - ✅ Session timeline by plan
  - ✅ Recovery milestones with status
  - ✅ Live session tracker
  - ✅ Completed/upcoming session counts

### 5.3 Patient Seeing Upcoming Sessions
**Status:** ✅ **FULLY IMPLEMENTED**

- **Display page:** [client/src/pages/PatientProgress.tsx](client/src/pages/PatientProgress.tsx#L40-L50)
- **Features:**
  - ✅ Sessions sorted by date
  - ✅ Filters: `in-progress`, `completed`, `scheduled`
  - ✅ Shows therapy name, practitioner, date/time
  - ✅ Shows duration and status badge
  - ✅ Updates in real-time via socket.io
- **Real-time updates:**
  - Listens to: `session:updated`, `session:created`, `therapy-progress:refresh`
  - Automatically reloads when new sessions added by doctor

---

## SUMMARY TABLE

| Feature Category | Status | Completeness | Notes |
|---|---|---|---|
| Session schema & status | ✅ Complete | 100% | All fields & statuses defined |
| Session creation | ✅ Complete | 100% | Full validation, conflict detection |
| Status updates | ⚠️ Partial | 80% | No approval/rejection workflow |
| Doctor notifications | ⚠️ Partial | 60% | Patient gets notified, not doctor |
| Socket.io events | ✅ Complete | 100% | All necessary events implemented |
| Email setup | ✅ Complete | 95% | Configured, needs appointment templates |
| Dashboard badges | ✅ Complete | 100% | Unread count displayed |
| Treatment plans | ✅ Complete | 100% | Creation, CRUD, linking |
| Plan sequencing | ⚠️ Partial | 40% | Dates defined, sequences not enforced |
| ML batch creation | ✅ Complete | 100% | Full implementation with notifications |
| Session sequencing | ✅ Complete | 90% | Date spacing works, ignores therapy order |
| ML integration | ⚠️ Partial | 70% | Slots suggested but sequences ignored |
| Patient notifications | ⚠️ Partial | 80% | Works but no approval flow |
| Patient portal | ✅ Complete | 100% | Full timeline, milestones, sessions |
| Upcoming sessions | ✅ Complete | 100% | Real-time, filterable, detailed |

---

## KEY GAPS & TODOs

### High Priority (Blocks functionality)
1. ❌ **Doctor Appointment Approval Flow**
   - Need: `pending` session status
   - Need: Doctor approval endpoint
   - Need: Doctor rejection with reason
   - Need: Doctor notification when patient books
   - Impact: Currently bypasses doctor decision-making

2. ❌ **Therapy Sequence Enforcement**
   - Definitions exist in ML but not enforced
   - Vamana should precede Virechana
   - Rest days between therapies not validated
   - Impact: ML recommendations good but not strict

3. ❌ **Treatment Plan Activation**
   - Plans created as "active" immediately
   - No approval step from doctor
   - No explicit "start treatment" confirmation
   - Impact: Plan doesn't wait for doctor approval

### Medium Priority
4. ⚠️ **Doctor-Specific Notifications**
   - Currently only patients get notified
   - Doctors need notification when:
     - New appointment request (when approval added)
     - Patient feedback/side effects
     - Session completion by substitute
   - Would need: Doctor notification preferences

5. ⚠️ **Email Templates**
   - Generic templates exist
   - Need specific templates for:
     - Appointment request (should go to doctor)
     - Appointment confirmation (to patient)
     - Schedule change (to both)

6. ⚠️ **Milestone Management**
   - Milestones created but status not auto-updated
   - Manual updates only
   - Should integrate with session completion feedback

### Low Priority (Nice-to-haves)
7. ℹ️ **Conflict Avoidance in ML**
   - ML service doesn't check patient conflicts
   - Code references it but doesn't implement
   - Same patient shouldn't have overlapping sessions

8. ℹ️ **AI Confidence Scoring in Plan Context**
   - Scores stored per session
   - Not aggregated or analyzed
   - Could show treatment success probability

---

## RECOMMENDATIONS

### Immediate Actions (Week 1)
1. **Add approval workflow:**
   ```typescript
   // Add: POST /api/appointments/request
   // Create session with status: 'pending'
   // Notify doctor
   
   // Add: PATCH /api/appointments/:id/approve
   // Change status: pending → scheduled
   // Notify patient
   
   // Add: PATCH /api/appointments/:id/reject
   // Change status: pending → rejected
   // Send rejection reason to patient
   ```

2. **Doctor notifications:**
   - Add doctor room joining in realtime.ts
   - Emit `appointment:request:new` to doctor room
   - Add notification endpoint for doctors

### Phase 2 (Week 2-3)
3. **Therapy sequence validation:**
   - Implement sequence rules enforcement
   - Check therapy dependencies before scheduling
   - Add rest-day validation between therapies

4. **Milestone automation:**
   - Update milestones on session completion
   - Track progress automatically
   - Calculate achievement probability

### Phase 3 (Week 4+)
5. **Advanced features:**
   - Treatment success prediction
   - Automatic rescheduling on cancellation
   - Patient reminder customization
   - Outcome reporting dashboard

---

## FILES INVOLVED

**Backend Routes:**
- [sessions.ts](server/src/routes/sessions.ts) - Session CRUD
- [treatmentPlans.ts](server/src/routes/treatmentPlans.ts) - Plan management
- [ai.ts](server/src/routes/ai.ts) - ML integration
- [patientPortal.ts](server/src/routes/patientPortal.ts) - Patient-facing API
- [dashboard.ts](server/src/routes/dashboard.ts) - Doctor dashboard
- [notifications.ts](server/src/routes/notifications.ts) - Notification management

**Services:**
- [notification-service.ts](server/src/services/notification-service.ts) - Multi-channel notifications
- [realtime.ts](server/src/services/realtime.ts) - Socket.io events

**Frontend Pages:**
- [PatientProgress.tsx](client/src/pages/PatientProgress.tsx) - Patient portal
- [Dashboard.tsx](client/src/pages/Dashboard.tsx) - Doctor dashboard
- [Scheduling.tsx](client/src/pages/Scheduling.tsx) - Scheduling UI
- [Notifications.tsx](client/src/pages/Notifications.tsx) - Notification center

**ML Service:**
- [scheduling_engine.py](ml-service/scheduling_engine.py) - Scheduling algorithms
- [personalization_engine.py](ml-service/personalization_engine.py) - Recommendations

**Database Schema:**
- [database.ts](server/src/models/database.ts) - Collection definitions
- 12 Firestore collections active

