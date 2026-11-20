import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@jonoshheba/shared';

let cachedOpenApiDocument: Record<string, unknown> | null = null;

export function setPublishedOpenApiDocument(doc: Record<string, unknown>): void {
  cachedOpenApiDocument = doc;
}

@ApiTags('System')
@Controller()
export class HealthController {
  private buildHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'jonoshheba-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      timezone: 'Asia/Dhaka',
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Service liveness check (bn: সার্ভিস সচল আছে কিনা যাচাই)' })
  @ApiOkResponse({ description: 'API is healthy' })
  getRootHealth(): HealthResponse {
    return this.buildHealth();
  }

  @Get('api/v1/health')
  @ApiOperation({ summary: 'Versioned v1 health check (bn: এপিআই স্বাস্থ্য যাচাই)' })
  @ApiOkResponse({ description: 'API v1 is healthy' })
  getVersionedHealth(): HealthResponse {
    return this.buildHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Service readiness check' })
  @ApiOkResponse({ description: 'API is ready to accept traffic' })
  getReady(): HealthResponse {
    return this.buildHealth();
  }

  @Get('api/v1/ready')
  @ApiOperation({ summary: 'Versioned v1 readiness check (bn: ট্রাফিক গ্রহণের প্রস্তুতি যাচাই)' })
  @ApiOkResponse({ description: 'API v1 is ready to accept traffic' })
  getVersionedReady(): HealthResponse {
    return this.buildHealth();
  }

  @Get('api/v1/openapi.json')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Published OpenAPI 3.1 JSON specification (bn: ওপেনএপিআই স্পেসিফিকেশন)' })
  getOpenApiSpec(): Record<string, unknown> {
    return (
      cachedOpenApiDocument ?? {
        openapi: '3.0.0',
        info: { title: 'Jonoshheba AI API', version: '0.1.0' },
        paths: {},
      }
    );
  }
}
