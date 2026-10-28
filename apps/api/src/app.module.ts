import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { AppController } from "./app.controller.js";
import { AccessGuard } from "./auth/access.guard.js";
import { AuthModule } from "./auth/auth.module.js";
import { BranchesModule } from "./branches/branches.module.js";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import { validateEnv } from "./common/config/env.js";
import { HealthModule } from "./health/health.module.js";
import { PlatformModule } from "./platform/platform.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDevelopment = config.get<string>("NODE_ENV") === "development";

        return {
          pinoHttp: {
            level: config.get<string>("LOG_LEVEL") ?? "info",
            transport: isDevelopment
              ? {
                  target: "pino-pretty",
                  options: {
                    singleLine: true,
                    colorize: true,
                  },
                }
              : undefined,
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers['set-cookie']",
              ],
              censor: "[redacted]",
            },
            genReqId: (request, response) => {
              const existing = request.headers["x-request-id"];
              const requestId =
                typeof existing === "string" && existing.length > 0 ? existing : randomUUID();

              response.setHeader("x-request-id", requestId);
              return requestId;
            },
          },
        };
      },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    PlatformModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AccessGuard,
    },
  ],
})
export class AppModule {}
