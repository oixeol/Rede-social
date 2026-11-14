interface RateLimitConfig {
    max: number;
    windowMs: number;
}
export declare function checkRateLimit(userId: string, event: string, customLimit?: RateLimitConfig): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
}>;
export declare function createRateLimitMiddleware(): (socket: any, next: (err?: Error) => void) => Promise<void>;
export {};
//# sourceMappingURL=rate-limit.d.ts.map