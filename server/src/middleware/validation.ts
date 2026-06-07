import { z } from 'zod';

/**
 * Authentication Schemas
 */
export const registerDoctorSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[!@#$%^&*]/, 'Password must contain special character'),
  specialization: z.string().min(2, 'Specialization required'),
  licenseNumber: z.string().min(5, 'License number required'),
  yearsOfExperience: z.number().min(0, 'Years must be non-negative').max(70),
});

export const registerPatientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[!@#$%^&*]/, 'Password must contain special character'),
  age: z.number().min(0, 'Age must be positive').max(150),
  gender: z.enum(['male', 'female', 'other']),
  phoneNumber: z.string().regex(/^[0-9]{10}$/, 'Invalid phone number'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password required'),
});

/**
 * Patient Schema
 */
export const patientSchema = z.object({
  name: z.string().min(2, 'Name required').max(100),
  age: z.number().min(0, 'Age must be positive').max(150),
  gender: z.enum(['male', 'female', 'other']),
  dosha: z.enum(['vata', 'pitta', 'kapha']).optional(),
  medicalHistory: z.string().max(1000).optional(),
  allergies: z.string().max(500).optional(),
  phoneNumber: z.string().regex(/^[0-9]{10}$/, 'Invalid phone number').optional(),
});

/**
 * Therapy Session Schema
 */
export const sessionSchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  therapyId: z.string().min(1, 'Therapy ID required'),
  doctorId: z.string().min(1, 'Doctor ID required'),
  scheduledAt: z.string().datetime('Invalid date format'),
  duration: z.number().min(15, 'Duration must be at least 15 minutes').max(480),
  notes: z.string().max(1000).optional(),
});

/**
 * Feedback Schema
 */
export const feedbackSchema = z.object({
  sessionId: z.string().min(1, 'Session ID required'),
  rating: z.number().min(1, 'Rating must be 1-5').max(5),
  digestionRating: z.number().min(1, 'Digestion rating must be 1-5').max(5).optional(),
  energyLevel: z.number().min(1, 'Energy level must be 1-10').max(10).optional(),
  notes: z.string().max(500).optional(),
  symptoms: z.array(z.string()).optional(),
});

/**
 * Treatment Plan Schema
 */
export const treatmentPlanSchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  doctorId: z.string().min(1, 'Doctor ID required'),
  therapies: z.array(
    z.object({
      therapyId: z.string(),
      sequenceOrder: z.number(),
      duration: z.number(),
    })
  ).min(1, 'At least one therapy required'),
  startDate: z.string().datetime('Invalid date format'),
  endDate: z.string().datetime('Invalid date format'),
  notes: z.string().max(1000).optional(),
});

/**
 * Doctor Location Schema
 */
export const doctorLocationSchema = z.object({
  address: z.string().min(5, 'Address required').max(200),
  city: z.string().min(2, 'City required').max(50),
  state: z.string().min(2, 'State required').max(50),
  zipcode: z.string().regex(/^[0-9]{5,6}$/, 'Invalid zipcode'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

/**
 * Doctor Profile Update Schema (includes location)
 */
export const doctorProfileUpdateSchema = z.object({
  full_name: z.string().min(2, 'Name required').max(100).optional(),
  specialization: z.string().min(2, 'Specialization required').optional(),
  doctor_type: z.string().min(2).optional(),
  license_number: z.string().min(5).optional(),
  experience_years: z.number().min(0).max(70).optional(),
  phone: z.string().optional(),
  qualifications: z.string().optional(),
  bio: z.string().max(1000).optional(),
  // Location fields
  address: z.string().min(5).max(200).optional(),
  city: z.string().min(2).max(50).optional(),
  state: z.string().min(2).max(50).optional(),
  zipcode: z.string().regex(/^[0-9]{5,6}$/).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

/**
 * Create validation middleware
 */
export function validateRequest<T extends z.ZodSchema>(schema: T) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.body);
      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({
          error: 'Validation error',
          details: messages,
        });
      }
      res.status(400).json({ error: 'Invalid request' });
    }
  };
}

export default {
  registerDoctorSchema,
  registerPatientSchema,
  loginSchema,
  patientSchema,
  sessionSchema,
  feedbackSchema,
  treatmentPlanSchema,
  validateRequest,
};
