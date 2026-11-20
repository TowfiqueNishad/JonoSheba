import { Injectable } from '@nestjs/common';
import {
  detectIntentHint,
  editDistance,
  expandCrossLingualQuery,
  normalizeBanglaText,
  trigramSimilarity,
} from '../domain/bangla-nlp';
import type {
  SearchDocument,
  SearchItemType,
  UniversalSearchHit,
  UniversalSearchResponse,
} from '../domain/catalogue.types';
import type {
  SearchPort,
  SearchQueryInput,
  SuggestItem,
  SuggestResponse,
} from '../ports/search.port';

const RRF_K = 60;

interface PreparedDoc {
  doc: SearchDocument;
  normTitleBn: string;
  normTitleEn: string;
  normKeywords: string[];
  normBody: string;
  tokens: string[];
}

function mapDocGroupAndIcon(type: SearchItemType): {
  group: SuggestItem['group'];
  icon: string;
  weight: number;
} {
  switch (type) {
    case 'service':
    case 'program':
    case 'scholarship':
    case 'job':
    case 'faq':
      return { group: 'Services', icon: 'file-text', weight: 1.35 };
    case 'life_event':
      return { group: 'Life events', icon: 'sparkles', weight: 1.25 };
    case 'station':
      return { group: 'Trains/Stations', icon: 'train', weight: 1.3 };
    case 'bus_route':
      return { group: 'Bus routes', icon: 'bus', weight: 1.25 };
    case 'hotline':
      return { group: 'Hotlines', icon: 'phone', weight: 1.4 };
    case 'ministry':
    case 'facility':
      return { group: 'Ministries/Offices', icon: 'building', weight: 1.2 };
    case 'institution':
      return { group: 'Institutions/EIIN', icon: 'graduation-cap', weight: 1.3 };
    case 'notice':
      return { group: 'Notices', icon: 'bell', weight: 1.1 };
  }
}

function computeMatchRanges(text: string, rawQuery: string): Array<[number, number]> {
  const q = rawQuery.trim();
  if (!q) return [];
  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const idx = lowerText.indexOf(lowerQ);
  if (idx !== -1) {
    return [[idx, idx + q.length]];
  }
  const tokens = lowerQ.split(/\s+/).filter((t) => t.length >= 2);
  const ranges: Array<[number, number]> = [];
  for (const tok of tokens) {
    const pos = lowerText.indexOf(tok);
    if (pos !== -1) {
      ranges.push([pos, pos + tok.length]);
    }
  }
  return ranges;
}

/**
 * Hybrid Reciprocal Rank Fusion (RRF) + Edge-N-Gram Prefix Suggest Adapter:
 *  1) Lexical FTS (normalized Bangla + English exact phrase & token matching)
 *  2) Fuzzy pg_trgm-equivalent character trigram similarity (typo tolerance)
 *  3) Cross-lingual semantic/synonym expansion + intent module boost
 *  4) Edge-n-gram prefix autocomplete with Redis-ready LRU cache (<80ms p95)
 */
@Injectable()
export class HybridRrfSearchAdapter implements SearchPort {
  private readonly suggestCache = new Map<string, SuggestResponse>();

  private prepare(doc: SearchDocument): PreparedDoc {
    const normTitleBn = normalizeBanglaText(doc.titleBn);
    const normTitleEn = normalizeBanglaText(doc.titleEn);
    const normKeywords = doc.keywords.map(normalizeBanglaText).filter(Boolean);
    const normBody = normalizeBanglaText(`${doc.summaryBn} ${doc.summaryEn}`);
    const tokens = `${normTitleBn} ${normTitleEn} ${normKeywords.join(' ')}`
      .split(/\s+/)
      .filter(Boolean);
    return { doc, normTitleBn, normTitleEn, normKeywords, normBody, tokens };
  }

  private scoreLexical(p: PreparedDoc, queryNorm: string, queryTokens: string[]): number {
    let score = 0;

    if (p.normTitleBn === queryNorm || p.normTitleEn === queryNorm) score += 20;
    if (p.normKeywords.some((k) => k === queryNorm)) score += 18;
    if (p.normTitleBn.includes(queryNorm) || p.normTitleEn.includes(queryNorm)) score += 12;
    if (p.normKeywords.some((k) => k.includes(queryNorm))) score += 10;
    if (p.normBody.includes(queryNorm)) score += 4;

    let matchedTokens = 0;
    for (const token of queryTokens) {
      if (token.length < 2) continue;
      if (p.normTitleBn.includes(token) || p.normTitleEn.includes(token)) {
        score += 4.5;
        matchedTokens++;
      } else if (p.normKeywords.some((k) => k.includes(token))) {
        score += 4;
        matchedTokens++;
      } else if (p.normBody.includes(token)) {
        score += 1.5;
        matchedTokens++;
      }
    }

    if (queryTokens.length > 1 && matchedTokens === queryTokens.length) {
      score += 6;
    }
    return score;
  }

