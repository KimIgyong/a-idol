import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo@a-idol.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password!: string;

  @ApiProperty({ required: false, example: 'iphone-XYZ' })
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
