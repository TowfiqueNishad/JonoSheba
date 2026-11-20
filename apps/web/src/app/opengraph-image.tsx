import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'জনসেবা AI — Jonoshheba AI';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '64px',
          background: 'linear-gradient(135deg, #065f46 0%, #022c22 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, color: '#a7f3d0' }}>
          Independent Citizen-Service Platform for Bangladesh
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, marginTop: 18 }}>
          Jonoshheba AI · জনসেবা AI
        </div>
        <div style={{ fontSize: 30, marginTop: 22, color: '#ecfdf5' }}>
          Verified public services, railways, allowances & 999 emergency hub.
        </div>
      </div>
    ),
    { ...size },
  );
}
