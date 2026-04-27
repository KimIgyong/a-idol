import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListIdolsQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  size = 20;

  @ApiPropertyOptional({ enum: ['popularity', 'name', 'new'], default: 'popularity' })
  @IsOptional()
  @IsEnum(['popularity', 'name', 'new'])
  sort: 'popularity' | 'name' | 'new' = 'popularity';
}
