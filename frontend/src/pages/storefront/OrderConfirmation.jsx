import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Check, Printer } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import OrderView from '../../components/OrderView.jsx';
import { ErrorState, PageLoader } from '../../components/ui.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';

export default function OrderConfirmation() {
  const { orderNumber } = useParams();
  const [params] = useSearchParams();
  const { settings } = useSettings();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let token = params.get('token') || '';
    try { token = token || sessionStorage.getItem(`pb-order-${orderNumber}`) || ''; } catch { /* ignore */ }
    api.get(`/orders/${orderNumber}/confirmation`, { params: { token: token || undefined, session_id: params.get('session_id') || undefined } })
      .then(({ data }) => setOrder(data.order)).catch((e) => setError(apiError(e).message));
  }, [orderNumber, params]);

  if (error) return <div className="wrap py-16"><ErrorState message={error} /><div className="mt-6 text-center"><Link to="/track" className="btn btn-p">Track an order</Link></div></div>;
  if (!order) return <PageLoader />;

  return (
    <div className="wrap max-w-3xl py-12">
      <div className="py-6 text-center">
        <div className="mx-auto mb-4 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-ok-bg text-ok"><Check size={40} strokeWidth={2.5} /></div>
        <h1 className="text-[44px] text-wine-ink">{order.status === 'Pending' ? 'Order received' : 'Thank you!'}</h1>
        <p className="mt-2 text-ink-2">Your order number is</p>
        <span className="ordno mt-3">{order.orderNumber}</span>
        <p className="mt-4 muted">We’ve sent a confirmation to <b>{order.customer.email}</b>. Keep your order number handy for pickup.</p>
      </div>
      <div className="card card-b mt-4"><OrderView order={order} address={settings?.business?.address} /></div>
      <div className="no-print mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/shop" className="btn btn-p">Keep shopping</Link>
        <button className="btn btn-o" onClick={() => window.print()}><Printer size={16} /> Print</button>
      </div>
    </div>
  );
}
