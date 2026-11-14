import { RedisClientType } from 'redis';
export declare function getRedis(): RedisClientType;
export declare function closeRedis(): Promise<void>;
export declare const PUBSUB_CHANNELS: {
    readonly MESSAGE_NEW: "realtime:message:new";
    readonly MESSAGE_READ: "realtime:message:read";
    readonly TYPING_START: "realtime:typing:start";
    readonly TYPING_STOP: "realtime:typing:stop";
    readonly PRESENCE_UPDATE: "realtime:presence:update";
    readonly NOTIFICATION_NEW: "realtime:notification:new";
    readonly ROOM_EVENT: "realtime:room:event";
};
export declare const REDIS_KEYS: {
    readonly session: (sid: string) => string;
    readonly userSessions: (userId: string) => string;
    readonly userSockets: (userId: string) => string;
    readonly socketMeta: (socketId: string) => string;
    readonly roomMembers: (roomId: string) => string;
    readonly typing: (roomId: string, userId: string) => string;
    readonly presenceWatchers: (userId: string) => string;
    readonly rateLimit: (userId: string, event: string) => string;
    readonly revokedTokens: "auth:revoked_tokens";
};
//# sourceMappingURL=redis.d.ts.map