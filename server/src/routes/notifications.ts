import { Router, Request, Response } from 'express';
import db, { collections, docToObj, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get notifications for a patient
router.get('/', async (req: Request, res: Response) => {
  const { patient_id, unread_only } = req.query;
  let query: FirebaseFirestore.Query = collections.notifications();

  if (patient_id) query = query.where('patient_id', '==', patient_id as string);
  if (unread_only === 'true') query = query.where('is_read', '==', 0);

  const snap = await query.get();
  const notifications = queryToArray(snap).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
  res.json(notifications);
});

// Get unread count
router.get('/unread-count', async (req: Request, res: Response) => {
  const { patient_id } = req.query;
  let query: FirebaseFirestore.Query = collections.notifications()
    .where('is_read', '==', 0);
  if (patient_id) query = query.where('patient_id', '==', patient_id as string);
  const snap = await query.get();
  res.json({ count: snap.size });
});

// Mark notification as read
router.patch('/:id/read', async (req: Request<{id: string}>, res: Response) => {
  await collections.notifications().doc(req.params.id).update({ is_read: 1 });
  res.json({ message: 'Notification marked as read' });
});

// Mark all as read — optionally filtered by patient
router.patch('/read-all', async (req: Request, res: Response) => {
  const { patient_id } = req.body;

  let query: FirebaseFirestore.Query = collections.notifications()
    .where('is_read', '==', 0);

  if (patient_id) {
    query = query.where('patient_id', '==', patient_id);
  }

  const snap = await query.get();

  const batch = db.batch();
  snap.docs.forEach(doc => batch.update(doc.ref, { is_read: 1 }));
  await batch.commit();

  res.json({ message: 'All notifications marked as read', count: snap.size });
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

export default router;
