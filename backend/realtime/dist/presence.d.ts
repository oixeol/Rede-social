import type { Server, Socket } from 'socket.io';
export declare function onPresenceConnect(io: Server, socket: Socket, friendIds: string[]): Promise<void>;
export declare function startPresenceHeartbeat(io: Server): void;
//# sourceMappingURL=presence.d.ts.map