import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from './password.validator';

export class SignupDto {
  @ApiProperty({ example: 'demo@a-idol.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'correct horse battery staple', minLength: 8, maxLength: 64 })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ example: 'demo', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  nickname!: string;

  @ApiProperty({ example: '2000-01-01' })
  @IsDateString()
  birthdate!: string;

  // ADR-023 — Request DTO 는 snake_case (amb-starter-kit v2.0 표준).
  @ApiProperty({ required: false, example: 'iphone-XYZ', name: 'device_id' })
  @IsOptional()
  @IsString()
  device_id?: string;
}
