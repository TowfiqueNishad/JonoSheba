import { NextResponse, type NextRequest } from 'next/server';

const SERVICE_GUIDES: Record<
  string,
  { titleBn: string; titleEn: string; feeBn: string; feeEn: string; docsBn: string[]; docsEn: string[]; url: string }
> = {
  'birth-registration': {
    titleBn: 'জন্ম নিবন্ধন (BDRIS)',
    titleEn: 'Birth Registration (BDRIS)',
    feeBn: '৪৫ দিন পর্যন্ত ০ টাকা, ৫ বছর পর্যন্ত ২৫ টাকা, ৫ বছরের বেশি ৫০ টাকা।',
    feeEn: '0 BDT within 45 days, 25 BDT up to 5 years, 50 BDT after 5 years.',
    docsBn: ['হাসপাতালের ছাড়পত্র বা টিকা কার্ড', 'পিতা-মাতার এনআইডি ও জন্ম নিবন্ধন সনদ'],
    docsEn: ['Hospital discharge or EPI vaccination card', 'Parents’ NID and birth registration certificates'],
    url: 'https://bdris.gov.bd',
  },
  'e-passport-new': {
    titleBn: 'ই-পাসপোর্ট আবেদন (DIP)',
    titleEn: 'e-Passport Application (DIP)',
    feeBn: 'মেয়াদ ও পাতার সংখ্যা অনুযায়ী সরকারি ফি epassport.gov.bd-এ নির্ধারিত।',
    feeEn: 'Official fees by validity & pages listed at epassport.gov.bd.',
    docsBn: ['এনআইডি (২০+ বছর) অথবা ১৭ সংখ্যার যাচাইযোগ্য জন্ম নিবন্ধন সনদ', 'অনলাইন আবেদন কপি ও ফি রসিদ'],
    docsEn: ['NID (age 20+) or 17-digit verifiable birth certificate', 'Online application summary & payment receipt'],
    url: 'https://www.epassport.gov.bd',
  },
  'land-e-mutation': {
    titleBn: 'ভূমি ই-নামজারি',
    titleEn: 'Land e-Mutation (Namjari)',
    feeBn: 'সরকারি অনলাইন ফি ১,১৭০ টাকা।',
    feeEn: 'Official online fee 1,170 BDT.',
    docsBn: ['দলিলের কপি ও পূর্ববর্তী খতিয়ান', 'জাতীয় পরিচয়পত্র ও সদ্য তোলা ছবি'],
    docsEn: ['Deed copy & prior khatian', 'National ID & recent photograph'],
    url: 'https://land.gov.bd',
  },
  'driving-licence': {
    titleBn: 'বিআরটিএ ই-ড্রাইভিং লাইসেন্স',
    titleEn: 'BRTA e-Driving Licence',
    feeBn: 'বিআরটিএ সার্ভিস পোর্টাল (bsp.brta.gov.bd)-এ নির্ধারিত সরকারি ফি।',
    feeEn: 'Official government fees on BRTA Service Portal (bsp.brta.gov.bd).',
    docsBn: ['জাতীয় পরিচয়পত্র', 'মেডিকেল সার্টিফিকেট ও শিক্ষাগত সনদ'],
    docsEn: ['National ID', 'Medical certificate & educational certificate'],
    url: 'https://bsp.brta.gov.bd/',
  },
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const langParam = request.nextUrl.searchParams.get('lang');
  const locale: 'bn' | 'en' = langParam === 'en' ? 'en' : 'bn';
  const isBn = locale === 'bn';
  const guide = SERVICE_GUIDES[slug];

  if (!guide) {
    return new NextResponse(
      `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><title>404</title></head><body><h1>${isBn ? 'সেবাটি পাওয়া যায়নি' : 'Service not found'}</h1><p><a href="/lite?lang=${locale}">← Lite Home</a></p></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const docs = isBn ? guide.docsBn : guide.docsEn;
  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${isBn ? guide.titleBn : guide.titleEn}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:12px;color:#0f172a;line-height:1.6}a{color:#065f46;font-weight:700}</style></head>
<body>
<p><a href="/lite?lang=${locale}">← ${isBn ? '২জি লাইট হোম' : '2G Lite Home'}</a> · <a href="/lite/services/${slug}?lang=${isBn ? 'en' : 'bn'}">${isBn ? 'English' : 'বাংলা'}</a></p>
<h1>${isBn ? guide.titleBn : guide.titleEn}</h1>
<p><strong>${isBn ? 'সরকারি ফি:' : 'Official fee:'}</strong> ${isBn ? guide.feeBn : guide.feeEn}</p>
<h2>${isBn ? 'প্রয়োজনীয় কাগজপত্র' : 'Required documents'}</h2>
<ul>${docs.map((d) => `<li>${d}</li>`).join('')}</ul>
<p><a href="${guide.url}">${isBn ? 'অফিশিয়াল পোর্টালে আবেদন করুন →' : 'Continue to official portal →'}</a></p>
<p style="font-size:.85rem">${isBn ? 'স্বাধীন প্ল্যাটফর্ম — এটি কোনো সরকারি সেবা নয়।' : 'Independent platform — not an official government service.'}</p>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Language': locale,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
