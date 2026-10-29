import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import SiteLayout from './layouts/SiteLayout.jsx';
import { RequireAuth, RequireStaff } from './routes/guards.jsx';
import { PageLoader } from './components/ui.jsx';
import Home from './pages/storefront/Home.jsx';
import Shop from './pages/storefront/Shop.jsx';
import ProductDetail from './pages/storefront/ProductDetail.jsx';

const Checkout = lazy(() => import('./pages/storefront/Checkout.jsx'));
const OrderConfirmation = lazy(() => import('./pages/storefront/OrderConfirmation.jsx'));
const CustomCakes = lazy(() => import('./pages/storefront/CustomCakes.jsx'));
const Contact = lazy(() => import('./pages/storefront/Contact.jsx'));
const TrackOrder = lazy(() => import('./pages/storefront/TrackOrder.jsx'));
const Login = lazy(() => import('./pages/auth/Login.jsx'));
const Register = lazy(() => import('./pages/auth/Register.jsx'));
const Account = lazy(() => import('./pages/storefront/Account.jsx'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout.jsx'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const Orders = lazy(() => import('./pages/admin/Orders.jsx'));
const Production = lazy(() => import('./pages/admin/Production.jsx'));
const PickupCalendar = lazy(() => import('./pages/admin/PickupCalendar.jsx'));
const Products = lazy(() => import('./pages/admin/Products.jsx'));
const Pricing = lazy(() => import('./pages/admin/Pricing.jsx'));
const Enquiries = lazy(() => import('./pages/admin/Enquiries.jsx'));
const Customers = lazy(() => import('./pages/admin/Customers.jsx'));
const Reports = lazy(() => import('./pages/admin/Reports.jsx'));
const Assistant = lazy(() => import('./pages/admin/Assistant.jsx'));
const Settings = lazy(() => import('./pages/admin/Settings.jsx'));

function NotFound() {
  return (
    <div className="wrap py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-serif text-5xl text-wine-ink">We couldn’t find that page</h1>
      <p className="mt-3 muted">It may have moved, or the link might be mistyped.</p>
      <Link to="/" className="btn btn-p mt-6">Back to home</Link>
    </div>
  );
}

const S = (el) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;
const A = (perm, el) => <RequireStaff perm={perm}>{S(el)}</RequireStaff>;

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="product/:slug" element={<ProductDetail />} />
        <Route path="checkout" element={S(<Checkout />)} />
        <Route path="order/:orderNumber" element={S(<OrderConfirmation />)} />
        <Route path="custom-cakes" element={S(<CustomCakes />)} />
        <Route path="contact" element={S(<Contact />)} />
        <Route path="track" element={S(<TrackOrder />)} />
        <Route path="login" element={S(<Login />)} />
        <Route path="register" element={S(<Register />)} />
        <Route path="account/*" element={<RequireAuth>{S(<Account />)}</RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="admin" element={<RequireStaff>{S(<AdminLayout />)}</RequireStaff>}>
        <Route index element={S(<Dashboard />)} />
        <Route path="orders" element={A('orders', <Orders />)} />
        <Route path="production" element={A('production', <Production />)} />
        <Route path="calendar" element={A('calendar', <PickupCalendar />)} />
        <Route path="products" element={A('products', <Products />)} />
        <Route path="pricing" element={A('pricing', <Pricing />)} />
        <Route path="enquiries" element={A('enquiries', <Enquiries />)} />
        <Route path="customers" element={A('customers', <Customers />)} />
        <Route path="reports" element={A('reports', <Reports />)} />
        <Route path="assistant" element={A('ai', <Assistant />)} />
        <Route path="settings" element={S(<Settings />)} />
      </Route>
    </Routes>
  );
}
