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

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: UserProps): User {
    return new User(props);
  }

  get id() { return this.props.id; }
  get email() { return this.props.email; }
  get nickname() { return this.props.nickname; }
  get avatarUrl() { return this.props.avatarUrl; }
  get birthdate() { return this.props.birthdate; }
  get status() { return this.props.status; }
  get provider() { return this.props.provider; }

  isActive(): boolean {
    return this.props.status === 'active';
  }

  /**
   * POL-006 — block users under 14 years old.
   */
  static assertMinimumAge(birthdate: Date, at: Date = new Date()): void {
    const minAgeYears = 14;
    const ageMs = at.getTime() - birthdate.getTime();
    const yearsOld = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    if (yearsOld < minAgeYears) {
      // Import lazily to avoid cycles
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { DomainError, ErrorCodes } = require('./errors') as typeof import('./errors');
      throw new DomainError(ErrorCodes.UNDER_AGE, 'User must be at least 14 years old');
    }
  }

  toJSON() {
    return { ...this.props };
  }
}
