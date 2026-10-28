import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from "class-validator";
import { UserRole } from "@prisma/client";

export class CreateBranchUserDto {
  @ApiProperty({
    description: "Company-scoped username.",
    example: "juan.dela-cruz",
    minLength: 3,
    maxLength: 64,
  })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._-]{2,63}$/u, {
    message: "username must be 3-64 lowercase letters, numbers, dots, underscores, or hyphens.",
  })
  username!: string;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiProperty({ type: [String], format: "uuid", minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  branchIds!: string[];
}

export class InviteHeadOfficeDto {
  @ApiProperty({ format: "email" })
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class UpdateBranchesDto {
  @ApiProperty({ type: [String], format: "uuid", minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  branchIds!: string[];
}

export class UpdateRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}
