import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

export class CreateCompanyDto {
  @ApiProperty({ example: "Jerome's Pawnshop", minLength: 2, maxLength: 200 })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiProperty({ example: "jeromes-pawnshop" })
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/u, {
    message: "slug must be a lowercase company slug.",
  })
  slug!: string;

  @ApiProperty({ format: "email", example: "owner@example.com" })
  @IsEmail()
  @MaxLength(320)
  ownerEmail!: string;

  @ApiPropertyOptional({ example: "Colon" })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  branchName?: string;

  @ApiPropertyOptional({ example: "CEB-01" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{2,32}$/u, {
    message: "branchCode must be 2-32 letters, numbers, or hyphens.",
  })
  branchCode?: string;
}

export class CreateOwnerInvitationDto {
  @ApiProperty({ format: "email" })
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
