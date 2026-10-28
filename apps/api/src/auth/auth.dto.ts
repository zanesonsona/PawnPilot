import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

export class LoginDto {
  @ApiProperty({
    description: "Company email address or company-scoped username.",
    example: "owner@example.com",
    minLength: 1,
    maxLength: 320,
  })
  @IsString()
  @Length(1, 320)
  identifier!: string;

  @ApiProperty({ minLength: 1, maxLength: 128, format: "password" })
  @IsString()
  @Length(1, 128)
  password!: string;

  @ApiPropertyOptional({
    description: "Required when identifier is a username rather than an email.",
    example: "jeromes-pawnshop",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/u, {
    message: "companySlug must be a lowercase company slug.",
  })
  companySlug?: string;
}

export class PlatformLoginDto {
  @ApiProperty({ format: "email", example: "platform@example.com" })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 128, format: "password" })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class MfaVerifyDto {
  @ApiProperty({ minLength: 20, maxLength: 200 })
  @IsString()
  @Length(20, 200)
  challengeToken!: string;

  @ApiProperty({
    description: "Six-digit TOTP code or a one-time recovery code.",
    example: "123456",
    minLength: 6,
    maxLength: 32,
  })
  @IsString()
  @Length(6, 32)
  code!: string;
}

export class MfaEnrollmentStartDto {
  @ApiProperty({ minLength: 20, maxLength: 200 })
  @IsString()
  @Length(20, 200)
  challengeToken!: string;
}

export class MfaEnrollmentConfirmDto {
  @ApiProperty({ minLength: 20, maxLength: 200 })
  @IsString()
  @Length(20, 200)
  challengeToken!: string;

  @ApiProperty({ example: "123456", pattern: "^\\d{6}$" })
  @Matches(/^\d{6}$/u, { message: "code must be a six-digit TOTP code." })
  code!: string;
}

export class AcceptInvitationDto {
  @ApiProperty({ minLength: 20, maxLength: 200 })
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, format: "password" })
  @IsString()
  @Length(12, 128)
  password!: string;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  lastName!: string;
}

export class PasswordResetRequestDto {
  @ApiProperty({ format: "email" })
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class PasswordResetCompleteDto {
  @ApiProperty({ minLength: 20, maxLength: 200 })
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, format: "password" })
  @IsString()
  @Length(12, 128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: 1, maxLength: 128, format: "password" })
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, format: "password" })
  @IsString()
  @Length(12, 128)
  newPassword!: string;
}

export class MfaConfirmDto {
  @ApiProperty({ example: "123456", pattern: "^\\d{6}$" })
  @Matches(/^\d{6}$/u, { message: "code must be a six-digit TOTP code." })
  code!: string;
}

export class MfaDisableDto {
  @ApiProperty({ minLength: 1, maxLength: 128, format: "password" })
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ example: "123456", pattern: "^\\d{6}$" })
  @Matches(/^\d{6}$/u, { message: "code must be a six-digit TOTP code." })
  code!: string;
}
