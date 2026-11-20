import { describe, expect, it, vi } from 'vitest';
import { ApiProblemError, JonoshhebaClient } from './client';

describe('JonoshhebaClient', () => {
  it('sends Accept-Language header and validates health response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          service: 'jonoshheba-api',
          version: '0.1.0',
          timestamp: new Date().toISOString(),
          timezone: 'Asia/Dhaka',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const client = new JonoshhebaClient({
      baseUrl: 'http://localhost:4000/',
      fetchImpl: mockFetch,
    });

    const health = await client.getHealth();
    expect(health.status).toBe('ok');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get('Accept-Language')).toBe('bn');
  });

  it('throws ApiProblemError on RFC 9457 problem+json responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'https://jonoshheba.app/errors/not-found',
          title: 'Resource not found',
          status: 404,
          detail: 'Service slug does not exist',
        }),
        { status: 404, headers: { 'content-type': 'application/problem+json' } },
      ),
    );

    const client = new JonoshhebaClient({
      baseUrl: 'http://localhost:4000',
      fetchImpl: mockFetch,
    });

    await expect(client.getHealth()).rejects.toBeInstanceOf(ApiProblemError);
  });
});
