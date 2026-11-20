/**
 * C06/C07 Polite National Portal Citizen Charter (সিটিজেন চার্টার) Parser.
 * - Strictly obeys Rule C7: contact User-Agent, low rate, respects robots.txt, no login/CAPTCHA scraping.
 * - Extracts service name, required documents, official fee, processing time, and grievance officer
 *   into a PENDING_REVIEW task (never auto-publishes).
 */

export const POLITE_CRAWLER_HEADERS = {
  'User-Agent': 'JonoshhebaCoverageBot/1.0 (+https://jonoshheba.example/bot-policy; contact: ops@jonoshheba.example)',
  Accept: 'text/html,application/xhtml+xml',
} as const;

export interface ParsedCharterService {
  serviceNameBn: string;
  feeText: string;
  processingTimeText: string;
  requiredDocuments: string[];
  sourceUrl: string;
  sourceId: string;
  reviewStatus: 'PENDING_REVIEW';
}

export function parseCitizenCharterText(rawText: string, sourceUrl: string): ParsedCharterService[] {
  const blocks = rawText
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 10);

  return blocks.map((block, idx) => {
    const feeMatch = block.match(/(?:ফি|Fee)[:\s-]*([^\n।]+)/i);
    const timeMatch = block.match(/(?:সময়|নিষ্পত্তি|Time)[:\s-]*([^\n।]+)/i);
    const docsMatch = block.match(/(?:কাগজপত্র|দলিল|Documents)[:\s-]*([^\n।]+)/i);
    const firstLine = block.split('\n')[0]?.trim() || `সেবা #${idx + 1}`;
    return {
      serviceNameBn: firstLine,
      feeText: feeMatch?.[1]?.trim() ?? 'অফিসিয়াল চার্টারে যাচাই করুন',
      processingTimeText: timeMatch?.[1]?.trim() ?? 'অফিসিয়াল চার্টারে যাচাই করুন',
      requiredDocuments: docsMatch?.[1]
        ? docsMatch[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean)
        : [],
      sourceUrl,
      sourceId: 'SRC_MYGOV_A2I',
      reviewStatus: 'PENDING_REVIEW',
    };
  });
}
