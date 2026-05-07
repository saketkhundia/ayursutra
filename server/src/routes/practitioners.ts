import { Router, Request, Response } from 'express';
import db, { collections, docToObj, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const snap = await collections.practitioners().get();
  const practitioners = queryToArray(snap).filter((p: any) => p.is_active === 1).sort((a: any, b: any) => a.name.localeCompare(b.name));
  res.json(practitioners);
});

// GET /practitioners/public — patients browse all active verified doctors (no auth required)
// GET /practitioners/public — patients browse all active doctors (no auth required)
router.get('/public', async (req: Request, res: Response) => {
  try {
    const { specialization, search, city, doctor_type, sort_by } = req.query;

    // Fetch all active practitioners
    const snap = await collections.practitioners().get();
    let doctors = queryToArray(snap)
      .filter((p: any) => p.is_active === 1)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email || '',
        specialization: p.specialization || '',
        doctor_type: p.doctor_type || 'Ayurveda',
        experience_years: p.experience_years || 0,
        bio: p.bio || '',
        qualifications: p.qualifications || '',
        phone: p.phone || '',
        verified: p.verified || false,
        license_number: p.license_number || '',
        // Location fields
        address: p.address || '',
        city: p.city || '',
        state: p.state || '',
        zipcode: p.zipcode || '',
        latitude: p.latitude || null,
        longitude: p.longitude || null,
      }));

    // Filter by specialization
    if (specialization) {
      const spec = (specialization as string).toLowerCase();
      doctors = doctors.filter(d => d.specialization.toLowerCase().includes(spec));
    }

    // Filter by doctor type
    if (doctor_type) {
      const dt = (doctor_type as string).toLowerCase();
      doctors = doctors.filter(d => d.doctor_type.toLowerCase() === dt);
    }

    // Filter by city
    if (city) {
      const c = (city as string).toLowerCase();
      doctors = doctors.filter(d => d.city.toLowerCase().includes(c));
    }

    // Text search across name, specialization, bio, qualifications, city
    if (search) {
      const q = (search as string).toLowerCase();
      doctors = doctors.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q) ||
        d.bio.toLowerCase().includes(q) ||
        d.qualifications.toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q)
      );
    }

    // Sorting: verified first, then by experience or distance
    doctors.sort((a, b) => {
      // Verified doctors get priority
      if (b.verified !== a.verified) return b.verified ? 1 : -1;
      // If same verification status, sort by experience (descending)
      if (sort_by === 'experience') {
        return b.experience_years - a.experience_years;
      }
      // Default: alphabetical
      return a.name.localeCompare(b.name);
    });

    res.json(doctors);
  } catch (err: any) {
    console.error('[practitioners/public]', err.message);
    res.status(500).json({ error: 'Failed to load doctors' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  if (req.params.id === 'public') {
    return res.json([]);
  }
  const doc = await collections.practitioners().doc(req.params.id as string).get();
  const practitioner = docToObj(doc);
  if (!practitioner) return res.status(404).json({ error: 'Practitioner not found' });
  res.json(practitioner);
});

router.post('/', async (req: Request, res: Response) => {
  const { name, specialization, experience_years, phone, email } = req.body;
  if (!name || !specialization) {
    return res.status(400).json({ error: 'Name and specialization are required' });
  }

  const id = uuidv4();
  await collections.practitioners().doc(id).set({
    name, specialization, experience_years: experience_years || 0,
    phone: phone || null, email: email || null,
    is_active: 1, created_at: new Date().toISOString(),
  });

  const practitioner = docToObj(await collections.practitioners().doc(id).get());
  res.status(201).json(practitioner);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, specialization, experience_years, phone, email, is_active } = req.body;
  const doc = await collections.practitioners().doc(req.params.id as string).get();
  if (!doc.exists) return res.status(404).json({ error: 'Practitioner not found' });

  await collections.practitioners().doc(req.params.id as string).update({
    name, specialization, experience_years, phone, email, is_active: is_active ?? 1,
  });

  const practitioner = docToObj(await collections.practitioners().doc(req.params.id as string).get());
  res.json(practitioner);
});

// Get practitioner's schedule
router.get('/:id/schedule', async (req: Request, res: Response) => {
  const { date } = req.query;
  let query = collections.therapySessions()
    .where('practitioner_id', '==', req.params.id as string) as FirebaseFirestore.Query;

  if (date) {
    query = query.where('scheduled_date', '==', date);
  } else {
    const today = new Date().toISOString().split('T')[0];
    query = query.where('scheduled_date', '>=', today);
  }

  const snap = await query.get();
  const sessions = queryToArray(snap);

  // Enrich with names
  for (const s of sessions) {
    const ttDoc = await collections.therapyTypes().doc(s.therapy_type_id).get();
    const pDoc = await collections.patients().doc(s.patient_id).get();
    s.therapy_name = ttDoc.exists ? ttDoc.data()?.name : '';
    s.patient_name = pDoc.exists ? pDoc.data()?.name : '';
  }

  res.json(sessions);
});

export default router;
