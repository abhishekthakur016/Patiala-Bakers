import { useState } from 'react';
import { assetUrl } from '../api/client.js';

// Illustrated fallback used when a product has no photo yet (or the photo fails to load),
// so the storefront never shows a broken image.
const PALETTE = {
  cakes: ['#F3E2C6', '#9B2A4A', '#F8E6CC'],
  'custom-cakes': ['#F1E4CC', '#6E1630', '#F3D9A4'],
  sweets: ['#F6EBDC', '#B07A1E', '#F3D59A'],
  snacks: ['#EFE1C8', '#0E8A78', '#E8C27A'],
  breads: ['#EEE3D2', '#5468B8', '#D9B27A'],
  biscuits: ['#F1E6D6', '#7A5A9E', '#E0BE85'],
};

function hue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function Illustration({ name = '', category = 'cakes' }) {
  const [bg, accent, cream] = PALETTE[category] || PALETTE.cakes;
  const h = hue(name);
  const top = `hsl(${h}, 55%, 72%)`;
  const isCake = category === 'cakes' || category === 'custom-cakes';
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label={name} className="h-full w-full">
      <defs>
        <radialGradient id={`g${h}`} cx="50%" cy="38%" r="75%"><stop offset="0" stopColor="#fff8ee" /><stop offset="1" stopColor={bg} /></radialGradient>
      </defs>
      <rect width="400" height="400" fill={`url(#g${h})`} />
      <ellipse cx="200" cy="300" rx="150" ry="26" fill={accent} opacity=".12" />
      {isCake ? (
        <g>
          <ellipse cx="200" cy="292" rx="130" ry="20" fill="#fff" stroke="#e7d7bf" strokeWidth="3" />
          <rect x="95" y="170" width="210" height="118" rx="14" fill={cream} />
          <rect x="95" y="214" width="210" height="14" fill={top} opacity=".85" />
          <ellipse cx="200" cy="170" rx="105" ry="22" fill={top} />
          {category === 'custom-cakes' && <><rect x="125" y="100" width="150" height="72" rx="12" fill={cream} /><ellipse cx="200" cy="100" rx="75" ry="16" fill={top} /></>}
          {[130, 165, 200, 235, 270].map((x) => <circle key={x} cx={x} cy={category === 'custom-cakes' ? 98 : 166} r="7" fill={accent} />)}
        </g>
      ) : category === 'sweets' ? (
        <g>{[[150, 230], [250, 230], [200, 190], [200, 262], [130, 275], [270, 275]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="38" fill={i % 2 ? top : cream} stroke={accent} strokeOpacity=".35" strokeWidth="3" />)}</g>
      ) : category === 'snacks' ? (
        <g>{[[150, 240, -12], [250, 240, 12], [200, 200, 0]].map(([x, y, r], i) => <path key={i} transform={`translate(${x} ${y}) rotate(${r})`} d="M0 -62 L58 40 Q0 58 -58 40 Z" fill={cream} stroke={accent} strokeOpacity=".4" strokeWidth="4" strokeLinejoin="round" />)}</g>
      ) : (
        <g>
          <rect x="105" y="170" width="190" height="110" rx="40" fill={cream} stroke={accent} strokeOpacity=".35" strokeWidth="4" />
          {[150, 200, 250].map((x) => <path key={x} d={`M${x - 18} 200 q18 -22 36 0`} stroke={accent} strokeOpacity=".5" strokeWidth="5" fill="none" strokeLinecap="round" />)}
        </g>
      )}
      <text x="200" y="360" textAnchor="middle" fontFamily="Cormorant Garamond, Georgia, serif" fontSize="26" fontWeight="700" fill={accent}>{name.length > 26 ? `${name.slice(0, 24)}…` : name}</text>
    </svg>
  );
}

export default function ProductImage({ src, alt, name, category, className, style }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={className} style={style}><Illustration name={name || alt || ''} category={category} /></div>;
  return <img src={assetUrl(src)} alt={alt || name || ''} className={className} style={style} loading="lazy" onError={() => setFailed(true)} />;
}
