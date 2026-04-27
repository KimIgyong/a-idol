import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * `PATCH /api/v1/me` 본문. 모든 필드 optional — 클라이언트가 보낸 필드만 갱신.
 *
 * - `avatarUrl`은 `null`이면 명시적 제거. 미전송이면 변경 없음.
 * - `marketingOptIn` / `pushOptIn`은 boolean. 미전송이면 변경 없음.
 *
 * 닉네임/생년월일/이메일은 본 endpoint로 변경 불가 (POL-006 미성년자 방어 +
 * IAP receipt 사용자 동일성 보장).
 */
export class UpdateMeDto {
  @ApiProperty({ required: false, nullable: true, example: 'https://cdn.a-idol.dev/u/abc.jpg' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  pushOptIn?: boolean;
}
