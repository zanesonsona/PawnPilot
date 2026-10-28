import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BranchStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, Length, Matches } from "class-validator";

export class CreateBranchDto {
  @ApiProperty({ example: "CEB-01", minLength: 2, maxLength: 32 })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{2,32}$/u, {
    message: "code must be 2-32 letters, numbers, or hyphens.",
  })
  code!: string;

  @ApiProperty({ example: "Cebu City — Colon", minLength: 2, maxLength: 200 })
  @IsString()
  @Length(2, 200)
  name!: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @ApiPropertyOptional({ enum: BranchStatus })
  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;
}
