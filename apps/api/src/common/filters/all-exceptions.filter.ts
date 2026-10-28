import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import type { Request, Response } from "express";

type ErrorBody = {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = this.getRequestId(request);
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.buildErrorBody(exception, status, requestId);

    if (status >= 500) {
      this.logger.error(
        {
          err: exception,
          requestId,
          path: request.url,
          method: request.method,
        },
        "Unhandled exception",
      );
    }

    response.status(status).json({ error: body });
  }

  private getRequestId(request: Request): string {
    const header = request.headers["x-request-id"];

    if (typeof header === "string" && header.length > 0) {
      return header;
    }

    return "unknown";
  }

  private buildErrorBody(exception: unknown, status: number, requestId: string): ErrorBody {
    if (!(exception instanceof HttpException)) {
      return {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        requestId,
      };
    }

    const exceptionResponse = exception.getResponse();
    let code = this.defaultCode(status);
    let message = exception.message;
    let details: unknown;

    if (typeof exceptionResponse === "string") {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
      const responseBody = exceptionResponse as Record<string, unknown>;
      const responseMessage = responseBody.message;

      if (Array.isArray(responseMessage)) {
        code = "VALIDATION_ERROR";
        message = "Request validation failed.";
        details = responseMessage;
      } else if (typeof responseMessage === "string") {
        message = responseMessage;
      }

      if (typeof responseBody.code === "string") {
        code = responseBody.code;
      }

      if (status === HttpStatus.SERVICE_UNAVAILABLE) {
        details = responseBody;
      }
    }

    if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      message = "Service unavailable.";
    }

    return {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      requestId,
    };
  }

  private defaultCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return "BAD_REQUEST";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "RATE_LIMITED";
      case HttpStatus.SERVICE_UNAVAILABLE:
        return "SERVICE_UNAVAILABLE";
      default:
        return status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR";
    }
  }
}
