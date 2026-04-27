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

export class AdminRefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
