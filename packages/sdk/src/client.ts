import {
  DEFAULT_LOCALE,
  HealthResponseSchema,
  ProblemDetailsSchema,
  type CountryPack,
  type HealthResponse,
  type Locale,
  type ProblemDetails,
} from '@jonoshheba/shared';

export interface JonoshhebaClientOptions {
  baseUrl: string;
  locale?: Locale;
  getAccessToken?: () => Promise<string | null> | string | null;
  fetchImpl?: typeof fetch;
}

export class ApiProblemError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiProblemError';
    this.problem = problem;
  }
}

export class JonoshhebaClient {
  private readonly baseUrl: string;
  private readonly locale: Locale;
  private readonly getAccessToken?: () => Promise<string | null> | string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: JonoshhebaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.locale = options.locale ?? DEFAULT_LOCALE;
    this.getAccessToken = options.getAccessToken;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (!headers.has('Accept-Language')) {
      headers.set('Accept-Language', this.locale);
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.getAccessToken) {
      const token = await this.getAccessToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // Fallback to HTTP status text
      }
      const parsed = ProblemDetailsSchema.safeParse(body);
      if (parsed.success) {
        throw new ApiProblemError(parsed.data);
      }
      throw new ApiProblemError({
        type: 'about:blank',
        title: response.statusText || 'Request failed',
        status: response.status,
      });
    }

    return (await response.json()) as T;
  }

  async getHealth(): Promise<HealthResponse> {
    const data = await this.request<unknown>('/api/v1/health');
    return HealthResponseSchema.parse(data);
  }

  async searchCatalogue(q: string, limit = 10): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    return this.request<Record<string, unknown>>(`/api/v1/search?${qs.toString()}`);
  }

  async getEmergencyHub(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/emergency');
  }

  async searchTransport(params: {
    mode: 'train' | 'bus' | 'launch' | 'flight' | 'metro';
    origin: string;
    destination: string;
    date: string;
    passengers?: number;
  }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/transport/search', {
      method: 'POST',
      body: JSON.stringify({
        mode: params.mode,
        origin: params.origin,
        destination: params.destination,
        date: params.date,
        passengers: params.passengers ?? 1,
      }),
    });
  }

  async evaluateEligibility(answers: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/eligibility/evaluate', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  }

  private activeJonoSessionId?: string;
  private activeJonoSessionToken?: string;

  async sendJonoMessage(params: {
    message: string;
    sessionId?: string;
    sessionToken?: string;
    locale?: Locale;
  }): Promise<Record<string, unknown>> {
    const sid = params.sessionId ?? this.activeJonoSessionId;
    const tok = params.sessionToken ?? this.activeJonoSessionToken;
    const headers: Record<string, string> = {};
    if (tok) headers['X-Session-Token'] = tok;
    try {
      const res = await this.request<Record<string, unknown>>('/api/v1/assistant/message', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: params.message,
          sessionId: sid,
          locale: params.locale,
        }),
      });
      if (typeof res.sessionId === 'string') this.activeJonoSessionId = res.sessionId;
      if (typeof res.sessionToken === 'string') this.activeJonoSessionToken = res.sessionToken;
      return res;
    } catch (err) {
      if (err instanceof ApiProblemError && (err.problem.status === 401 || err.problem.status === 404)) {
        this.activeJonoSessionId = undefined;
        this.activeJonoSessionToken = undefined;
        const retry = await this.request<Record<string, unknown>>('/api/v1/assistant/message', {
          method: 'POST',
          body: JSON.stringify({
            message: params.message,
            locale: params.locale,
          }),
        });
        if (typeof retry.sessionId === 'string') this.activeJonoSessionId = retry.sessionId;
        if (typeof retry.sessionToken === 'string') this.activeJonoSessionToken = retry.sessionToken;
        return retry;
      }
      throw err;
    }
  }

  async suggestSearch(q: string, limit = 8): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    return this.request<Record<string, unknown>>(`/api/v1/search/suggest?${qs.toString()}`);
  }

  async listOrgs(params?: { q?: string; type?: string; group?: string }): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.type) qs.set('type', params.type);
    if (params?.group) qs.set('group', params.group);
    return this.request<Record<string, unknown>>(`/api/v1/orgs?${qs.toString()}`);
  }

  async getOrg(id: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/api/v1/orgs/${encodeURIComponent(id)}`);
  }

  async searchEducationInstitutions(params?: {
    q?: string;
    eiin?: string;
    district?: string;
    type?: string;
  }): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.eiin) qs.set('eiin', params.eiin);
    if (params?.district) qs.set('district', params.district);
    if (params?.type) qs.set('type', params.type);
    return this.request<Record<string, unknown>>(`/api/v1/education/institutions?${qs.toString()}`);
  }

  async listEducationUniversities(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/education/universities');
  }

  async listEducationBoards(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/education/boards');
  }

  async deleteJonoSession(sessionId: string, sessionToken?: string): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {};
    if (sessionToken) headers['X-Session-Token'] = sessionToken;
    return this.request<Record<string, unknown>>(
      `/api/v1/assistant/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE', headers },
    );
  }

  async getPublicStats(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/stats');
  }

  async getProgramme(slug: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/api/v1/programmes/${encodeURIComponent(slug)}`);
  }

  async getOpenApiSpec(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/openapi.json');
  }

  async getAdminOverview(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/admin/overview');
  }

  async getAdminReviewQueue(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/admin/review-queue');
  }

  async decideAdminReview(
    id: string,
    body: { decision: 'APPROVED' | 'REJECTED'; note?: string },
    reviewerId: string,
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/api/v1/admin/review-queue/${encodeURIComponent(id)}/decision`,
      {
        method: 'POST',
        headers: { 'x-reviewer-id': reviewerId },
        body: JSON.stringify(body),
      },
    );
  }

  async getAdminProviders(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/admin/providers');
  }

  async getAdminRegionalAnalytics(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/admin/analytics/regional');
  }

  async getAdminAiOps(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/admin/ai-ops');
  }

  async getCountryPacks(): Promise<{ packs: CountryPack[] }> {
    return this.request<{ packs: CountryPack[] }>('/api/v1/country-packs');
  }

  // --- Part 2 Full-Coverage Engine (C01–C13) ---

  async resolveGeoPoint(lat: number, lng: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/api/v1/geo/resolve?lat=${lat}&lng=${lng}`);
  }

  async searchGeo(q: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/api/v1/geo/search?q=${encodeURIComponent(q)}`);
  }

  async searchRailTrains(from: string, to: string, date?: string): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams({ from, to });
    if (date) qs.set('date', date);
    return this.request<Record<string, unknown>>(`/api/v1/rail/trains?${qs.toString()}`);
  }

  async getMetroFare(from: string, to: string): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams({ from, to });
    return this.request<Record<string, unknown>>(`/api/v1/metro/fare?${qs.toString()}`);
  }

  async getTolls(asset?: string, vehicleClass?: string): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams();
    if (asset) qs.set('asset', asset);
    if (vehicleClass) qs.set('vehicle_class', vehicleClass);
    return this.request<Record<string, unknown>>(`/api/v1/tolls?${qs.toString()}`);
  }

  async resolveResponsibleOffice(service: string, lat: number, lng: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/api/v1/offices/resolve?service=${encodeURIComponent(service)}&lat=${lat}&lng=${lng}`,
    );
  }

  async getServiceTaxonomy(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/services/taxonomy');
  }

  async evaluateSocialProgramme(slug: string, answers: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/api/v1/programmes/${encodeURIComponent(slug)}/eligibility`,
      { method: 'POST', body: JSON.stringify({ answers }) },
    );
  }

  async decideHotline(situation: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/api/v1/hotlines/decide?situation=${encodeURIComponent(situation)}`,
    );
  }

  async getCoverageHeatmap(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/admin/coverage/heatmap');
  }

  async getCoverageQuality(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/v1/admin/coverage/quality');
  }
}
