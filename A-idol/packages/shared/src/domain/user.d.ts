export type AuthProvider = 'email' | 'apple' | 'google' | 'kakao';
export type UserStatus = 'active' | 'suspended' | 'withdrawn';
export interface UserProps {
    readonly id: string;
    readonly provider: AuthProvider;
    readonly providerUserId: string;
    readonly email: string | null;
    readonly nickname: string;
    readonly avatarUrl: string | null;
    readonly birthdate: Date;
    readonly status: UserStatus;
    readonly createdAt: Date;
}
export declare class User {
    private readonly props;
    private constructor();
    static create(props: UserProps): User;
    get id(): string;
    get email(): string | null;
    get nickname(): string;
    get avatarUrl(): string | null;
    get birthdate(): Date;
    get status(): UserStatus;
    get provider(): AuthProvider;
    isActive(): boolean;
    /**
     * POL-006 — block users under 14 years old.
     */
    static assertMinimumAge(birthdate: Date, at?: Date): void;
    toJSON(): {
        id: string;
        provider: AuthProvider;
        providerUserId: string;
        email: string | null;
        nickname: string;
        avatarUrl: string | null;
        birthdate: Date;
        status: UserStatus;
        createdAt: Date;
    };
}
//# sourceMappingURL=user.d.ts.map