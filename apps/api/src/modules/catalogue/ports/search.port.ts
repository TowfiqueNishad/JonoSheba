import type {
  SearchDocument,
  SearchItemType,
  UniversalSearchResponse,
} from '../domain/catalogue.types';

export interface SearchQueryInput {
  query: string;
  locale: 'bn' | 'en';
  types?: SearchItemType[];
  limit?: number;
}

export interface SuggestItem {
  text: string;
  textAlt: string;
  type: SearchItemType;
  group:
    | 'Services'
    | 'Life events'
    | 'Trains/Stations'
    | 'Bus routes'
    | 'Hotlines'
    | 'Ministries/Offices'
    | 'Institutions/EIIN'
    | 'Notices';
  slugOrCode: string;
  url: string;
  icon: string;
  matchRanges: Array<[number, number]>;
}

export interface SuggestResponse {
  query: string;
  items: SuggestItem[];
  suggestions: SuggestItem[];
  didYouMean: string | null;
  latencyMs: number;
  tookMs: number;
}

export interface SearchPort {
  search(documents: readonly SearchDocument[], input: SearchQueryInput): Promise<UniversalSearchResponse>;
  suggest(documents: readonly SearchDocument[], query: string, locale: 'bn' | 'en', limit?: number): Promise<SuggestResponse>;
}

export const SEARCH_PORT = Symbol('SEARCH_PORT');
