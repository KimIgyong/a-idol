import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { AdminRole, AdminStatus } from '@a-idol/shared';

export interface AdminUserProps {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string;
  readonly role: AdminRole;
  readonly status: AdminStatus;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
}

export class AdminUser {
  private constructor(private readonly props: AdminUserProps) {}

  static create(props: AdminUserProps): AdminUser {
    return new AdminUser(props);
  }

  get id() { return this.props.id; }
  get email() { return this.props.email; }
  get passwordHash() { return this.props.passwordHash; }
  get displayName() { return this.props.displayName; }
  get role() { return this.props.role; }
  get status() { return this.props.status; }
  get lastLoginAt() { return this.props.lastLoginAt; }
  get createdAt() { return this.props.createdAt; }

  assertCanLogin(): void {
    if (this.props.status !== 'active') {
      throw new DomainError(ErrorCodes.INVALID_CREDENTIAL, 'Admin account is not active');
    }
  }

  toJSON() {
    return { ...this.props };
  }
}
