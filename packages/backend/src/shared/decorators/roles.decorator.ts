import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '@a-idol/shared';

export const ROLES_KEY = 'admin:roles';

/**
 * Restrict a route handler to the given admin roles. Must be combined with
 * `AdminJwtAuthGuard` *and* `RolesGuard` in `@UseGuards(AdminJwtAuthGuard, RolesGuard)`.
 */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
