import { Router, Request, Response } from 'express';
import { collections, docToObj, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { verifyDoctorToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /availability?practitioner_id=X  — get all slots for a practitioner
router.get('/', async (req: Request, res: Response) => {
  const { practitioner_id } = req.query;
  let query: FirebaseFirestore.Query = collections.practitionerAvailability();
  if (practitioner_id) query = query.where('practitioner_id', '==', practitioner_id);

  const snap = await query.get();
  const slots = queryToArray(snap).sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  // Enrich with practitioner name
  const prIds = [...new Set(slots.map((s: any) => s.practitioner_id))];
  const prMap: Record<string, string> = {};
  await Promise.all(prIds.map(async (id) => {
    const doc = await collections.practitioners().doc(id as string).get();
    prMap[id as string] = doc.exists ? (doc.data()?.name || '') : '';
  }));

  res.json(slots.map((s: any) => ({ ...s, practitioner_name: prMap[s.practitioner_id] || '' })));
});

// POST /availability — add an availability slot (requires doctor JWT)
router.post('/', verifyDoctorToken, async (req: AuthRequest, res: Response) => {
  const { practitioner_id, day_of_week, start_time, end_time } = req.body;

  if (!practitioner_id || day_of_week === undefined || !start_time || !end_time) {
    return res.status(400).json({ error: 'practitioner_id, day_of_week, start_time, and end_time are required' });
  }
  // Doctors can only post their own availability
  if (req.doctor!.id !== practitioner_id) {
    return res.status(403).json({ error: 'You can only manage your own availability' });
  }
  if (day_of_week < 0 || day_of_week > 6) {
    return res.status(400).json({ error: 'day_of_week must be 0 (Sun) to 6 (Sat)' });
  }
  if (start_time >= end_time) {
    return res.status(400).json({ error: 'start_time must be before end_time' });
  }

  // Check practitioner exists
  const prDoc = await collections.practitioners().doc(practitioner_id).get();
  if (!prDoc.exists) return res.status(404).json({ error: 'Practitioner not found' });

  const id = uuidv4();
  await collections.practitionerAvailability().doc(id).set({
    practitioner_id, day_of_week: Number(day_of_week),
    start_time, end_time,
    created_at: new Date().toISOString(),
  });

  const slot = docToObj(await collections.practitionerAvailability().doc(id).get());
  res.status(201).json({ ...slot, practitioner_name: prDoc.data()?.name || '' });
});

// DELETE /availability/:id — remove a slot (requires doctor JWT for own slots)
router.delete('/:id', verifyDoctorToken, async (req: AuthRequest, res: Response) => {
  const doc = await collections.practitionerAvailability().doc(String(req.params.id)).get();
  if (!doc.exists) return res.status(404).json({ error: 'Availability slot not found' });
  // Doctors can only delete their own slots
  if (doc.data()?.practitioner_id !== req.doctor!.id) {
    return res.status(403).json({ error: 'You can only delete your own availability slots' });
  }
  await collections.practitionerAvailability().doc(String(req.params.id)).delete();
  res.json({ message: 'Availability slot deleted' });
});

// GET /availability/check?practitioner_id=X&date=YYYY-MM-DD
// Returns the available time slots for a given day, minus already-booked sessions
router.get('/check', async (req: Request, res: Response) => {
  const { practitioner_id, date } = req.query;
  if (!practitioner_id || !date) {
    return res.status(400).json({ error: 'practitioner_id and date are required' });
  }

  const dateStr = date as string;
  const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay(); // avoid timezone issues

  // Get availability for this day
  const availSnap = await collections.practitionerAvailability()
    .where('practitioner_id', '==', practitioner_id)
    .where('day_of_week', '==', dayOfWeek).get();

  if (availSnap.empty) {
    return res.json({ available: false, day_of_week: dayOfWeek, slots: [] });
  }

  // Get existing sessions on this date for this practitioner (excluding cancelled)
  const sessSnap = await collections.therapySessions()
    .where('practitioner_id', '==', practitioner_id)
    .where('scheduled_date', '==', dateStr).get();

  const bookedSlots = sessSnap.docs
    .map(d => d.data())
    .filter(s => s.status !== 'cancelled')
    .map(s => ({ start: s.scheduled_time, duration: s.duration_minutes || 60 }));

  const addMin = (t: string, m: number) => {
    const [h, min] = t.split(':').map(Number);
    const tot = h * 60 + min + m;
    return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
  };

  // Generate 30-min slots within each availability window
  const freeSlots: string[] = [];
  for (const avail of queryToArray(availSnap)) {
    let cursor = avail.start_time;
    while (cursor < avail.end_time) {
      const slotEnd = addMin(cursor, 30);
      if (slotEnd > avail.end_time) break;
      // Check not booked
      const isBooked = bookedSlots.some(b => cursor < addMin(b.start, b.duration) && slotEnd > b.start);
      if (!isBooked) freeSlots.push(cursor);
      cursor = addMin(cursor, 30);
    }
  }

  res.json({ available: freeSlots.length > 0, day_of_week: dayOfWeek, slots: freeSlots });
});

export default router;
