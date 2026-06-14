const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Universal auth — works for both doctors and patients
export const userAuth = {
  getToken: (): string | null => localStorage.getItem('user_token') || localStorage.getItem('doctor_token'),
  getRefreshToken: (): string | null => localStorage.getItem('user_refresh_token'),
  getUser: (): any => {
    try {
      const u = localStorage.getItem('user_info');
      if (u) return JSON.parse(u);
      const d = localStorage.getItem('doctor_info');
      return d ? JSON.parse(d) : null;
    } catch (e) {
      console.error('Failed to parse user info from localStorage', e);
      return null;
    }
  },
  getRole: (): 'doctor' | 'patient' | null => {
    const r = localStorage.getItem('user_role') as 'doctor' | 'patient' | null;
    if (r) return r;
    // backward-compat: if doctor_token exists but no user_role
    return localStorage.getItem('doctor_token') ? 'doctor' : null;
  },
  save: (token: string, user: any, role: 'doctor' | 'patient', refreshToken?: string) => {
    localStorage.setItem('user_token', token);
    localStorage.setItem('user_info', JSON.stringify(user));
    localStorage.setItem('user_role', role);
    if (refreshToken) {
      localStorage.setItem('user_refresh_token', refreshToken);
    }
    if (role === 'doctor') {
      // keep backward-compat keys so Scheduling.tsx still works
      localStorage.setItem('doctor_token', token);
      localStorage.setItem('doctor_info', JSON.stringify(user));
    } else {
      // clear any stale doctor tokens so role resolution stays correct
      localStorage.removeItem('doctor_token');
      localStorage.removeItem('doctor_info');
    }
  },
  clear: () => {
    ['user_token', 'user_info', 'user_role', 'doctor_token', 'doctor_info', 'user_refresh_token'].forEach(k =>
      localStorage.removeItem(k)
    );
  },
  isLoggedIn: (): boolean => !!(localStorage.getItem('user_token') || localStorage.getItem('doctor_token')),
};

// Backward-compat shim for Scheduling.tsx and other existing code
export const doctorAuth = {
  getToken: () => userAuth.getToken(),
  getDoctor: () => userAuth.getRole() === 'doctor' ? userAuth.getUser() : null,
  save: (token: string, doctor: any, refreshToken?: string) => userAuth.save(token, doctor, 'doctor', refreshToken),
  clear: () => userAuth.clear(),
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    // Preserve error details from API
    const errorMsg = errorData.error || errorData.message || res.statusText;
    const error = new Error(errorMsg);
    (error as any).details = errorData;
    throw error;
  }
  return res.json();
}

