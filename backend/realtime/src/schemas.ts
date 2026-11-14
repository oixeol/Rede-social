import { z } from 'zod';

export const roomJoinSchema = z.object({
  roomId: z.string().uuid(),
  nonce: z.string().min(16).max(64).optional(),
});

export const messageCreateSchema = z.object({
  roomId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  replyToId: z.string().uuid().optional(),
  nonce: z.string().min(16).max(64),
  mediaIds: z.array(z.string().uuid()).max(5).optional(),
});

export const typingStartSchema = z.object({
  roomId: z.string().uuid(),
});

export const readAckSchema = z.object({
  roomId: z.string().uuid(),
  lastReadMessageId: z.string().uuid(),
});

export const presenceUpdateSchema = z.object({
  status: z.enum(['online', 'away', 'busy', 'offline']),
  customStatus: z.string().max(100).optional(),
});

export type RoomJoinPayload = z.infer<typeof roomJoinSchema>;
export type MessageCreatePayload = z.infer<typeof messageCreateSchema>;
export type TypingStartPayload = z.infer<typeof typingStartSchema>;
export type ReadAckPayload = z.infer<typeof readAckSchema>;
export type PresenceUpdatePayload = z.infer<typeof presenceUpdateSchema>;