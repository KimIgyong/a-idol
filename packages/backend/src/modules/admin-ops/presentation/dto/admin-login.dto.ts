import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@a-idol.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'admin-dev-0000' })
  @IsString()
  @MinLength(8)
  password!: string;
}

// ADR-023 — Request DTO 는 snake_case (amb-starter-kit v2.0 표준).
export class AdminRefreshDto {
  @ApiProperty({ name: 'refresh_token' })
  @IsString()
  refresh_token!: string;
}
