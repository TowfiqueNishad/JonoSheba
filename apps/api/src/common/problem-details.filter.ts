import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ProblemDetails } from '@jonoshheba/shared';
import { type LocalizedRequest, negotiateLocale } from './locale.middleware';

const LOCALIZED_TITLES: Record<number, { bn: string; en: string }> = {
  400: { bn: 'অনুরোধ সঠিক নয়', en: 'Bad Request' },
  401: { bn: 'প্রবেশের অনুমতি প্রয়োজন', en: 'Unauthorized' },
  403: { bn: 'এই কাজের অনুমতি নেই', en: 'Forbidden' },
  404: { bn: 'তথ্য পাওয়া যায়নি', en: 'Not Found' },
  409: { bn: 'তথ্যের বিরোধ রয়েছে', en: 'Conflict' },
  422: { bn: 'তথ্য যাচাইয়ে অসামঞ্জস্য', en: 'Unprocessable Entity' },
  429: { bn: 'অনুরোধের সীমা অতিক্রম করেছে', en: 'Too Many Requests' },
  500: { bn: 'সার্ভারে সাময়িক ত্রুটি হয়েছে', en: 'Internal Server Error' },
};

/** RFC 9457 application/problem+json global exception filter with localized titles & stable machine codes */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<LocalizedRequest>();
    const locale = request.locale ?? negotiateLocale(request);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const localized = LOCALIZED_TITLES[status] ?? LOCALIZED_TITLES[500]!;
    let title = locale === 'en' ? localized.en : localized.bn;
    let detail: string | undefined;
    let code = `HTTP_${status}`;
    let errors: Array<{ field: string; message: string }> | undefined;
    let suggestions: string[] | undefined;

    if (exception instanceof HttpException) {
      const resBody = exception.getResponse();
      if (typeof resBody === 'string') {
        detail = resBody;
      } else if (typeof resBody === 'object' && resBody !== null) {
        const obj = resBody as Record<string, unknown>;
        if (typeof obj.code === 'string') {
          code = obj.code;
        }
        if (locale === 'bn' && typeof obj.messageBn === 'string') {
          detail = obj.messageBn;
        } else if (locale === 'en' && typeof obj.messageEn === 'string') {
          detail = obj.messageEn;
        } else if (typeof obj.message === 'string') {
          detail = obj.message;
        } else if (Array.isArray(obj.message)) {
          detail = obj.message.join('; ');
        }
        if (Array.isArray(obj.errors)) {
          errors = obj.errors as Array<{ field: string; message: string }>;
        }
        if (Array.isArray(obj.suggestions)) {
          suggestions = obj.suggestions as string[];
        }
        if (typeof obj.retryAfterSeconds === 'number') {
          response.setHeader('Retry-After', String(obj.retryAfterSeconds));
        }
      }
      if (!title) {
        title = exception.name.replace(/Exception$/, '') || exception.message;
      }
    }

    const problem: ProblemDetails & { code: string; suggestions?: string[] } = {
      type: `https://jonoshheba.app/errors/http-${status}`,
      code,
      title,
      status,
      detail,
      instance: request.originalUrl,
      requestId:
        typeof request.headers['x-request-id'] === 'string'
          ? request.headers['x-request-id']
          : undefined,
      errors,
      ...(suggestions && suggestions.length > 0 ? { suggestions } : {}),
    };

    response.setHeader('Content-Language', locale);
    response.setHeader('Vary', 'Accept-Language');
    response.status(status).type('application/problem+json').json(problem);
  }
}