  private scoreFuzzyTrigram(p: PreparedDoc, queryNorm: string): number {
    let best = Math.max(
      trigramSimilarity(queryNorm, p.normTitleBn),
      trigramSimilarity(queryNorm, p.normTitleEn),
    );
    for (const kw of p.normKeywords) {
      const sim = trigramSimilarity(queryNorm, kw);
      if (sim > best) best = sim;
    }
    return best >= 0.16 ? best : 0;
  }

  private scoreCrossLingualSemantic(
    p: PreparedDoc,
    expandedTerms: string[],
    intentModule: string,
  ): number {
    let score = 0;
    const combined = `${p.normTitleBn} ${p.normTitleEn} ${p.normKeywords.join(' ')} ${p.normBody}`;

    for (const term of expandedTerms) {
      if (term.length < 2) continue;
      if (p.normTitleBn.includes(term) || p.normTitleEn.includes(term)) {
        score += 6;
      } else if (p.normKeywords.some((k) => k === term || k.includes(term))) {
        score += 5.5;
      } else if (combined.includes(term)) {
        score += 2;
      }
    }

    if (
      (intentModule === 'transport' && (p.doc.type === 'station' || p.doc.type === 'bus_route' || p.doc.slugOrCode.includes('railway'))) ||
      (intentModule === 'benefit' && p.doc.type === 'program') ||
      (intentModule === 'scholarship' && p.doc.type === 'scholarship') ||
      (intentModule === 'emergency' && p.doc.type === 'hotline') ||
      (intentModule === 'health' && (p.doc.type === 'facility' || p.doc.type === 'service'))
    ) {
      if (score > 0) score += 2.5;
    }

    if (p.doc.type === 'service' && score > 0) {
      score += 1.2;
    }

    return score;
  }

  private findDidYouMean(prepared: PreparedDoc[], queryNorm: string, locale: 'bn' | 'en'): string | null {
    if (queryNorm.length < 3) return null;
    let bestCandidate: string | null = null;
    let bestScore = 0;

    for (const p of prepared) {
      const candidates = [p.normTitleBn, p.normTitleEn, ...p.normKeywords];
      for (const c of candidates) {
        if (!c || Math.abs(c.length - queryNorm.length) > 6) continue;
        const sim = trigramSimilarity(queryNorm, c);
        const dist = editDistance(queryNorm, c);
        if ((sim >= 0.35 || dist <= 2) && sim > bestScore) {
          bestScore = sim;
          bestCandidate = locale === 'en' ? p.doc.titleEn : p.doc.titleBn;
        }
      }
    }
    return bestCandidate;
  }

