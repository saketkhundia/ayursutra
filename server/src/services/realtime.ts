/**
 * ATASS Real-Time Service (Socket.io)
 * Provides WebSocket connections for live session tracking,
 * instant notification delivery, and dashboard updates.
 */
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

export function initializeRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/ws',
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // Join user-specific room for messages and notifications
    socket.on('join:user', (userId: string) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`[WS] User ${userId} joined personal room`);
      }
    });

    // Join patient-specific room for targeted notifications
    socket.on('join:patient', (patientId: string) => {
      socket.join(`patient:${patientId}`);
    });

    // Join practitioner-specific room
    socket.on('join:practitioner', (practitionerId: string) => {
      socket.join(`practitioner:${practitionerId}`);
    });

    // Join dashboard room for global updates
    socket.on('join:dashboard', () => {
      socket.join('dashboard');
    });

    // Leave a room (cleanup on unmount)
    socket.on('leave', (room: string) => {
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Emit events to specific rooms
/** Notify patient app to reload therapy progress (stays in sync with doctor portal) */
export function emitTherapyProgressRefresh(patientId: string) {
  if (!io || !patientId) return;
  io.to(`patient:${patientId}`).emit('therapy-progress:refresh', { patient_id: patientId });
}

export function emitSessionUpdate(session: any) {
  if (!io) return;
  io.to('dashboard').emit('session:updated', session);
  if (session.patient_id) {
    io.to(`patient:${session.patient_id}`).emit('session:updated', session);
    emitTherapyProgressRefresh(session.patient_id);
  }
  if (session.practitioner_id) {
    io.to(`practitioner:${session.practitioner_id}`).emit('session:updated', session);
  }
}

export function emitSessionCreated(session: any) {
  if (!io) return;
  io.to('dashboard').emit('session:created', session);
  if (session.patient_id) {
    io.to(`patient:${session.patient_id}`).emit('session:created', session);
    emitTherapyProgressRefresh(session.patient_id);
  }
}

export function emitNotification(notification: any) {
  if (!io) return;
  if (notification.patient_id) {
    console.log(`[WS] emitNotification -> patient:${notification.patient_id} | title="${notification.title}" | msg="${(notification.message || '').substring(0, 60)}"`);
    io.to(`patient:${notification.patient_id}`).emit('notification:new', notification);
  }
}

export function emitDoctorNotification(notification: any) {
  if (!io) return;
  console.log(`[WS] emitDoctorNotification -> dashboard | title="${notification.title}" | msg="${(notification.message || '').substring(0, 60)}"`);
  io.to('dashboard').emit('notification:new', notification);
}

export function emitDashboardRefresh() {
  if (!io) return;
  io.to('dashboard').emit('dashboard:refresh');
}

/**
 * Emit message sent to receiver in real-time
 */
export function emitMessageSent(receiverId: string, message: any) {
  if (!io || !receiverId) return;
  // Emit to both receiver AND sender so both see the message
  io.to(`user:${receiverId}`).emit('message:new', message);
  io.to(`user:${message.sender_id}`).emit('message:new', message);
}

/**
 * Emit message read notification to sender
 */
export function emitMessageRead(userId: string, messageId: string) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit('message:read', { message_id: messageId });
}

/**
 * Join a user-specific room for messages
 */
export function joinUserRoom(socket: Socket, userId: string) {
  if (socket && userId) {
    socket.join(`user:${userId}`);
  }
}

// PHASE 1: Emit doctor notification for pending appointment request
export function emitDoctorAppointmentRequest(doctorId: string, data: any) {
  if (!io || !doctorId) return;
  io.to(`practitioner:${doctorId}`).emit('appointment:request', data);
  io.to('dashboard').emit('pending-appointments:update', { practitioner_id: doctorId });
}

// PHASE 2: Emit treatment plan created event to patient
export function emitTreatmentPlanCreated(patientId: string, data: any) {
  if (!io || !patientId) return;
  io.to(`patient:${patientId}`).emit('treatment-plan:created', data);
  io.to(`patient:${patientId}`).emit('appointment:confirmed', data);
  emitTherapyProgressRefresh(patientId);
}

// Emit pending appointment count update
export function emitPendingAppointmentsCount(doctorId: string, count: number) {
  if (!io || !doctorId) return;
  io.to(`practitioner:${doctorId}`).emit('pending-appointments:count', { count });
}

export function getIO(): Server | null {
  return io;
}
