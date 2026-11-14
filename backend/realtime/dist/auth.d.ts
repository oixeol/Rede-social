import type { Socket } from 'socket.io';
export interface AuthenticatedUser {
    id: string;
    email: string;
    username: string;
    sessionId: string;
}
export interface AuthenticatedSocket extends Socket {
    data: {
        user: AuthenticatedUser;
    };
}
export declare function authMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void>;
export declare function assertRoomMember(socket: AuthenticatedSocket, roomId: string): Promise<boolean>;
export declare function revokeSession(userId: string, sessionId: string): Promise<void>;
export declare function revokeAllUserSessions(userId: string): Promise<void>;
//# sourceMappingURL=auth.d.ts.map