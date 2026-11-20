import { NextResponse, type NextRequest } from 'next/server';

const LITE_SERVICES = [
  {
    slug: 'birth-registration',
    titleBn: 'জন্ম নিবন্ধন (BDRIS)',
    titleEn: 'Birth Registration (BDRIS)',
    url: 'https://bdris.gov.bd',
    feeBn: '৪৫ দিন পর্যন্ত ফ্রি, ৫ বছর পর্যন্ত ২৫ টাকা, ৫+ বছরে ৫০ টাকা',
    feeEn: 'Free <=45 days, 25 BDT up to 5 years, 50 BDT after 5 years',
  },
  {
    slug: 'e-passport-new',
    titleBn: 'ই-পাসপোর্ট আবেদন (DIP)',
    titleEn: 'e-Passport Application (DIP)',
    url: 'https://www.epassport.gov.bd',
    feeBn: 'সরকারি ফি তালিকা epassport.gov.bd-এ দেখুন',
    feeEn: 'Check official fee schedule at epassport.gov.bd',
  },
  {
    slug: 'land-e-mutation',
    titleBn: 'ভূমি ই-নামজারি (land.gov.bd)',
    titleEn: 'Land e-Mutation (land.gov.bd)',
    url: 'https://land.gov.bd',
    feeBn: '১,১৭০ টাকা (অনলাইন)',
    feeEn: '1,170 BDT (online)',
  },
  {
    slug: 'driving-licence',
    titleBn: 'বিআরটিএ ই-ড্রাইভিং লাইসেন্স',
    titleEn: 'BRTA e-Driving Licence',
    url: 'https://bsp.brta.gov.bd/',
    feeBn: 'সরকারি ফি bsp.brta.gov.bd-এ দেখুন',
    feeEn: 'Check official fee at bsp.brta.gov.bd',
  },
];

/**
 * Pure zero-JavaScript (< 6 KB) 2G / Opera Mini Lite Mode (Finding U10 / F05-I).
 * Emits zero <script> tags and plain-link Bangla/English switching.
 */
export function GET(request: NextRequest) {
  const langParam = request.nextUrl.searchParams.get('lang');
  const locale: 'bn' | 'en' =
    langParam === 'en' || request.headers.get('x-locale') === 'en' ? 'en' : 'bn';
  const isBn = locale === 'bn';

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${isBn ? 'জনসেবা AI — ২জি লাইট মোড' : 'Jonoshheba AI — 2G Lite Mode'}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:12px;color:#0f172a;background:#fff;line-height:1.6}
h1{font-size:1.3rem;margin:0 0 8px}h2{font-size:1.05rem;margin:16px 0 6px}
.em{border:2px solid #b91c1c;background:#fef2f2;padding:12px;border-radius:8px}
.card{border:1px solid #cbd5e1;padding:12px;border-radius:8px;margin-top:12px}
a{color:#065f46;font-weight:700}.em a{color:#991b1b}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:.9rem}
</style>
</head>
<body>
<div class="top">
  <strong>${isBn ? 'জনসেবা AI (২জি লাইট)' : 'Jonoshheba AI (2G Lite)'}</strong>
  <span><a href="/lite?lang=bn" lang="bn">বাংলা</a> | <a href="/lite?lang=en" lang="en">English</a></span>
</div>
<main>
  <div class="em">
    <h1>${isBn ? 'জরুরি সাহায্য (সরাসরি কল করুন)' : 'Immediate Emergency Help (Tap to Call)'}</h1>
    <p><a href="tel:999">999</a> (${isBn ? 'পুলিশ/ফায়ার/অ্যাম্বুলেন্স' : 'Police/Fire/Ambulance'}) · <a href="tel:333">333</a> (${isBn ? 'সরকারি তথ্য' : 'Gov Info'}) · <a href="tel:16263">16263</a> (${isBn ? 'স্বাস্থ্য' : 'Health'}) · <a href="tel:109">109</a> (${isBn ? 'নারী ও শিশু' : 'Women/Child'})</p>
  </div>
  <section class="card">
    <h2>${isBn ? 'অফিসিয়াল সরকারি লিংক' : 'Official Government Portals'}</h2>
    <ul>
      <li>${isBn ? 'রেলওয়ে ই-টিকিট (আসন সংরক্ষিত নয়)' : 'Bangladesh Railway e-Ticket (Not reserved)'}: <a href="https://eticket.railway.gov.bd">eticket.railway.gov.bd</a></li>
      <li>${isBn ? 'ভাতা ও সামাজিক নিরাপত্তা' : 'Allowances & Social Protection'}: <a href="https://socialprotection.gov.bd">socialprotection.gov.bd</a></li>
      <li>${isBn ? 'অভিযোগ প্রতিকার ব্যবস্থা (GRS)' : 'Grievance Redress System (GRS)'}: <a href="https://www.grs.gov.bd">grs.gov.bd</a></li>
      <li>${isBn ? 'আয়কর ই-রিটার্ন (NBR)' : 'Income Tax e-Return (NBR)'}: <a href="https://www.etaxnbr.gov.bd">etaxnbr.gov.bd</a></li>
    </ul>
  </section>
  <section class="card">
    <h2>${isBn ? 'টেক্সট-ভিত্তিক সেবা নির্দেশিকা' : 'Text-Only Service Guides'}</h2>
    <ul>
      ${LITE_SERVICES.map(
        (s) =>
          `<li><a href="/lite/services/${s.slug}?lang=${locale}">${isBn ? s.titleBn : s.titleEn}</a> — ${isBn ? s.feeBn : s.feeEn}</li>`,
      ).join('')}
    </ul>
  </section>
  <p style="margin-top:16px;font-size:.85rem">
    <a href="/${locale}">${isBn ? '← পূর্ণ ওয়েব অ্যাপে যান' : '← Open full web app'}</a><br>
    ${isBn ? 'স্বাধীন প্ল্যাটফর্ম — এটি কোনো সরকারি সেবা নয়।' : 'Independent platform — not an official government service.'}
  </p>
</main>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Language': locale,
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}
