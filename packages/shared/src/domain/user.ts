import { DomainError, ErrorCodes } from './errors';

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
  /** PIPA/PDPA 마케팅 수신 동의. 기본 false (opt-in). */
  readonly marketingOptIn: boolean;
  /** 푸시 알림 수신 동의. 기본 true (가입 시 활성). */
  readonly pushOptIn: boolean;
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
  get marketingOptIn() { return this.props.marketingOptIn; }
  get pushOptIn() { return this.props.pushOptIn; }

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
      throw new DomainError(ErrorCodes.UNDER_AGE, 'User must be at least 14 years old');
    }
  }

  toJSON() {
    return { ...this.props };
  }
}
