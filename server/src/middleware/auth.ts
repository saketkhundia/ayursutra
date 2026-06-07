import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config';

export interface AuthRequest extends Request {
  doctor?: { id: string; name: string; email: string; verified: boolean; role?: string };
  patient?: { id: string; name: string; email: string; role: string };
  user?: { id: string; role: 'doctor' | 'patient' };
}

interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: 'doctor' | 'patient';
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: Omit<TokenPayload, 'type' | 'iat' | 'exp'>): string {
  const config = getConfig();
  return jwt.sign(
    { ...payload, type: 'access' },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRY }
  );
}

/**
 * Generate JWT refresh token
 * Should be stored securely on client (httpOnly cookie or secure storage)
 */
export function generateRefreshToken(payload: Omit<TokenPayload, 'type' | 'iat' | 'exp'>): string {
  const config = getConfig();
  return jwt.sign(
    { ...payload, type: 'refresh' },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRY }
  );
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  const config = getConfig();
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return payload;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload {
  const config = getConfig();
  try {
    const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as TokenPayload;
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return payload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Doctor authentication middleware
 * Verifies access token and ensures user is a doctor
 */
export function verifyDoctorToken(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Doctor login required' });
  }

  try {
    const token = auth.slice(7);
    const payload = verifyAccessToken(token);

    // Reject patient tokens from doctor-only endpoints
    if (payload.role !== 'doctor') {
      return res.status(403).json({ error: 'Doctor access required' });
    }

    req.doctor = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      verified: true,
    };
    req.user = { id: payload.id, role: 'doctor' };
    next();
  } catch (error) {
    return res.status(401).json({
      error: error instanceof Error ? error.message : 'Invalid or expired token',
    });
  }
}

/**
 * Patient authentication middleware
 * Verifies access token and ensures user is a patient
 */
export function verifyPatientToken(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Patient login required' });
  }

  try {
    const token = auth.slice(7);
    const payload = verifyAccessToken(token);

    if (payload.role !== 'patient') {
      return res.status(403).json({ error: 'Patient access required' });
    }

    req.patient = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: 'patient',
    };
    req.user = { id: payload.id, role: 'patient' };
    next();
  } catch (error) {
    return res.status(401).json({
      error: error instanceof Error ? error.message : 'Invalid or expired token',
    });
  }
}

/**
 * Optional authentication middleware
 * Doesn't throw error if no token, just skips
 */
export function verifyOptionalToken(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = auth.slice(7);
    const payload = verifyAccessToken(token);

    if (payload.role === 'doctor') {
      req.doctor = {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        verified: true,
      };
    } else {
      req.patient = {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        role: 'patient',
      };
    }

    req.user = { id: payload.id, role: payload.role };
  } catch (error) {
    // Silently ignore invalid tokens for optional auth
  }

  next();
}
