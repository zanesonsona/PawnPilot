import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { AppController } from "./app.controller.js";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import { validateEnv } from "./common/config/env.js";
import { HealthModule } from "./health/health.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

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
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
