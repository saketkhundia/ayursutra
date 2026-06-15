import { Router, Request, Response } from 'express';
import { collections, docToObj, queryToArray, batch } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from '../services/realtime';

const router = Router();

// Get notifications for a patient
router.get('/', async (req: Request, res: Response) => {
  try {
    const { patient_id, unread_only, role } = req.query;
    let query: FirebaseFirestore.Query = collections.notifications();

    if (role === 'doctor' && !patient_id) {
      query = query.where('patient_id', '==', '');
    } else if (patient_id) {
      query = query.where('patient_id', '==', patient_id as string);
    }

    const snap = await query.get();
    let notifications = queryToArray(snap);

    if (unread_only === 'true') {
      notifications = notifications.filter((n: any) => n.is_read === 0);
    }

    notifications.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
    res.json(notifications);
  } catch (error: any) {
    console.error('[Notifications] Error fetching notifications:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get unread count
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const { patient_id, role } = req.query;
    let query: FirebaseFirestore.Query = collections.notifications();

    if (role === 'doctor' && !patient_id) {
      query = query.where('patient_id', '==', '');
    } else if (role === 'patient' && !patient_id) {
      return res.json({ count: 0 });
    } else if (patient_id) {
      query = query.where('patient_id', '==', patient_id as string);
    }

    const snap = await query.get();
    const count = snap.docs.filter(d => d.data().is_read !== 1).length;
    res.json({ count });
  } catch (error: any) {
    console.error('[Notifications] Error fetching unread count:', error);
    res.json({ count: 0 });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req: Request<{id: string}>, res: Response) => {
  const notifDoc = await collections.notifications().doc(req.params.id).get();
  if (!notifDoc.exists) return res.status(404).json({ error: 'Notification not found' });
  await notifDoc.ref.update({ is_read: 1 });

  const notif = notifDoc.data()!;
  const io = getIO();
  if (io) {
    io.to('dashboard').emit('notification');
    if (notif.patient_id) {
      io.to(`patient:${notif.patient_id}`).emit('notification');
    }
  }

  res.json({ message: 'Notification marked as read' });
});

// Mark all as read — optionally filtered by patient
router.patch('/read-all', async (req: Request, res: Response) => {
  try {
    const { patient_id, role } = req.body;

    let query: FirebaseFirestore.Query = collections.notifications();

    if (role === 'doctor' && !patient_id) {
      query = query.where('patient_id', '==', '');
    } else if (patient_id) {
      query = query.where('patient_id', '==', patient_id as string);
    } else {
      return res.status(400).json({ error: 'patient_id or role=doctor is required' });
    }

    const snap = await query.get();

    const fbBatch = batch();
    snap.docs.forEach(doc => {
      if (doc.data().is_read !== 1) {
        fbBatch.update(doc.ref, { is_read: 1 });
      }
    });
    await fbBatch.commit();

    const io = getIO();
    if (io) {
      io.to('dashboard').emit('notification');
      if (patient_id) {
        io.to(`patient:${patient_id}`).emit('notification');
      }
    }

    res.json({ message: 'All notifications marked as read', count: snap.size });
  } catch (error: any) {
    console.error('[Notifications] Error marking all as read:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create custom notification
router.post('/', async (req: Request, res: Response) => {
  const { patient_id, session_id, type, channel, title, message, scheduled_for } = req.body;
  if (!patient_id || !title || !message) {
    return res.status(400).json({ error: 'patient_id, title, and message are required' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  await collections.notifications().doc(id).set({
    patient_id, session_id: session_id || null,
    type: type || 'custom', channel: channel || 'in-app',
    title, message, is_read: 0, delivery_status: 'pending',
    scheduled_for: scheduled_for || null, sent_at: null,
    created_at: now,
  });

  const notification = docToObj(await collections.notifications().doc(id).get());
  res.status(201).json(notification);
});

// Get notification preferences
router.get('/preferences/:patient_id', async (req: Request, res: Response) => {
  const snap = await collections.notificationPreferences()
    .where('patient_id', '==', req.params.patient_id).limit(1).get();
  if (snap.empty) return res.status(404).json({ error: 'Preferences not found' });
  res.json({ id: snap.docs[0].id, ...snap.docs[0].data() });
});

// Update notification preferences
router.put('/preferences/:patient_id', async (req: Request, res: Response) => {
  const { in_app, sms, email, reminder_hours_before } = req.body;
  const snap = await collections.notificationPreferences()
    .where('patient_id', '==', req.params.patient_id).limit(1).get();

  if (snap.empty) return res.status(404).json({ error: 'Preferences not found' });

  await snap.docs[0].ref.update({
    in_app: in_app ?? 1, sms: sms ?? 0, email: email ?? 1,
    reminder_hours_before: reminder_hours_before ?? 24,
  });

  const updated = await snap.docs[0].ref.get();
  res.json({ id: updated.id, ...updated.data() });
});

// Clear all notifications (with role/patient_id filter)
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { patient_id, role } = req.query;
    let query: FirebaseFirestore.Query = collections.notifications();

    if (role === 'doctor' && !patient_id) {
      query = query.where('patient_id', '==', '');
    } else if (patient_id) {
      query = query.where('patient_id', '==', patient_id as string);
    } else {
      return res.status(400).json({ error: 'patient_id or role=doctor is required to clear notifications' });
    }

    const snap = await query.get();
    const fbBatch = batch();
    snap.docs.forEach(doc => fbBatch.delete(doc.ref));
    await fbBatch.commit();

    const io = getIO();
    if (io) {
      io.to('dashboard').emit('notification');
      if (patient_id) {
        io.to(`patient:${patient_id}`).emit('notification');
      }
    }

    res.json({ message: 'Notifications cleared', count: snap.size });
  } catch (error: any) {
    console.error('[Notifications] Error clearing notifications:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
