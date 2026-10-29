import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Mail, MapPin, Menu, Phone, ShoppingBag, User, X } from 'lucide-react';
import { Logo } from '../components/ui.jsx';
import CartDrawer from '../components/CartDrawer.jsx';
import ChatWidget from '../components/ChatWidget.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { t12 } from '../utils/format.js';

const NAV = [
  ['/', 'Home', true], ['/shop?category=cakes', 'Cakes'], ['/custom-cakes', 'Custom cakes'], ['/shop?category=sweets', 'Indian sweets'],
  ['/shop?category=snacks', 'Snacks & meals'], ['/shop', 'Full menu', true], ['/contact', 'Visit us'],
];
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function NavItem({ to, label, end, onClick }) {
  const loc = useLocation();
  const [path, qs] = to.split('?');
  const active = qs ? loc.pathname === path && loc.search.includes(qs) : end ? loc.pathname === path && (path !== '/shop' || !loc.search.includes('category=')) : loc.pathname.startsWith(path);
  return <NavLink to={to} onClick={onClick} className={() => `nl ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>{label}</NavLink>;
}

export default function SiteLayout() {
  const { count, setOpen } = useCart();
  const { user, isStaff } = useAuth();
  const { settings } = useSettings();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const b = settings?.business;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-white focus:p-2">Skip to content</a>
      {b?.announcement && <div className="ann">{b.announcement}</div>}
      <header className="hdr">
        <div className="wrap flex min-h-[76px] items-center gap-5">
          <Link to="/" className="no-underline" aria-label="Patiala Bakers home"><Logo /></Link>
          <nav className="hidden flex-1 flex-wrap justify-center gap-0.5 xl:flex" aria-label="Main">{NAV.map(([to, l, e]) => <NavItem key={to} to={to} label={l} end={e} />)}</nav>
          <span className="flex-1 xl:hidden" />
          {isStaff && <Link to="/admin" className="btn btn-o btn-sm hidden sm:inline-flex"><LayoutDashboard size={16} /> Admin</Link>}
          <Link to={user ? '/account' : '/login'} className="iconbtn" aria-label={user ? 'My account' : 'Sign in'}><User size={21} /></Link>
          <button className="iconbtn" onClick={() => setOpen(true)} aria-label={`Open cart, ${count} items`}>
            <ShoppingBag size={21} />
            {count > 0 && <span className="absolute right-0.5 top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-gold px-1 text-[11px] font-extrabold text-[#2A1606]">{count}</span>}
          </button>
          <button className="iconbtn xl:hidden" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu">{menu ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        {menu && <nav className="flex flex-col border-t border-line-2 bg-cream px-5 pb-4 pt-2 xl:hidden" aria-label="Mobile">{NAV.map(([to, l, e]) => <NavItem key={to} to={to} label={l} end={e} />)}<NavItem to="/track" label="Track an order" /></nav>}
      </header>

      <main id="main" className="flex-1"><Outlet /></main>

      <footer className="bg-wine-d pb-7 pt-16 text-[#E9D7C6]">
        <div className="wrap grid gap-9 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm text-[#D9C4B2]">{b?.tagline || 'Eggless celebration cakes, Indian sweets and Punjabi snacks, baked fresh in Belmont.'}</p>
          </div>
          <div>
            <h4 className="mb-3.5 text-xs font-extrabold uppercase tracking-[.18em] text-[#E6C27A]">Shop</h4>
            <ul className="space-y-1.5 text-sm">{[['/shop?category=cakes', 'Cakes'], ['/custom-cakes', 'Custom cakes'], ['/shop?category=sweets', 'Indian sweets'], ['/shop?category=snacks', 'Snacks & meals'], ['/shop?category=breads', 'Breads'], ['/shop?category=biscuits', 'Biscuits']].map(([to, l]) => <li key={to}><Link className="text-[#E9D7C6] no-underline hover:text-white" to={to}>{l}</Link></li>)}</ul>
          </div>
          <div>
            <h4 className="mb-3.5 text-xs font-extrabold uppercase tracking-[.18em] text-[#E6C27A]">Visit</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><MapPin size={16} className="mt-0.5 flex-none" />{b?.address}</li>
              <li><a className="flex gap-2 text-[#E9D7C6] no-underline hover:text-white" href={`tel:${b?.phone?.replace(/\s/g, '')}`}><Phone size={16} />{b?.phone}</a></li>
              <li><a className="flex gap-2 text-[#E9D7C6] no-underline hover:text-white" href={`mailto:${b?.email}`}><Mail size={16} />{b?.email}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3.5 text-xs font-extrabold uppercase tracking-[.18em] text-[#E6C27A]">Pickup hours</h4>
            <ul className="space-y-1 text-sm">{settings?.hours?.map((h, i) => ({ h, i })).slice(1).concat(settings?.hours ? [{ h: settings.hours[0], i: 0 }] : []).map(({ h, i }) => <li key={i} className="flex justify-between gap-4"><span>{WD[i].slice(0, 3)}</span><span>{h.closed ? 'Closed' : `${t12(h.open)} – ${t12(h.close)}`}</span></li>)}</ul>
          </div>
        </div>
        <div className="wrap mt-11 flex flex-wrap justify-between gap-3 border-t border-[rgba(233,215,198,.16)] pt-5 text-[12.5px] text-[#C9B4A2]">
          <span>© {new Date().getFullYear()} {b?.name || 'Patiala Bakers'}{b?.abn ? ` · ABN ${b.abn}` : ''}</span>
          <span className="flex gap-4"><Link className="text-[#C9B4A2]" to="/track">Track an order</Link><Link className="text-[#C9B4A2]" to="/contact">Contact</Link><Link className="text-[#C9B4A2]" to="/login">Staff sign in</Link></span>
        </div>
      </footer>
      <CartDrawer />
      <ChatWidget />
    </div>
  );
}
