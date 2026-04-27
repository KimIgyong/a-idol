import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: '오늘 무대 정말 멋졌어요!' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
