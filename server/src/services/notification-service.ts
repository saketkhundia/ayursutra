/**
 * ATASS Multi-Channel Notification Service
 * Supports: In-App, Email (SMTP/Nodemailer), SMS (Twilio), Push (FCM)
 * Configurable per-patient with preference-based routing.
 */
import { collections, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';

// Channel configuration (from environment - safe defaults for dev)
const config = {
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    enabled: !!process.env.TWILIO_ACCOUNT_SID,
  },
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'noreply@atass.com',
    enabled: !!process.env.SMTP_HOST,
  },
  fcm: {
    projectId: process.env.FCM_PROJECT_ID || '',
    serverKey: process.env.FCM_SERVER_KEY || '',
    enabled: !!process.env.FCM_SERVER_KEY,
  },
};

export interface NotificationPayload {
  patient_id: string;
  session_id?: string;
  type: string;
  title: string;
  message: string;
  scheduled_for?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

interface DeliveryResult {
  channel: string;
  success: boolean;
  message_id?: string;
  error?: string;
}

// Get patient's notification preferences
async function getPatientPrefs(patient_id: string) {
  const snap = await collections.notificationPreferences()
    .where('patient_id', '==', patient_id).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
}

// Get patient contact info
async function getPatientContact(patient_id: string) {
  const doc = await collections.patients().doc(patient_id).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return { name: d.name, phone: d.phone, email: d.email };
}

// In-App delivery (always works - stores in Firestore)
async function deliverInApp(payload: NotificationPayload): Promise<DeliveryResult> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await collections.notifications().doc(id).set({
    patient_id: payload.patient_id,
    session_id: payload.session_id || null,
    type: payload.type,
    channel: 'in-app',
    title: payload.title,
    message: payload.message,
    scheduled_for: payload.scheduled_for || null,
    is_read: 0,
    sent_at: null,
    created_at: now,
  });
  return { channel: 'in-app', success: true, message_id: id };
}

// SMS delivery via Twilio
async function deliverSMS(payload: NotificationPayload, phone: string): Promise<DeliveryResult> {
  const id = uuidv4();
  const now = new Date().toISOString();

  if (!config.twilio.enabled) {
    await collections.notifications().doc(id).set({
      patient_id: payload.patient_id,
      session_id: payload.session_id || null,
      type: payload.type,
      channel: 'sms',
      title: payload.title,
      message: `[SMS → ${phone}] ${payload.message}`,
      scheduled_for: payload.scheduled_for || null,
      is_read: 0,
      sent_at: now,
      created_at: now,
    });
    console.log(`[SMS Simulated] To: ${phone} | ${payload.title}: ${payload.message.substring(0, 80)}...`);
    return { channel: 'sms', success: true, message_id: id };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: phone,
      From: config.twilio.fromNumber,
      Body: `${payload.title}\n${payload.message}`,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const result: any = await response.json();

    await collections.notifications().doc(id).set({
      patient_id: payload.patient_id,
      session_id: payload.session_id || null,
      type: payload.type,
      channel: 'sms',
      title: payload.title,
      message: payload.message,
      scheduled_for: payload.scheduled_for || null,
      is_read: 0,
      sent_at: now,
      created_at: now,
    });

    return { channel: 'sms', success: response.ok, message_id: result.sid || id };
  } catch (err: any) {
    return { channel: 'sms', success: false, error: err.message };
  }
}

// Email delivery via SMTP (using fetch to a mail API or nodemailer-style)
async function deliverEmail(payload: NotificationPayload, email: string, patientName: string): Promise<DeliveryResult> {
  const id = uuidv4();
  const now = new Date().toISOString();

  if (!config.email.enabled) {
    await collections.notifications().doc(id).set({
      patient_id: payload.patient_id,
      session_id: payload.session_id || null,
      type: payload.type,
      channel: 'email',
      title: payload.title,
      message: `[Email → ${email}] ${payload.message}`,
      scheduled_for: payload.scheduled_for || null,
      is_read: 0,
      sent_at: now,
      created_at: now,
    });
    console.log(`[Email Simulated] To: ${email} | Subject: ${payload.title}`);
    return { channel: 'email', success: true, message_id: id };
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: { user: config.email.user, pass: config.email.password },
    });

    const htmlBody = `
      <div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#ff8010;color:white;padding:16px 24px;border-radius:12px 12px 0 0">
          <h2 style="margin:0">🍃 ATASS</h2>
        </div>
        <div style="border:1px solid #e5e5e5;border-top:0;padding:24px;border-radius:0 0 12px 12px">
          <p>Dear ${patientName},</p>
          <h3>${payload.title}</h3>
          <p>${payload.message}</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0"/>
          <p style="color:#888;font-size:12px">This notification was sent by AI-Based Therapy & Appointment Scheduling System</p>
        </div>
      </div>`;

    await transporter.sendMail({
      from: `"ATASS" <${config.email.from}>`,
      to: email,
      subject: payload.title,
      html: htmlBody,
    });

    await collections.notifications().doc(id).set({
      patient_id: payload.patient_id,
      session_id: payload.session_id || null,
      type: payload.type,
      channel: 'email',
      title: payload.title,
      message: payload.message,
      scheduled_for: payload.scheduled_for || null,
      is_read: 0,
      sent_at: now,
      created_at: now,
    });

    return { channel: 'email', success: true, message_id: id };
  } catch (err: any) {
    return { channel: 'email', success: false, error: err.message };
  }
}

// Push notification via FCM
async function deliverPush(payload: NotificationPayload): Promise<DeliveryResult> {
  if (!config.fcm.enabled) {
    console.log(`[FCM Simulated] ${payload.title}: ${payload.message.substring(0, 80)}...`);
    return { channel: 'push', success: true };
  }

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${config.fcm.serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: `/topics/patient_${payload.patient_id}`,
        notification: { title: payload.title, body: payload.message },
        data: { type: payload.type, session_id: payload.session_id || '' },
      }),
    });

    return { channel: 'push', success: response.ok };
  } catch (err: any) {
    return { channel: 'push', success: false, error: err.message };
  }
}


/**
 * Main dispatch function - routes notification to all enabled channels per patient preferences.
 */
export async function sendNotification(payload: NotificationPayload): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  const prefs = await getPatientPrefs(payload.patient_id);
  const contact = await getPatientContact(payload.patient_id);

  // In-app is always delivered
  if (!prefs || prefs.in_app) {
    results.push(await deliverInApp(payload));
  }

  // SMS if enabled and phone available
  if (prefs?.sms && contact?.phone) {
    results.push(await deliverSMS(payload, contact.phone));
  }

  // Email if enabled and email available
  if (prefs?.email && contact?.email) {
    results.push(await deliverEmail(payload, contact.email, contact.name));
  }

  // Push notification (FCM)
  if (config.fcm.enabled) {
    results.push(await deliverPush(payload));
  }

  return results;
}

/**
 * Get notification channel status (for frontend display)
 */
export function getChannelStatus() {
  return {
    in_app: { enabled: true, configured: true },
    sms: { enabled: config.twilio.enabled, configured: !!config.twilio.accountSid },
    email: { enabled: config.email.enabled, configured: !!config.email.host },
    push: { enabled: config.fcm.enabled, configured: !!config.fcm.serverKey },
    dev_mode: !config.twilio.enabled && !config.email.enabled,
  };
}
