import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { collections, getAuth, batch } from '../models/database';
import {
  verifyDoctorToken,
  verifyPatientToken,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  AuthRequest,
} from '../middleware/auth';
import { validateRequest, loginSchema, registerDoctorSchema, registerPatientSchema } from '../middleware/validation';
import { AuthenticationError, ValidationError, ConflictError } from '../middleware/errorHandler';

const router = Router();

// POST /auth/login — doctor logs in with email + password
router.post('/login', validateRequest(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = (req as any).validated;
    const normalizedEmail = email.toLowerCase().trim();

    const snap = await collections.practitioners().where('email', '==', normalizedEmail).get();
    if (snap.empty) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const doc = snap.docs[0];
    const data = doc.data() as any;

    if (!data.password_hash) {
      return res.status(401).json({ error: 'Account not set up for login. Please contact admin.' });
    }

    const valid = await bcrypt.compare(password, data.password_hash as string);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate access and refresh tokens
    const accessToken = generateAccessToken({
      id: doc.id,
      name: data.name,
      email: data.email,
      role: 'doctor',
    });

    const refreshToken = generateRefreshToken({
      id: doc.id,
      name: data.name,
      email: data.email,
      role: 'doctor',
    });

    return res.json({
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
      tokenType: 'Bearer',
      doctor: {
        id: doc.id,
        name: data.name,
        email: data.email,
        specialization: data.specialization || '',
        doctor_type: data.doctor_type || 'Ayurveda',
        license_number: data.license_number || '',
        verified: data.verified || false,
      },
    });
  } catch (err: any) {
    console.error('[POST /auth/login]', err.message);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /auth/register/doctor — new doctor self-registration
router.post('/register/doctor', async (req: Request, res: Response) => {
  try {
    const { name, email, password, specialization, license_number, experience_years, bio, qualifications, phone, doctor_type } = req.body;

    if (!name || !email || !password || !specialization) {
      return res.status(400).json({ error: 'Name, email, password, and specialization are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await collections.practitioners().where('email', '==', normalizedEmail).get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await collections.practitioners().doc(id).set({
      name: name.trim(),
      email: normalizedEmail,
      password_hash,
      specialization,
      doctor_type: doctor_type || 'Ayurveda',
      license_number: license_number || '',
      experience_years: experience_years ? Number(experience_years) : 0,
      bio: bio || '',
      qualifications: qualifications || '',
      phone: phone || '',
      is_active: 1,
      verified: false,
      is_self_registered: true,
      created_at: new Date().toISOString(),
    });

    const accessToken = generateAccessToken({
      id,
      name: name.trim(),
      email: normalizedEmail,
      role: 'doctor',
    });

    const refreshToken = generateRefreshToken({
      id,
      name: name.trim(),
      email: normalizedEmail,
      role: 'doctor',
    });

    return res.status(201).json({
      accessToken,
      refreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer',
      doctor: {
        id,
        name: name.trim(),
        email: normalizedEmail,
        specialization,
        doctor_type: doctor_type || 'Ayurveda',
        license_number: license_number || '',
        verified: false,
      },
    });
  } catch (err: any) {
    console.error('[POST /auth/register/doctor]', err.message);
    return res.status(500).json({ error: 'Failed to register doctor' });
  }
});

// POST /auth/register/patient — new patient self-registration
router.post('/register/patient', async (req: Request, res: Response) => {
  try {
    const { name, email, password, age, phone, gender } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await collections.patients().where('email', '==', normalizedEmail).get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await collections.patients().doc(id).set({
      name: name.trim(),
      email: normalizedEmail,
      password_hash,
      age: age ? Number(age) : null,
      phone: phone || '',
      gender: gender || '',
      dosha_profile: '',
      conditions: [],
      is_active: 1,
      is_self_registered: true,
      created_at: new Date().toISOString(),
    });

    const accessToken = generateAccessToken({
      id,
      name: name.trim(),
      email: normalizedEmail,
      role: 'patient',
    });

    const refreshToken = generateRefreshToken({
      id,
      name: name.trim(),
      email: normalizedEmail,
      role: 'patient',
    });

    return res.status(201).json({
      accessToken,
      refreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer',
      patient: {
        id,
        name: name.trim(),
        email: normalizedEmail,
        age: age ? Number(age) : null,
        phone: phone || '',
        gender: gender || '',
      },
    });
  } catch (err: any) {
    console.error('[POST /auth/register/patient]', err.message);
    return res.status(500).json({ error: 'Failed to register patient' });
  }
});

// POST /auth/login/patient — patient logs in
router.post('/login/patient', validateRequest(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = (req as any).validated;
    const normalizedEmail = email.toLowerCase().trim();

    const snap = await collections.patients().where('email', '==', normalizedEmail).get();
    if (snap.empty) {
      console.log(`[PATIENT LOGIN] No patient found for email: ${normalizedEmail}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const doc = snap.docs[0];
    const data = doc.data() as any;

    if (!data.password_hash) {
      console.log(`[PATIENT LOGIN] Patient ${normalizedEmail} has no password_hash`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, data.password_hash);
    if (!valid) {
      console.log(`[PATIENT LOGIN] Password mismatch for patient: ${normalizedEmail}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log(`[PATIENT LOGIN] Successful login for patient: ${normalizedEmail}`);

    // Generate access and refresh tokens
    const accessToken = generateAccessToken({
      id: doc.id,
      name: data.name,
      email: data.email,
      role: 'patient',
    });

    const refreshToken = generateRefreshToken({
      id: doc.id,
      name: data.name,
      email: data.email,
      role: 'patient',
    });

    return res.json({
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
      tokenType: 'Bearer',
      patient: {
        id: doc.id,
        name: data.name,
        email: data.email,
        age: data.age || null,
        phone: data.phone || '',
        gender: data.gender || '',
      },
    });
  } catch (err: any) {
    console.error('[POST /auth/login/patient]', err.message);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /auth/google — Google OAuth login/signup for both doctors and patients
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken, role } = req.body;
    if (!idToken || !role) {
      return res.status(400).json({ error: 'idToken and role are required' });
    }
    if (role !== 'doctor' && role !== 'patient') {
      return res.status(400).json({ error: 'Role must be "doctor" or "patient"' });
    }

    const decoded = await getAuth().verifyIdToken(idToken);
    const { email, name, picture, uid } = decoded;
    if (!email) {
      return res.status(400).json({ error: 'Google account must have an email address' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const displayName = name || email.split('@')[0];

    if (role === 'doctor') {
      const existing = await collections.practitioners().where('email', '==', normalizedEmail).get();

      if (!existing.empty) {
        const doc = existing.docs[0];
        const data = doc.data() as any;
        const accessToken = generateAccessToken({ id: doc.id, name: data.name, email: normalizedEmail, role: 'doctor' });
        const refreshToken = generateRefreshToken({ id: doc.id, name: data.name, email: normalizedEmail, role: 'doctor' });
        return res.json({
          accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer',
          doctor: { id: doc.id, name: data.name, email: normalizedEmail, specialization: data.specialization || '', doctor_type: data.doctor_type || 'Ayurveda', license_number: data.license_number || '', verified: data.verified || false },
        });
      }

      const id = uuidv4();
      await collections.practitioners().doc(id).set({
        name: displayName,
        email: normalizedEmail,
        specialization: 'General Ayurveda',
        doctor_type: 'Ayurveda',
        license_number: '',
        experience_years: 0,
        bio: '',
        qualifications: '',
        phone: '',
        is_active: 1,
        verified: false,
        is_self_registered: true,
        google_uid: uid,
        created_at: new Date().toISOString(),
      });

      const accessToken = generateAccessToken({ id, name: displayName, email: normalizedEmail, role: 'doctor' });
      const refreshToken = generateRefreshToken({ id, name: displayName, email: normalizedEmail, role: 'doctor' });
      return res.status(201).json({
        accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer',
        doctor: { id, name: displayName, email: normalizedEmail, specialization: 'General Ayurveda', doctor_type: 'Ayurveda', license_number: '', verified: false },
      });
    }

    // Patient role
    const existing = await collections.patients().where('email', '==', normalizedEmail).get();

    if (!existing.empty) {
      const doc = existing.docs[0];
      const data = doc.data() as any;
      const accessToken = generateAccessToken({ id: doc.id, name: data.name, email: normalizedEmail, role: 'patient' });
      const refreshToken = generateRefreshToken({ id: doc.id, name: data.name, email: normalizedEmail, role: 'patient' });
      return res.json({
        accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer',
        patient: { id: doc.id, name: data.name, email: normalizedEmail, age: data.age || null, phone: data.phone || '', gender: data.gender || '' },
      });
    }

    const id = uuidv4();
    await collections.patients().doc(id).set({
      name: displayName,
      email: normalizedEmail,
      age: null,
      phone: '',
      gender: '',
      dosha_profile: '',
      conditions: [],
      is_active: 1,
      is_self_registered: true,
      google_uid: uid,
      created_at: new Date().toISOString(),
    });

    const accessToken = generateAccessToken({ id, name: displayName, email: normalizedEmail, role: 'patient' });
    const refreshToken = generateRefreshToken({ id, name: displayName, email: normalizedEmail, role: 'patient' });
    return res.status(201).json({
      accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer',
      patient: { id, name: displayName, email: normalizedEmail, age: null, phone: '', gender: '' },
    });
  } catch (err: any) {
    console.error('[POST /auth/google] Token verification failed:', err.message);
    if (err.code) console.error('[POST /auth/google] Error code:', err.code);
    return res.status(401).json({ error: 'Invalid Google token', details: err.message });
  }
});

// GET /auth/me — validate current doctor token and return full profile
router.get('/me', verifyDoctorToken, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await collections.practitioners().doc(req.doctor!.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Practitioner not found' });
    const p = doc.data()!;
    return res.json({
      id: doc.id,
      name: p.name,
      email: p.email,
      specialization: p.specialization || '',
      doctor_type: p.doctor_type || 'Ayurveda',
      license_number: p.license_number || '',
      verified: p.verified || false,
      bio: p.bio || '',
      experience_years: p.experience_years || 0,
      qualifications: p.qualifications || '',
      phone: p.phone || '',
      address: p.address || '',
      city: p.city || '',
      state: p.state || '',
      zipcode: p.zipcode || '',
    });
  } catch (err: any) {
    console.error('[GET /auth/me]', err.message);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /auth/profile — doctor updates their own profile
router.put('/profile', verifyDoctorToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, bio, specialization, experience_years, qualifications, phone, license_number, doctor_type, address, city, state, zipcode } = req.body;

    const updateData: Record<string, any> = {};
    if (name !== undefined && name.trim()) updateData.name = name.trim();
    if (bio !== undefined) updateData.bio = bio;
    if (specialization !== undefined) updateData.specialization = specialization;
    if (experience_years !== undefined) updateData.experience_years = Number(experience_years) || 0;
    if (qualifications !== undefined) updateData.qualifications = qualifications;
    if (phone !== undefined) updateData.phone = phone;
    if (license_number !== undefined) updateData.license_number = license_number;
    if (doctor_type !== undefined) updateData.doctor_type = doctor_type;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (zipcode !== undefined) updateData.zipcode = zipcode;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const docRef = collections.practitioners().doc(req.doctor!.id);
    const existing = await docRef.get();
    if (!existing.exists) return res.status(404).json({ error: 'Practitioner not found' });

    await docRef.update(updateData);

    const doc = await collections.practitioners().doc(req.doctor!.id).get();
    const p = doc.data()!;
    return res.json({
      id: doc.id,
      name: p.name,
      email: p.email,
      specialization: p.specialization || '',
      doctor_type: p.doctor_type || 'Ayurveda',
      license_number: p.license_number || '',
      verified: p.verified || false,
      bio: p.bio || '',
      experience_years: p.experience_years || 0,
      qualifications: p.qualifications || '',
      phone: p.phone || '',
      address: p.address || '',
      city: p.city || '',
      state: p.state || '',
      zipcode: p.zipcode || '',
    });
  } catch (err: any) {
    console.error('[PUT /auth/profile]', err.message);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// DELETE /auth/profile — doctor deletes their own profile
router.delete('/profile', verifyDoctorToken, async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = req.doctor!.id;

    const docRef = collections.practitioners().doc(doctorId);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: 'Practitioner not found' });
    }

    const fbBatch = batch();
    
    // 1. Delete practitioner document
    fbBatch.delete(docRef);

    // 2. Delete availability
    const availabilitySnap = await collections.practitionerAvailability()
      .where('practitioner_id', '==', doctorId).get();
    availabilitySnap.docs.forEach(doc => fbBatch.delete(doc.ref));

    // 3. Delete appointments
    const appointmentsSnap = await collections.appointments()
      .where('doctor_id', '==', doctorId).get();
    appointmentsSnap.docs.forEach(doc => fbBatch.delete(doc.ref));

    // 4. Delete sessions
    const sessionsSnap = await collections.therapySessions()
      .where('practitioner_id', '==', doctorId).get();
    sessionsSnap.docs.forEach(doc => fbBatch.delete(doc.ref));

    await fbBatch.commit();

    return res.json({ message: 'Profile deleted successfully' });
  } catch (err: any) {
    console.error('[DELETE /auth/profile]', err.message);
    return res.status(500).json({ error: 'Failed to delete profile' });
  }
});

/**
 * POST /auth/refresh — Exchange refresh token for new access token
 * Client should call this before access token expires
 * Implement token rotation: issueoptional new refresh token too
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    try {
      const payload = verifyRefreshToken(refreshToken);

      // Issue new access token
      const newAccessToken = generateAccessToken({
        id: payload.id,
        name: payload.name,
        email: payload.email,
        role: payload.role,
      });

      // Optional: rotate refresh token (issue new one too)
      const newRefreshToken = generateRefreshToken({
        id: payload.id,
        name: payload.name,
        email: payload.email,
        role: payload.role,
      });

      return res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600, // 1 hour
        tokenType: 'Bearer',
      });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  } catch (err: any) {
    console.error('[POST /auth/refresh]', err.message);
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
});

/**
 * POST /auth/logout — Invalidate tokens (optional cookie clearing)
 * Client should clear tokens from storage
 */
router.post('/logout', async (req: Request, res: Response) => {
  // Token invalidation could be done via a blacklist in Redis
  // For now, we rely on client-side token deletion
  res.json({
    message: 'Logged out successfully. Please clear tokens from client storage.',
  });
});

export default router;
