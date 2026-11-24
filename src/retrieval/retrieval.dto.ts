import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RetrievalSearchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @Matches(/\S/, {
    message: 'query must contain non-whitespace characters',
  })
  query: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1)
  @Max(1)
  minScore?: number;
}
