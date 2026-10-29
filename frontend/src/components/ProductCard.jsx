import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ProductImage from './ProductImage.jsx';
import { money } from '../utils/format.js';
import { useCategoryName } from '../context/SettingsContext.jsx';

export function dietLabels(p) {
  const out = [];
  if (p.dietary?.eggless) out.push('Eggless');
  if (p.dietary?.vegan) out.push('Vegan');
  else if (p.upgrades?.vegan) out.push('Vegan option');
  if (p.dietary?.glutenFree) out.push('Gluten-free');
  else if (p.upgrades?.glutenFree) out.push('GF option');
  if (p.dietary?.nutFree) out.push('Nut-free');
  return out;
}

export default function ProductCard({ p }) {
  const catName = useCategoryName();
  const orderable = p.orderable ?? (p.available && !['Sold out', 'Unavailable'].includes(p.stockStatus));
  const diet = dietLabels(p);
  const to = `/product/${p.slug}`;
  return (
    <article className="pcard">
      <Link to={to} className="im" aria-label={p.name}>
        <ProductImage src={p.images?.[0]?.url} alt={p.images?.[0]?.alt || p.name} name={p.name} category={p.category} className="h-full w-full" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {p.bestseller && <span className="pill-best">Bestseller</span>}
          {p.stockStatus === 'Low stock' && orderable && <span className="pill-low">Only a few left</span>}
        </div>
        {!orderable && <div className="soldout"><span>{p.stockStatus === 'Sold out' ? 'Sold out' : 'Currently unavailable'}</span></div>}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 px-[18px] pb-[18px] pt-4">
        <div className="text-[11.5px] font-bold uppercase tracking-[.12em] text-gold-d">{catName(p.category)}</div>
        <h3 className="font-serif text-2xl leading-tight text-wine-ink"><Link to={to} className="text-inherit no-underline hover:text-wine">{p.name}</Link></h3>
        <p className="line-clamp-2 text-[13.5px] text-ink-2">{p.description}</p>
        {diet.length > 0 && <p className="text-xs font-bold text-ok">{diet.join(' · ')}</p>}
        <div className="mt-auto flex items-center gap-2.5 pt-3">
          <span className="text-[15px] font-extrabold num"><small className="mr-1 text-xs font-semibold text-mute">{p.variants?.length > 1 ? 'from' : ''}</small>{money(p.fromPrice ?? Math.min(...p.variants.map((v) => v.price)))}</span>
          <span className="flex-1" />
          <Link to={to} className={orderable ? 'btn btn-p btn-sm' : 'btn btn-o btn-sm'}>{orderable ? (p.customisable ? 'Customise' : 'Choose') : 'View'} <ArrowRight size={15} /></Link>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="pcard" aria-hidden="true">
      <div className="skel aspect-square rounded-none" />
      <div className="flex flex-col gap-2 p-4"><div className="skel h-3 w-20" /><div className="skel h-6 w-3/4" /><div className="skel h-10 w-full" /><div className="skel h-9 w-full" /></div>
    </div>
  );
}
