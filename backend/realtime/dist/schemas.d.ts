import { z } from 'zod';
export declare const roomJoinSchema: z.ZodObject<{
    roomId: z.ZodString;
    nonce: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    nonce?: string | undefined;
}, {
    roomId: string;
    nonce?: string | undefined;
}>;
export declare const messageCreateSchema: z.ZodObject<{
    roomId: z.ZodString;
    content: z.ZodString;
    replyToId: z.ZodOptional<z.ZodString>;
    nonce: z.ZodString;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    nonce: string;
    content: string;
    replyToId?: string | undefined;
    mediaIds?: string[] | undefined;
}, {
    roomId: string;
    nonce: string;
    content: string;
    replyToId?: string | undefined;
    mediaIds?: string[] | undefined;
}>;
export declare const typingStartSchema: z.ZodObject<{
    roomId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roomId: string;
}, {
    roomId: string;
}>;
export declare const readAckSchema: z.ZodObject<{
    roomId: z.ZodString;
    lastReadMessageId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    lastReadMessageId: string;
}, {
    roomId: string;
    lastReadMessageId: string;
}>;
export declare const presenceUpdateSchema: z.ZodObject<{
    status: z.ZodEnum<["online", "away", "busy", "offline"]>;
    customStatus: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "online" | "offline" | "away" | "busy";
    customStatus?: string | undefined;
}, {
    status: "online" | "offline" | "away" | "busy";
    customStatus?: string | undefined;
}>;
export type RoomJoinPayload = z.infer<typeof roomJoinSchema>;
export type MessageCreatePayload = z.infer<typeof messageCreateSchema>;
export type TypingStartPayload = z.infer<typeof typingStartSchema>;
export type ReadAckPayload = z.infer<typeof readAckSchema>;
export type PresenceUpdatePayload = z.infer<typeof presenceUpdateSchema>;
//# sourceMappingURL=schemas.d.ts.map