// Refresh access token using refresh token
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = userAuth.getRefreshToken();
  if (!refreshToken) return false;
  
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!res.ok) {
      userAuth.clear();
      return false;
    }
    
    const data = await res.json();
    const user = userAuth.getUser();
    const role = userAuth.getRole();
    
    if (data.accessToken && user && role) {
      userAuth.save(data.accessToken, user, role, data.refreshToken || refreshToken);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Authenticated request (adds Bearer token from unified userAuth)
// Automatically refreshes token if expired (401 response)
async function authRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = userAuth.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...options,
  });
  
  // If token expired (401), try to refresh and retry once
  if (res.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = userAuth.getToken();
      const retryRes = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}) },
        ...options,
      });
      if (!retryRes.ok) {
        const error = await retryRes.json().catch(() => ({ error: retryRes.statusText }));
        throw new Error(error.error || 'Request failed');
      }
      if (retryRes.status === 204) return undefined as T;
      return retryRes.json();
    } else {
      throw new Error('Session expired. Please login again.');
    }
  }
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Dashboard
  getStats: () => request<any>('/dashboard/stats'),
  getUpcomingSessions: () => request<any[]>('/dashboard/upcoming-sessions'),
  getTherapyDistribution: () => request<any[]>('/dashboard/therapy-distribution'),
  getWeeklySessions: () => request<any[]>('/dashboard/weekly-sessions'),
  getPatientProgress: () => request<any[]>('/dashboard/patient-progress'),
  getAiInsights: () => request<any>('/dashboard/ai-insights'),

  // Patients
  getPatients: () => request<any[]>('/patients'),
  getPatient: (id: string) => request<any>(`/patients/${id}`),
  createPatient: (data: any) => request<any>('/patients', { method: 'POST', body: JSON.stringify(data) }),
  updatePatient: (id: string, data: any) => request<any>(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePatient: (id: string) => request<void>(`/patients/${id}`, { method: 'DELETE' }),
  getPatientHistory: (id: string) => request<any>(`/patients/${id}/history`),

  // Practitioners
  getPractitioners: () => request<any[]>('/practitioners'),
  getPractitioner: (id: string) => request<any>(`/practitioners/${id}`),
  createPractitioner: (data: any) => request<any>('/practitioners', { method: 'POST', body: JSON.stringify(data) }),
  getPractitionerSchedule: (id: string, date?: string) =>
    request<any[]>(`/practitioners/${id}/schedule${date ? `?date=${date}` : ''}`),

  // Therapy Types
  getTherapyTypes: () => request<any[]>('/therapy-types'),
  getTherapyType: (id: string) => request<any>(`/therapy-types/${id}`),
  createTherapyType: (data: any) => request<any>('/therapy-types', { method: 'POST', body: JSON.stringify(data) }),

  // Treatment Plans
  getTreatmentPlans: () => request<any[]>('/treatment-plans'),
  getTreatmentPlan: (id: string) => request<any>(`/treatment-plans/${id}`),
  createTreatmentPlan: (data: any) => request<any>('/treatment-plans', { method: 'POST', body: JSON.stringify(data) }),
  getPatientTreatmentPlans: (patientId: string) =>
    authRequest<any[]>(`/treatment-plans?patient_id=${patientId}`),
  updateTreatmentPlan: (id: string, data: any) =>
    request<any>(`/treatment-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Sessions - PHASE 1: Get pending appointments for doctor
  getDoctorPendingAppointments: (practitionerId: string) =>
    authRequest<any[]>(`/sessions/doctor/${practitionerId}/pending`),

  // Sessions - PHASE 1: Approve pending appointment
  approveAppointment: (sessionId: string, notes?: string) =>
    authRequest<any>(`/sessions/${sessionId}/approve`, { 
      method: 'PUT', 
      body: JSON.stringify({ approval_notes: notes }) 
    }),

  // Sessions - PHASE 1: Reject pending appointment
  rejectAppointment: (sessionId: string, reason: string) =>
    authRequest<any>(`/sessions/${sessionId}/reject`, { 
      method: 'PUT', 
      body: JSON.stringify({ rejection_reason: reason }) 
    }),

  // Sessions
  getSessions: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/sessions${query}`);
  },
  getSession: (id: string) => request<any>(`/sessions/${id}`),
  createSession: (data: any) => request<any>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  autoSchedule: (data: any) => request<any>('/sessions/auto-schedule', { method: 'POST', body: JSON.stringify(data) }),
  updateSessionStatus: (id: string, data: any) => request<any>(`/sessions/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  rescheduleSession: (id: string, data: any) => request<any>(`/sessions/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify(data) }),
  startTherapySession: (sessionId: string, sessionNotes?: string) =>
    authRequest<any>(`/sessions/${sessionId}/start`, {
      method: 'PATCH',
      body: JSON.stringify({ session_notes: sessionNotes }),
    }),
  clearSessions: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/sessions/clear${query}`, { method: 'DELETE' });
  },

  // Notifications
  getNotifications: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/notifications${query}`);
  },
  getUnreadCount: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ count: number }>(`/notifications/unread-count${query}`);
  },
  markRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: (params?: Record<string, string>) =>
    request<any>('/notifications/read-all', { method: 'PATCH', body: JSON.stringify(params || {}) }),
  createNotification: (data: any) => request<any>('/notifications', { method: 'POST', body: JSON.stringify(data) }),
  getNotificationPrefs: (patientId: string) => request<any>(`/notifications/preferences/${patientId}`),
  updateNotificationPrefs: (patientId: string, data: any) =>
    request<any>(`/notifications/preferences/${patientId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getChannelStatus: () => request<any>('/channels'),
  clearNotifications: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/notifications${query}`, { method: 'DELETE' });
  },

  // Feedback
  getSessionFeedback: (sessionId: string) => request<any[]>(`/feedback/session/${sessionId}`),
  getPatientFeedback: (patientId: string) => request<any[]>(`/feedback/patient/${patientId}`),
  submitFeedback: (data: any) => request<any>('/feedback', { method: 'POST', body: JSON.stringify(data) }),
  getProgressTrends: (patientId: string) => request<any[]>(`/feedback/trends/${patientId}`),

  // Milestones
  getPlanMilestones: (planId: string) => request<any[]>(`/milestones/plan/${planId}`),
  getPatientMilestones: (patientId: string) => request<any[]>(`/milestones/patient/${patientId}`),
  createMilestone: (data: any) => request<any>('/milestones', { method: 'POST', body: JSON.stringify(data) }),
  updateMilestone: (id: string, data: any) => request<any>(`/milestones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Practitioner Availability
  getAvailability: (practitionerId?: string) =>
    request<any[]>(`/availability${practitionerId ? `?practitioner_id=${practitionerId}` : ''}`),
  addAvailability: (data: any) => authRequest<any>('/availability', { method: 'POST', body: JSON.stringify(data) }),
  deleteAvailability: (id: string) => authRequest<void>(`/availability/${id}`, { method: 'DELETE' }),
  checkAvailability: (practitionerId: string, date: string) =>
    request<any>(`/availability/check?practitioner_id=${practitionerId}&date=${date}`),

  // Doctor Auth
  doctorLogin: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; expiresIn: number; tokenType: string; doctor: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  // New: Doctor self-registration
  registerDoctor: (data: { name: string; email: string; password: string; specialization: string; doctor_type?: string; license_number?: string; experience_years?: number }) =>
    request<{ accessToken: string; refreshToken: string; expiresIn: number; tokenType: string; doctor: any }>('/auth/register/doctor', { method: 'POST', body: JSON.stringify(data) }),

  // New: Patient self-registration
  registerPatient: (data: { name: string; email: string; password: string; age?: number; phone?: string; gender?: string }) =>
    request<{ accessToken: string; refreshToken: string; expiresIn: number; tokenType: string; patient: any }>('/auth/register/patient', { method: 'POST', body: JSON.stringify(data) }),

  // New: Patient login
  patientLogin: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; expiresIn: number; tokenType: string; patient: any }>('/auth/login/patient', { method: 'POST', body: JSON.stringify({ email, password }) }),

  // New: Get current doctor's full profile
  getDoctorMe: () => authRequest<any>('/auth/me'),

  // New: Doctor updates their own profile
  updateDoctorProfile: (data: any) =>
    authRequest<any>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Patient portal (JWT patient only) — same underlying data as doctor therapy views, scoped to you
  getPatientTherapyProgress: () =>
    authRequest<{ sessions: any[]; plans: any[]; milestones: any[] }>('/patient-portal/therapy-progress'),

  // New: Public doctor search for patients
  getPublicDoctors: (params?: { search?: string; specialization?: string; doctor_type?: string }) => {
    const filtered = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v)) as Record<string, string>;
    const query = Object.keys(filtered).length ? '?' + new URLSearchParams(filtered).toString() : '';
    return request<any[]>(`/practitioners/public${query}`);
  },

  // AI Endpoints
  aiSuggestSlots: (data: any) => request<any>('/ai/schedule/suggest', { method: 'POST', body: JSON.stringify(data) }),
  aiAutoSchedule: (data: any) => request<any>('/ai/schedule/auto', { method: 'POST', body: JSON.stringify(data) }),
  aiRecommend: (patientId: string) => request<any>('/ai/recommend', { method: 'POST', body: JSON.stringify({ patient_id: patientId }) }),
  aiInsights: (patientId: string) => request<any>('/ai/insights', { method: 'POST', body: JSON.stringify({ patient_id: patientId }) }),

  // Recommendation Endpoints
  recommendTherapiesForAppointment: (appointmentId: string, patientId: string, therapyTypeId: string) =>
    request<any>('/recommend/therapies-for-appointment', { 
      method: 'POST', 
      body: JSON.stringify({ appointment_id: appointmentId, patient_id: patientId, therapy_type_id: therapyTypeId }) 
    }),

  // Messaging
  sendMessage: (receiverId: string, content: string) =>
    authRequest<any>('/messages/send', { method: 'POST', body: JSON.stringify({ receiver_id: receiverId, content }) }),
  getConversation: (otherUserId: string, limit = 50, offset = 0) =>
    authRequest<any>(`/messages/conversation/${otherUserId}?limit=${limit}&offset=${offset}`),
  getConversations: () =>
    authRequest<any[]>('/messages/conversations'),
  getUnreadMessageCount: () =>
    authRequest<{ unread_count: number }>('/messages/unread-count'),

  // Appointments - Patient booking
  bookAppointment: (data: {
    patient_id: string;
    doctor_id: string;
    therapy_type_id?: string;
    therapy_type: string;
    preferred_date: string;
    preferred_time: string;
    reason_for_visit?: string;
    duration_minutes?: number;
  }) =>
    authRequest<any>('/appointments', { method: 'POST', body: JSON.stringify(data) }),

  // Appointments - Get all appointments (with filters)
  getAppointments: (params?: { patient_id?: string; doctor_id?: string; status?: string }) => {
    const filtered = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v)) as Record<string, string>;
    const query = Object.keys(filtered).length ? '?' + new URLSearchParams(filtered).toString() : '';
    return authRequest<any[]>(`/appointments${query}`);
  },

  // Appointments - Get single appointment
  getAppointment: (id: string) =>
    authRequest<any>(`/appointments/${id}`),

  // Appointments - Doctor accept
  acceptAppointment: (appointmentId: string, availability_note?: string) =>
    authRequest<any>(`/appointments/${appointmentId}/accept`, {
      method: 'PATCH',
      body: JSON.stringify({ availability_note }),
    }),

  // Appointments - Doctor reject
  rejectAppointmentRequest: (appointmentId: string, rejection_reason: string, send_apology_message = true) =>
    authRequest<any>(`/appointments/${appointmentId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ rejection_reason, send_apology_message }),
    }),

  // Appointments - Get pending for doctor
  getPendingAppointmentRequests: (doctorId: string) =>
    authRequest<any[]>(`/appointments/doctor/${doctorId}/pending`),

  // Appointments - Get patient's appointment history
  getPatientAppointmentHistory: (patientId: string) =>
    authRequest<any[]>(`/appointments/patient/${patientId}/history`),

  // Appointments - Clear history
  clearAppointments: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return authRequest<any>(`/appointments/clear${query}`, { method: 'DELETE' });
  },
};
