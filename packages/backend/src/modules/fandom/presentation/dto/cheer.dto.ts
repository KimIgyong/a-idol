import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

/**
 * `POST /api/v1/idols/:id/cheers` body. message는 trim 후 1~200자.
 *
 * @Transform(trim) — 공백만 입력 시 빈 문자열 처리되어 MinLength(1) 거부.
 */
export class CreateCheerDto {
  @ApiProperty({ minLength: 1, maxLength: 200, example: '오늘 무대 최고였어요!' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  message!: string;
}

export class ListCheersQuery {
  @ApiProperty({ required: false, example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiProperty({ required: false, example: 20, default: 20, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  size: number = 20;
}
