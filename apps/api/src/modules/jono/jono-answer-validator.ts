const BANGLA_TO_ASCII_DIGIT: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function normalizeDigitsToAscii(text: string): string {
  return text
    .replace(/[০-৯]/g, (d) => BANGLA_TO_ASCII_DIGIT[d] ?? d)
    .replace(/,/g, '');
}

/** Always-allowed national hotline & citation numbers that may appear in system templates */
const ALLOWLISTED_SYSTEM_NUMBERS = new Set([
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '10',
  '12',
  '16',
  '17',
  '20',
  '24',
  '30',
  '45',
  '60',
  '999',
  '333',
  '102',
  '105',
  '106',
  '109',
  '131',
  '1090',
  '1098',
  '16107',
  '16116',
  '16117',
  '16120',
  '16121',
  '16122',
  '16123',
  '16162',
  '16200',
  '16263',
  '16430',
  '16445',
  '16496',
  '16603',
  '16899',
  '2026',
  '2027',
]);

/**
 * Section 1.8 Number / Fee / Date Grounding Validator:
 * Ensures numbers in the reply appear in the grounded evidence texts (tool output or cited chunks).
 * Any ungrounded 3+ digit number not present in the evidence corpus or system allowlist is stripped.
 */
export function validateGroundedNumbers(reply: string, evidenceTexts: string[]): {
  validatedReply: string;
  strippedNumbers: string[];
} {
  const normEvidence = normalizeDigitsToAscii(evidenceTexts.join(' '));
  const evidenceNumbers = new Set<string>(ALLOWLISTED_SYSTEM_NUMBERS);
  for (const m of normEvidence.matchAll(/\d+/g)) {
    evidenceNumbers.add(m[0]);
  }

  const strippedNumbers: string[] = [];
  const validatedReply = reply.replace(/[০-৯\d][০-৯\d,]*/g, (rawMatch) => {
    const ascii = normalizeDigitsToAscii(rawMatch);
    if (ascii.length <= 2 || evidenceNumbers.has(ascii)) {
      return rawMatch;
    }
    strippedNumbers.push(rawMatch);
    return '';
  });

  return { validatedReply, strippedNumbers };
}
