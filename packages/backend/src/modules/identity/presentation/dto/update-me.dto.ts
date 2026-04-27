import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * `PATCH /api/v1/me` 본문. 모든 필드 optional — 클라이언트가 보낸 필드만 갱신.
 *
 * - `avatar_url` 은 `null` 이면 명시적 제거. 미전송이면 변경 없음.
 * - `marketing_opt_in` / `push_opt_in` 은 boolean. 미전송이면 변경 없음.
 *
 * 닉네임/생년월일/이메일은 본 endpoint 로 변경 불가 (POL-006 미성년자 방어 +
 * IAP receipt 사용자 동일성 보장).
 *
 * ADR-023 — Request DTO 는 snake_case (amb-starter-kit v2.0 표준).
 */
export class UpdateMeDto {
  @ApiProperty({ required: false, nullable: true, example: 'https://cdn.a-idol.dev/u/abc.jpg', name: 'avatar_url' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  avatar_url?: string | null;

  @ApiProperty({ required: false, example: true, name: 'marketing_opt_in' })
  @IsOptional()
  @IsBoolean()
  marketing_opt_in?: boolean;

  @ApiProperty({ required: false, example: true, name: 'push_opt_in' })
  @IsOptional()
  @IsBoolean()
  push_opt_in?: boolean;
}
