import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const port = config.get<number>("PORT") ?? 3001;
  const isProduction = config.get<string>("NODE_ENV") === "production";
  const webOrigins = (config.get<string>("WEB_ORIGIN") ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    helmet({
      // Swagger UI needs inline script initialization in development. Swagger is disabled in
      // production, where the default content security policy remains in force.
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );
  app.enableCors({
    origin: webOrigins,
    credentials: true,
  });
  configureApp(app);

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("PawnPilot API")
      .setDescription("Versioned REST API for the PawnPilot pawnshop platform.")
      .setVersion("1.0.0")
      .addCookieAuth("pp_session")
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup("api/docs", app, document, {
      jsonDocumentUrl: "api/openapi.json",
    });
  }

  await app.listen(port, "0.0.0.0");
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
