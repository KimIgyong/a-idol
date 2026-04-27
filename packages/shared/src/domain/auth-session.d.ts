export interface AuthSessionProps {
    readonly id: string;
    readonly userId: string;
    readonly refreshTokenHash: string;
    readonly deviceId: string | null;
    readonly createdAt: Date;
    readonly expiresAt: Date;
    readonly revokedAt: Date | null;
}
export declare class AuthSession {
    private readonly props;
    constructor(props: AuthSessionProps);
    get id(): string;
    get userId(): string;
    get expiresAt(): Date;
    get revokedAt(): any;
    get refreshTokenHash(): string;
    isActive(now?: Date): boolean;
    toJSON(): {
        id: string;
        userId: string;
        refreshTokenHash: string;
        deviceId: string | null;
        createdAt: Date;
        expiresAt: Date;
        revokedAt: Date | null;
    };
}
//# sourceMappingURL=auth-session.d.ts.map