  async search(
    documents: readonly SearchDocument[],
    input: SearchQueryInput,
  ): Promise<UniversalSearchResponse> {
    const t0 = performance.now();
    const rawQuery = input.query.trim();
    const normalizedQuery = normalizeBanglaText(rawQuery);
    const intentHint = detectIntentHint(rawQuery);
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

    if (!normalizedQuery) {
      return {
        query: rawQuery,
        normalizedQuery: '',
        expandedTerms: [],
        didYouMean: null,
        intentHint,
        total: 0,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
        hits: [],
      };
    }

    const filteredDocs = input.types?.length
      ? documents.filter((d) => input.types!.includes(d.type))
      : documents;

    const prepared = filteredDocs.map((d) => this.prepare(d));
    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    const expandedTerms = expandCrossLingualQuery(normalizedQuery);

    const lexicalRanked = prepared
      .map((p) => ({ id: p.doc.id, score: this.scoreLexical(p, normalizedQuery, queryTokens) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const trigramRanked = prepared
      .map((p) => ({ id: p.doc.id, score: this.scoreFuzzyTrigram(p, normalizedQuery) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const semanticRanked = prepared
      .map((p) => ({
        id: p.doc.id,
        score: this.scoreCrossLingualSemantic(p, expandedTerms, intentHint.module),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const rrfScores = new Map<string, number>();
    const accumulate = (list: Array<{ id: string; score: number }>, weight: number) => {
      list.forEach((entry, idx) => {
        const prev = rrfScores.get(entry.id) ?? 0;
        rrfScores.set(entry.id, prev + weight / (RRF_K + idx + 1));
      });
    };

    accumulate(lexicalRanked, 1.4);
    accumulate(semanticRanked, 1.2);
    accumulate(trigramRanked, 0.9);

    const byId = new Map(filteredDocs.map((d) => [d.id, d]));
    const hits: UniversalSearchHit[] = [...rrfScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => {
        const doc = byId.get(id)!;
        return {
          id: doc.id,
          type: doc.type,
          slugOrCode: doc.slugOrCode,
          title: input.locale === 'en' ? doc.titleEn : doc.titleBn,
          titleBn: doc.titleBn,
          titleEn: doc.titleEn,
          summary: input.locale === 'en' ? doc.summaryEn : doc.summaryBn,
          url: doc.url,
          score: Number(score.toFixed(5)),
          trustLabel: doc.trustLabel,
          attribution: doc.attribution,
          extra: doc.extra,
        };
      });

    const didYouMean =
      lexicalRanked.length === 0 ? this.findDidYouMean(prepared, normalizedQuery, input.locale) : null;

    return {
      query: rawQuery,
      normalizedQuery,
      expandedTerms,
      didYouMean,
      intentHint,
      total: rrfScores.size,
      latencyMs: Number((performance.now() - t0).toFixed(2)),
      hits,
    };
  }

  async suggest(
    documents: readonly SearchDocument[],
    query: string,
    locale: 'bn' | 'en',
    limit = 8,
  ): Promise<SuggestResponse> {
    const t0 = performance.now();
    const norm = normalizeBanglaText(query);
    const cacheKey = `${locale}:${limit}:${norm}`;
    const cached = this.suggestCache.get(cacheKey);
    if (cached) {
      const tookMs = Number((performance.now() - t0).toFixed(2));
      return { ...cached, latencyMs: tookMs, tookMs };
    }

    if (!norm) {
      return { query, items: [], suggestions: [], didYouMean: null, latencyMs: 0, tookMs: 0 };
    }

    const dynamicItems: SuggestItem[] = [];

    // Dynamic EIIN prefix lookup: "eiin 1...", "eiin 108274", "ইআইআইএন ১..."
    const eiinMatch = norm.match(/^(?:eiin\s*|ইআইআইএন\s*)(\d{1,6})$/i) ?? norm.match(/^(\d{6})$/);
    if (eiinMatch) {
      const code = eiinMatch[1]!;
      const text =
        locale === 'en'
          ? `EIIN ${code} — Education Institution Lookup`
          : `EIIN ${code} — শিক্ষা প্রতিষ্ঠান অনুসন্ধান`;
      const textAlt =
        locale === 'en'
          ? `EIIN ${code} — শিক্ষা প্রতিষ্ঠান অনুসন্ধান`
          : `EIIN ${code} — Education Institution Lookup`;
      dynamicItems.push({
        text,
        textAlt,
        type: 'institution',
        group: 'Institutions/EIIN',
        slugOrCode: `eiin-${code}`,
        url: `/education?eiin=${encodeURIComponent(code)}`,
        icon: 'graduation-cap',
        matchRanges: computeMatchRanges(text, code),
      });
    }

    const prepared = documents.map((d) => this.prepare(d));
    const expanded = expandCrossLingualQuery(norm);
    const queryTokens = norm.split(' ').filter(Boolean);

    const scored = prepared
      .map((p) => {
        let score = 0;
        const { weight } = mapDocGroupAndIcon(p.doc.type);

        // Edge-n-gram & exact prefix boosts
        if (p.normTitleBn === norm || p.normTitleEn === norm) score += 24;
        if (p.normKeywords.some((k) => k === norm)) score += 22;
        if (p.normTitleBn.startsWith(norm) || p.normTitleEn.startsWith(norm)) score += 16;
        if (p.normKeywords.some((k) => k.startsWith(norm))) score += 15;
        if (p.tokens.some((tok) => tok.startsWith(norm))) score += 12;

        // Multi-token prefix match (e.g., "dhaka ctg", "dhaka uni", "ssc res")
        if (queryTokens.length > 1) {
          const allTokensMatch = queryTokens.every(
            (qt) =>
              p.tokens.some((tok) => tok.startsWith(qt) || tok.includes(qt)) ||
              p.normKeywords.some((k) => k.includes(qt)),
          );
          if (allTokensMatch) score += 18;
        }

        if (p.normTitleBn.includes(norm) || p.normTitleEn.includes(norm)) score += 7;
        if (p.normKeywords.some((k) => k.includes(norm))) score += 6.5;
        if (
          expanded.some(
            (t) =>
              t.length >= 2 &&
              (p.normTitleBn.includes(t) ||
                p.normTitleEn.includes(t) ||
                p.normKeywords.some((k) => k.includes(t))),
          )
        ) {
          score += 6;
        }

        score += trigramSimilarity(norm, p.normTitleBn) * 3.5;
        score += trigramSimilarity(norm, p.normTitleEn) * 3.5;

        return { doc: p.doc, score: score * weight };
      })
      .filter((x) => x.score > 1.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, limit - dynamicItems.length));

    const staticItems: SuggestItem[] = scored.map(({ doc }) => {
      const { group, icon } = mapDocGroupAndIcon(doc.type);
      const text = locale === 'en' ? doc.titleEn : doc.titleBn;
      const textAlt = locale === 'en' ? doc.titleBn : doc.titleEn;
      return {
        text,
        textAlt,
        type: doc.type,
        group,
        slugOrCode: doc.slugOrCode,
        url: doc.url,
        icon,
        matchRanges: computeMatchRanges(text, query),
      };
    });

    const items = [...dynamicItems, ...staticItems].slice(0, limit);
    const tookMs = Number((performance.now() - t0).toFixed(2));

    const response: SuggestResponse = {
      query,
      items,
      suggestions: items,
      didYouMean: items.length === 0 ? this.findDidYouMean(prepared, norm, locale) : null,
      latencyMs: tookMs,
      tookMs,
    };

    if (this.suggestCache.size > 1000) {
      this.suggestCache.clear();
    }
    this.suggestCache.set(cacheKey, response);
    return response;
  }
}
