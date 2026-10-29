import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CakeSlice, Clock, Egg, Leaf, MapPin, Sparkles, Star, WheatOff } from 'lucide-react';
import { api } from '../../api/client.js';
import ProductCard, { ProductCardSkeleton } from '../../components/ProductCard.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { t12 } from '../../utils/format.js';

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CAT_IMG = { cakes: '/images/rasmalai-cake.svg', 'custom-cakes': '/images/custom-cake.svg', sweets: '/images/ladoo.svg', snacks: '/images/samosa.svg' };
const QUOTES = [
  ['The rasmalai cake was the star of my mum’s 60th. Nobody believed it was eggless.', 'Harpreet K.', 'Birthday cake'],
  ['Ordered online, picked up exactly on time, and the samosas were still warm. Our office Friday tradition now.', 'Jack T.', 'Snacks & meals'],
  ['They turned a Pinterest photo into the most beautiful two-tier engagement cake. Quoted the same day.', 'Simran G.', 'Custom cake'],
];

export default function Home() {
  const { settings, categories } = useSettings();
  const [best, setBest] = useState(null);
  const [popular, setPopular] = useState(null);

  useEffect(() => {
    api.get('/products', { params: { category: 'cakes', limit: 4 } }).then(({ data }) => setBest(data.items)).catch(() => setBest([]));
    api.get('/products', { params: { bestseller: '1', limit: 8 } }).then(({ data }) => setPopular(data.items.filter((p) => p.category !== 'cakes').slice(0, 4))).catch(() => setPopular([]));
  }, []);

  const today = new Date().getDay();
  const s = settings;
  const p = s?.prepHours;

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="wrap grid items-center gap-12 pb-[72px] pt-16 [grid-template-columns:repeat(auto-fit,minmax(min(460px,100%),1fr))]">
          <div>
            <p className="eyebrow">Belmont · Geelong · Since 2016</p>
            <h1 className="mt-4">Celebration cakes, <em>eggless</em> by default.</h1>
            <p className="mt-6 max-w-[520px] text-lg text-ink-2">Punjabi-family recipes, desi ghee mithai and fresh-baked snacks. Order online, choose a pickup time, and we’ll have it boxed and ready.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop?category=cakes" className="btn btn-p btn-lg">Order a cake <ArrowRight size={18} /></Link>
              <Link to="/custom-cakes" className="btn btn-o btn-lg">Design a custom cake</Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5 text-[13.5px] font-semibold text-ink-2">
              {[[Egg, 'Eggless cakes'], [Leaf, 'Vegan options'], [WheatOff, 'Gluten-free upgrades'], [Clock, `${p?.cakes ?? 48}h notice`]].map(([I, t]) => (
                <span key={t} className="inline-flex items-center gap-2"><i className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gold-bg text-gold-d"><I size={13} /></i>{t}</span>
              ))}
            </div>
          </div>
          <div className="relative min-h-[380px] sm:min-h-[520px]">
            <div className="arch-ring" />
            <div className="arch"><img src="/images/rasmalai-cake.svg" alt="Rasmalai cake topped with pistachio and saffron" /></div>
            <div className="float bottom-[6%] left-[-2%]"><img src="/images/ladoo.svg" alt="Motichoor ladoo" /></div>
            <div className="float right-[-2%] top-[10%] !w-[34%]"><img src="/images/samosa.svg" alt="Punjabi samosas with chutney" /></div>
            <div className="stamp"><b>100%</b><span>Eggless cakes</span></div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-[84px]">
        <div className="wrap">
          <div className="mb-8 flex flex-wrap items-end gap-5">
            <div className="flex-1"><p className="eyebrow">The menu</p><h2 className="sec-title">Something for every table</h2></div>
            <Link to="/shop" className="btn btn-o">See the full menu <ArrowRight size={16} /></Link>
          </div>
          <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr))]">
            {categories.filter((c) => !['breads', 'biscuits'].includes(c.id)).concat([{ id: 'breads', name: 'Breads & Biscuits', blurb: 'Loaves, nankhatai and chai biscuits' }]).map((c) => (
              <Link key={c.id} to={c.id === 'custom-cakes' ? '/custom-cakes' : `/shop?category=${c.id}`} className="catcard">
                <div className="aspect-[4/3] overflow-hidden"><ProductImage src={CAT_IMG[c.id]} name={c.name} category={c.id} className="h-full w-full object-cover" /></div>
                <div className="flex items-center gap-3 px-5 pb-5 pt-[18px]">
                  <div className="flex-1"><h3 className="font-serif text-[26px] text-wine-ink">{c.name}</h3><p className="text-[13.5px] muted">{c.blurb}</p></div>
                  <span className="arrow"><ArrowRight size={18} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured cakes */}
      <section className="pb-[84px]">
        <div className="wrap">
          <div className="mb-8 flex flex-wrap items-end gap-5">
            <div className="flex-1"><p className="eyebrow">Bestselling cakes</p><h2 className="sec-title">Baked to order, eggless every time</h2></div>
            <Link to="/shop?category=cakes" className="btn btn-o">All cakes <ArrowRight size={16} /></Link>
          </div>
          <div className="pgrid">{best ? best.map((x) => <ProductCard key={x._id} p={x} />) : Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
        </div>
      </section>

      {/* Dietary band */}
      <section className="band">
        <div className="wrap relative grid items-center gap-10 py-[72px] [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
          <div>
            <p className="eyebrow !text-[#EED39A]">Dietary friendly</p>
            <h2 className="mt-3 text-[clamp(38px,4.6vw,60px)] leading-none text-[#FFF4E6]">Everyone gets <em className="text-[#EED39A]">a slice.</em></h2>
            <p className="mt-[18px] max-w-[520px] text-[17px] text-[#EBD6C2]">Our cakes are made without eggs. Where a vegan or gluten-free version is possible, you’ll see it as an option on the product page — with the allergens listed, so you always know what’s inside.</p>
            <Link to="/shop?vegan=1" className="btn btn-gold btn-lg mt-7">Shop dietary options</Link>
          </div>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
            <div className="pt"><b>Eggless</b><span className="text-sm text-[#EAD8C6]">Every cake on the menu, at no extra cost.</span></div>
            <div className="pt"><b>Vegan</b><span className="text-sm text-[#EAD8C6]">Dairy-free sponge and cream on selected cakes.</span></div>
            <div className="pt"><b>Gluten-free</b><span className="text-sm text-[#EAD8C6]">GF sponge upgrade where listed. Kitchen handles wheat.</span></div>
            <div className="pt"><b>Allergens listed</b><span className="text-sm text-[#EAD8C6]">Every product shows its allergen information.</span></div>
          </div>
        </div>
      </section>

      {/* Custom cakes */}
      <section className="py-[84px]">
        <div className="wrap grid items-center gap-14 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
          <div className="relative aspect-[5/4] overflow-hidden rounded-3xl shadow-2">
            <img src="/images/custom-cake.svg" alt="Custom celebration cake with gold leaf and florals" className="h-full w-full object-cover" />
            <div className="absolute bottom-[18px] left-[18px] rounded-[14px] bg-paper/95 px-4 py-3 shadow-1"><p className="eyebrow">Custom cakes</p><b>Quotes within 24 hours</b></div>
          </div>
          <div>
            <p className="eyebrow">Weddings · Engagements · Birthdays</p>
            <h2 className="sec-title">Your idea, our bakers</h2>
            <div className="my-7 flex flex-col gap-[18px]">
              {[['Tell us the occasion', 'Servings, date, colours and any reference photos.'], ['Get a quote', 'We reply with an itemised quote, usually the same day.'], [`Confirm with a ${s?.payments?.depositPercent ?? 50}% deposit`, `Custom designs need at least ${Math.round((p?.['custom-cakes'] ?? 120) / 24)} days notice.`]].map(([h, t], i) => (
                <div key={h} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-[1.5px] border-gold font-serif text-xl font-bold text-wine">{i + 1}</span>
                  <div><h4 className="text-base font-extrabold">{h}</h4><p className="muted">{t}</p></div>
                </div>
              ))}
            </div>
            <Link to="/custom-cakes" className="btn btn-p btn-lg"><Sparkles size={18} /> Start a custom cake enquiry</Link>
          </div>
        </div>
      </section>

      {/* Popular non-cake */}
      <section className="pb-[84px]">
        <div className="wrap">
          <div className="mb-8 flex flex-wrap items-end gap-5">
            <div className="flex-1"><p className="eyebrow">Popular right now</p><h2 className="sec-title">Mithai, samosas & more</h2></div>
            <Link to="/shop" className="btn btn-o">Full menu <ArrowRight size={16} /></Link>
          </div>
          <div className="pgrid">{popular ? popular.map((x) => <ProductCard key={x._id} p={x} />) : Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
        </div>
      </section>

      {/* Info + testimonials */}
      <section className="bg-cream-2/60 py-[84px]">
        <div className="wrap">
          <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
            {[[CakeSlice, 'Baked to order', 'Cakes are baked for your pickup day, never frozen ahead.'], [Clock, 'Choose your pickup slot', 'Pick a date and time at checkout. Full slots are hidden automatically.'], [MapPin, 'Pickup in Belmont', settings?.business?.address || '']].map(([I, h, t]) => (
              <div key={h} className="icard"><div className="ico"><I size={22} /></div><h3 className="mb-1.5 text-[19px] font-extrabold">{h}</h3><p className="text-[14.5px] text-ink-2">{t}</p></div>
            ))}
          </div>
          {/* QUOTES are sample testimonials from the design preview — replace with genuine customer reviews before launch */}
          <div className="mt-16 mb-8 flex flex-wrap items-end gap-4"><div className="flex-1"><p className="eyebrow">Kind words</p><h2 className="sec-title">Loved across Geelong</h2></div><span className="tag">Sample reviews</span></div>
          <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
            {QUOTES.map(([q, n, t]) => (
              <figure key={n} className="icard flex flex-col gap-4">
                <div className="flex gap-0.5 text-gold" aria-label="5 out of 5 stars">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={15} fill="currentColor" />)}</div>
                <blockquote className="font-serif text-[23px] leading-tight text-wine-ink">“{q}”</blockquote>
                <figcaption className="text-sm"><b>{n}</b> <span className="muted">· {t}</span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Location & hours */}
      <section className="py-[84px]">
        <div className="wrap grid gap-[22px] [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
          <div className="relative min-h-[360px] overflow-hidden rounded-[20px] border border-line-2 bg-[#EFE6D6]" aria-hidden="true">
            <div className="absolute left-0 right-0 top-[40%] h-6 bg-cream" /><div className="absolute bottom-0 top-0 left-[48%] w-5 bg-cream" />
            <div className="absolute left-[8%] top-[18%] h-16 w-28 rounded-lg bg-[#E4D8C3]" /><div className="absolute bottom-[12%] right-[10%] h-20 w-32 rounded-lg bg-[#E4D8C3]" />
            <div className="absolute left-[52%] top-[44%] flex -translate-x-1/2 -translate-y-full flex-col items-center"><span className="whitespace-nowrap rounded-xl bg-wine px-3 py-2 text-[13px] font-extrabold text-white shadow-2">Patiala Bakers</span><span className="-mt-2 h-3.5 w-3.5 rotate-45 bg-wine" /></div>
            <span className="absolute left-[6%] top-[33%] text-[11px] font-bold uppercase tracking-widest text-[#9A8A7C]">High St</span>
          </div>
          <div className="card card-b">
            <p className="eyebrow">Visit us</p>
            <h2 className="sec-title">Pickup from Belmont</h2>
            <p className="mt-2 text-ink-2">{settings?.business?.address}</p>
            <div className="mt-6 flex flex-col">
              {settings?.hours?.map((h, i) => (
                <div key={i} className={`flex justify-between border-b border-dashed border-line py-2.5 text-[14.5px] ${i === today ? 'font-extrabold text-wine' : ''}`}>
                  <span>{WD[i]}{i === today ? ' (today)' : ''}</span><span>{h.closed ? 'Closed' : `${t12(h.open)} – ${t12(h.close)}`}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3"><Link to="/contact" className="btn btn-p">Contact & directions</Link><a className="btn btn-o" href={`tel:${settings?.business?.phone?.replace(/\s/g, '')}`}>Call {settings?.business?.phone}</a></div>
          </div>
        </div>
      </section>
    </>
  );
}
