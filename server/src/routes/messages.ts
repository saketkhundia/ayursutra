/**
 * Messages Routes
 * Handles doctor-patient communication
 * Supports: Sending messages, fetching conversations, marking as read
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  verifyDoctorToken,
  verifyPatientToken,
  verifyAccessToken,
  AuthRequest,
} from '../middleware/auth';
import { collections, queryToArray } from '../models/database';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import { emitMessageSent, emitMessageRead } from '../services/realtime';

const router = Router();

// Message validation schema
const messageSchema = z.object({
  receiver_id: z.string().min(1, 'Receiver ID required'),
  content: z.string().min(1, 'Message content required').max(5000, 'Message too long'),
});

/**
 * POST /messages/send
 * Send a message from doctor or patient
 * Authentication: Both doctor and patient
 */
router.post(
  '/send',
  async (req: Request, res: Response) => {
    try {
      // Try to verify as either doctor or patient
      let senderId: string | undefined;
      let senderType: 'doctor' | 'patient' | undefined;
      let senderData: any;

      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Try to verify token and determine user type
      try {
        const { verifyAccessToken } = require('../middleware/auth');
        const payload = verifyAccessToken(token);
        
        if (payload.role === 'doctor') {
          senderId = payload.id;
          senderType = 'doctor';
          senderData = { id: payload.id, name: payload.name };
        } else if (payload.role === 'patient') {
          senderId = payload.id;
          senderType = 'patient';
          senderData = { id: payload.id, name: payload.name };
        }
      } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      if (!senderId || !senderType) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { receiver_id, content } = messageSchema.parse(req.body);

      // Validate receiver exists
      let receiverType: 'doctor' | 'patient' | undefined;
      const doctorDoc = await collections.practitioners().doc(receiver_id).get();
      const patientDoc = await collections.patients().doc(receiver_id).get();

      if (doctorDoc.exists) {
        receiverType = 'doctor';
      } else if (patientDoc.exists) {
        receiverType = 'patient';
      } else {
        return res.status(404).json({ error: 'Receiver not found' });
      }

      // Create conversation ID (consistent ordering)
      const conversationId =
        [senderId, receiver_id].sort().join('_');

      // Save message
      const messageId = uuidv4();
      const messageData = {
        id: messageId,
        conversation_id: conversationId,
        sender_id: senderId,
        sender_type: senderType,
        sender_name: senderData.name || '',
        receiver_id,
        receiver_type: receiverType,
        content,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await collections.messages().doc(messageId).set(messageData);

      // Also create/update conversation summary
      const conversationDoc = {
        id: conversationId,
        user1_id: [senderId, receiver_id].sort()[0],
        user2_id: [senderId, receiver_id].sort()[1],
        last_message: content,
        last_message_sender: senderId,
        last_message_at: new Date().toISOString(),
        unread_count_for_receiver: 1,
        updated_at: new Date().toISOString(),
      };

      await collections.conversations().doc(conversationId).set(conversationDoc, { merge: true });

      // Emit real-time event
      emitMessageSent(receiver_id, messageData);

      return res.status(201).json(messageData);
    } catch (err: any) {
      console.error('[POST /messages/send]', err.message);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors,
        });
      }
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

/**
 * GET /messages/conversation/:otherUserId
 * Get all messages in a conversation (paginated)
 * Authentication: Both doctor and patient
 */
router.get(
  '/conversation/:otherUserId',
  async (req: Request, res: Response) => {
    try {
      const { otherUserId } = req.params;
      const { limit = '50', offset = '0' } = req.query;

      // Verify user
      let userId: string | undefined;
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Try to verify token and get user ID
      try {

        const payload = verifyAccessToken(token);
        userId = payload.id;
      } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Build conversation ID
      const conversationId = [userId, otherUserId].sort().join('_');

      // Get messages (sorted by creation, newest first, then paginate)
      const messagesSnap = await collections
        .messages()
        .where('conversation_id', '==', conversationId)
        .get();

      let messages = queryToArray(messagesSnap);

      // Sort by created_at descending (newest first)
      messages.sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Paginate
      const limitNum = Math.min(parseInt(limit as string) || 50, 100);
      const offsetNum = Math.max(parseInt(offset as string) || 0, 0);
      const paginatedMessages = messages.slice(
        offsetNum,
        offsetNum + limitNum
      );

      // Mark as read if receiver
      for (const msg of paginatedMessages) {
        if (msg.receiver_id === userId && !msg.is_read) {
          await collections
            .messages()
            .doc(msg.id)
            .update({ is_read: true, updated_at: new Date().toISOString() });
          emitMessageRead(msg.sender_id, msg.id);
        }
      }

      // Return in chronological order (oldest first) for UI
      paginatedMessages.reverse();

      return res.json({
        messages: paginatedMessages,
        total: messages.length,
        limit: limitNum,
        offset: offsetNum,
      });
    } catch (err: any) {
      console.error('[GET /messages/conversation]', err.message);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
);

/**
 * GET /messages/conversations
 * Get list of all conversations for logged-in user
 * Authentication: Both doctor and patient
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let userId: string | undefined;

    // Verify token (works for both doctor and patient)
    try {
      const payload = verifyAccessToken(token);
      userId = payload.id;
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get conversations where user is involved
    const conversationsSnap = await collections
      .conversations()
      .where('user1_id', '==', userId)
      .get();

    let conversations = queryToArray(conversationsSnap);

    // Also check user2_id
    const conversationsSnap2 = await collections
      .conversations()
      .where('user2_id', '==', userId)
      .get();

    conversations = [
      ...conversations,
      ...queryToArray(conversationsSnap2),
    ];

    // Remove duplicates and enrich with user data
    const uniqueConversations = Array.from(
      new Map(
        conversations.map(c => [
          c.id,
          c,
        ])
      ).values()
    );

    // Get other user details for each conversation
    for (const conv of uniqueConversations) {
      const otherUserId =
        conv.user1_id === userId ? conv.user2_id : conv.user1_id;

      // Try to fetch as doctor or patient
      const doctorDoc = await collections
        .practitioners()
        .doc(otherUserId)
        .get();
      if (doctorDoc.exists) {
        conv.other_user = {
          id: otherUserId,
          name: doctorDoc.data()?.name || 'Unknown',
          type: 'doctor',
          specialization: doctorDoc.data()?.specialization || '',
        };
      } else {
        const patientDoc = await collections
          .patients()
          .doc(otherUserId)
          .get();
        if (patientDoc.exists) {
          conv.other_user = {
            id: otherUserId,
            name: patientDoc.data()?.name || 'Unknown',
            type: 'patient',
          };
        }
      }
    }

    // Sort by last_message_at (newest first)
    uniqueConversations.sort(
      (a: any, b: any) =>
        new Date(b.last_message_at).getTime() -
        new Date(a.last_message_at).getTime()
    );

    return res.json(uniqueConversations);
  } catch (err: any) {
    console.error('[GET /messages/conversations]', err.message);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /messages/unread-count
 * Get total unread message count
 */
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let userId: string | undefined;

    // Try to verify token
    try {
      const payload = verifyAccessToken(token);
      userId = payload.id;
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Count unread messages
    const unreadSnap = await collections
      .messages()
      .where('receiver_id', '==', userId)
      .where('is_read', '==', false)
      .get();

    return res.json({ unread_count: unreadSnap.size });
  } catch (err: any) {
    console.error('[GET /messages/unread-count]', err.message);
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

export default router;
