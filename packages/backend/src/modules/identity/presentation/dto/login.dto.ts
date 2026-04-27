import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

// ADR-023 — Request DTO 는 snake_case (amb-starter-kit v2.0 표준).
export class LoginDto {
  @ApiProperty({ example: 'demo@a-idol.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password!: string;

  @ApiProperty({ required: false, example: 'iphone-XYZ', name: 'device_id' })
  @IsOptional()
  @IsString()
  device_id?: string;
}

export class RefreshDto {
  @ApiProperty({ name: 'refresh_token' })
  @IsString()
  refresh_token!: string;
}
