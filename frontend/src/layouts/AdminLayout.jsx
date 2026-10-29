import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Bot, CakeSlice, CalendarDays, ChefHat, ClipboardList, ExternalLink, LayoutDashboard, LogOut, Package, Settings, Tags, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { PageLoader } from '../components/ui.jsx';

export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList, perm: 'orders' },
  { to: '/admin/production', label: 'Production', icon: ChefHat, perm: 'production' },
  { to: '/admin/calendar', label: 'Pickup Calendar', icon: CalendarDays, perm: 'calendar' },
  { to: '/admin/products', label: 'Products & Inventory', icon: Package, perm: 'products' },
  { to: '/admin/pricing', label: 'Bulk Pricing', icon: Tags, perm: 'pricing' },
  { to: '/admin/enquiries', label: 'Custom Cake Enquiries', icon: CakeSlice, perm: 'enquiries', badge: 'enq' },
  { to: '/admin/customers', label: 'Customers', icon: Users, perm: 'customers' },
  { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3, perm: 'reports' },
  { to: '/admin/assistant', label: 'AI Assistant', icon: Bot, perm: 'ai' },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, can, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [newEnq, setNewEnq] = useState(0);
  useEffect(() => {
    if (!can('enquiries')) return;
    api.get('/admin/enquiries', { params: { status: 'New' } }).then(({ data }) => setNewEnq(data.counts?.New || 0)).catch(() => {});
  }, [loc.pathname, can]);
  const current = ADMIN_NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));
  useEffect(() => { document.title = `${current?.label || 'Admin'} · Patiala Bakers Admin`; }, [current]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F0E7] lg:flex-row">
      <aside className="side no-print flex flex-col p-3 lg:sticky lg:top-0 lg:h-screen lg:w-[252px] lg:flex-none lg:overflow-y-auto lg:px-3.5 lg:py-[22px]">
        <Link to="/admin" className="mb-2 flex items-center gap-3 px-2.5 pb-2 no-underline lg:mb-3.5 lg:border-b lg:border-[rgba(241,227,207,.12)] lg:pb-[22px]">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3D9A4] font-serif text-[19px] font-bold text-wine-d">PB</span>
          <span><b className="block font-serif text-[22px] leading-none text-[#FFF4E6]">Patiala Bakers</b><span className="text-[11px] font-bold uppercase tracking-[.14em] text-[#D9BE8C]">Bakery admin</span></span>
        </Link>
        <nav className="flex gap-0.5 overflow-x-auto pb-1.5 lg:flex-col lg:overflow-visible" aria-label="Admin">
          {ADMIN_NAV.filter((n) => !n.perm || can(n.perm)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `sl ${isActive ? 'active' : ''}`}>
              <n.icon size={19} className="flex-none" aria-hidden="true" /><span className="min-w-0 truncate">{n.label}</span>
              {n.badge === 'enq' && newEnq > 0 && <span className="bdg" aria-label={`${newEnq} new`}>{newEnq}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden flex-col gap-2.5 border-t border-[rgba(241,227,207,.12)] px-2.5 pt-4 text-xs text-[#CDB59C] lg:flex">
          <Link to="/" className="flex items-center gap-2 text-[#E9D7C2] no-underline hover:text-white" target="_blank"><ExternalLink size={14} /> View website</Link>
          <span>Signed in as <b className="text-[#FFF4E6]">{user.name}</b> · {user.staffRole}</span>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex flex-wrap items-center gap-3.5 border-b border-line-2 bg-paper/85 px-4 py-4 lg:px-8">
          <h1 className="flex-1 font-sans text-[22px] font-extrabold tracking-tight">{current?.label || 'Admin'}</h1>
          <Link to="/" className="btn btn-o btn-sm lg:hidden" target="_blank"><ExternalLink size={14} /> Site</Link>
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gold-bg text-[13px] font-extrabold text-gold-d" title={user.name}>{(user.name.match(/\b[A-Za-z]/g) || ['?']).join('').slice(0, 2).toUpperCase()}</span>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); nav('/login'); }}><LogOut size={15} /> Sign out</button>
        </header>
        <main className="flex flex-col gap-[22px] px-4 pb-16 pt-6 lg:px-8"><Suspense fallback={<PageLoader />}><Outlet /></Suspense></main>
      </div>
    </div>
  );
}
