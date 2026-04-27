export interface AuthSessionProps {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly deviceId: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

export class AuthSession {
  constructor(private readonly props: AuthSessionProps) {}
  get id() { return this.props.id; }
  get userId() { return this.props.userId; }
  get expiresAt() { return this.props.expiresAt; }
  get revokedAt() { return this.props.revokedAt; }
  get refreshTokenHash() { return this.props.refreshTokenHash; }
  isActive(now: Date = new Date()): boolean {
    return this.revokedAt === null && this.expiresAt > now;
  }
  toJSON() { return { ...this.props }; }
}
