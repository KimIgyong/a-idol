import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { AdminRole } from '@a-idol/shared';

/**
 * FR-102-B — 어드민 역할 변경 요청.
 * ADR-023 — Request DTO 는 snake_case (단일 필드라 case 영향 없음).
 */
export class UpdateAdminRoleDto {
  @ApiProperty({ enum: ['admin', 'operator', 'viewer'], example: 'operator' })
  @IsIn(['admin', 'operator', 'viewer'])
  role!: AdminRole;
}
