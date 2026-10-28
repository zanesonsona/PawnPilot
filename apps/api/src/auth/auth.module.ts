import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { EmailModule } from "../email/email.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { PasswordService } from "./password.service.js";
import { SessionService } from "./session.service.js";
import { TotpService } from "./totp.service.js";

@Module({
  imports: [AuditModule, EmailModule],
  controllers: [AuthController],
  providers: [PasswordService, TotpService, SessionService, AuthService],
  exports: [PasswordService, TotpService, SessionService, AuthService],
})
export class AuthModule {}
