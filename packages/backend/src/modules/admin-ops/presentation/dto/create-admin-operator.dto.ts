import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, Length, MaxLength, MinLength } from 'class-validator';
import type { AdminRole } from '@a-idol/shared';
import { IsStrongPassword } from '../../../../shared/validators/strong-password.validator';

/**
 * FR-102-A — 신규 어드민 등록 요청.
 * ADR-023 — Request DTO 는 snake_case.
 */
export class CreateAdminOperatorDto {
  @ApiProperty({ example: 'ops2@a-idol.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Yuna Park', minLength: 1, maxLength: 40, name: 'display_name' })
  @IsString()
  @Length(1, 40)
  display_name!: string;

  @ApiProperty({ example: 'correct horse battery staple', minLength: 8, maxLength: 64 })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ enum: ['admin', 'operator', 'viewer'], example: 'operator' })
  @IsIn(['admin', 'operator', 'viewer'])
  role!: AdminRole;
}
