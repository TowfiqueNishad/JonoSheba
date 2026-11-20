/**
 * SMS Segment & Cost Analyzer (Bangla UCS-2 vs ASCII/GSM-7) + Safe Template Renderer.
 * Bangla Unicode characters force UCS-2 encoding: 70 chars for 1 segment, 67 chars/segment multi-part.
 */

const GSM7_REGEX = /^[\x20-\x7E\r\n£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¤¡ÄÖÑÜ§¿äöñüà]*$/;

const DEFAULT_COST_PER_SEGMENT_BDT = 0.35;

export interface SmsSegmentAnalysis {
  encoding: 'GSM-7' | 'UCS-2';
  charCount: number;
  maxCharsSingleSegment: number;
  charsPerConcatSegment: number;
  segmentCount: number;
  estimatedCostBdt: number;
}

export function analyzeSmsSegments(
  text: string,
  costPerSegmentBdt = DEFAULT_COST_PER_SEGMENT_BDT,
): SmsSegmentAnalysis {
  const charCount = [...text].length;
  const isGsm7 = GSM7_REGEX.test(text);
  const encoding = isGsm7 ? 'GSM-7' : 'UCS-2';
  const maxCharsSingleSegment = isGsm7 ? 160 : 70;
  const charsPerConcatSegment = isGsm7 ? 153 : 67;

  let segmentCount = 1;
  if (charCount === 0) {
    segmentCount = 0;
  } else if (charCount > maxCharsSingleSegment) {
    segmentCount = Math.ceil(charCount / charsPerConcatSegment);
  }

  return {
    encoding,
    charCount,
    maxCharsSingleSegment,
    charsPerConcatSegment,
    segmentCount,
    estimatedCostBdt: Number((segmentCount * costPerSegmentBdt).toFixed(2)),
  };
}

/** Safe Handlebars-style {{variable}} substitution (no eval, own properties only) */
export function renderTemplate(
  template: string,
  variables: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key] ?? '');
    }
    return '';
  });
}
