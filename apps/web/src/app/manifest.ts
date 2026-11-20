import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'জনসেবা AI (Jonoshheba AI)',
    short_name: 'জনসেবা AI',
    description: 'এক প্ল্যাটফর্ম, প্রতিটি নাগরিক, প্রতিটি জরুরি সেবা — Independent citizen service platform for Bangladesh.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#047857',
    lang: 'bn',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
