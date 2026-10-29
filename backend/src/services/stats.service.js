import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Enquiry } from '../models/Enquiry.js';
import { addDays, dateRange, nowParts } from '../utils/time.js';
import { r2 } from '../utils/http.js';

const LIVE = { status: { $ne: 'Cancelled' } };

// Revenue is attributed to the pickup date (when the order is fulfilled)
export async function revenueSeries(from, to) {
  const rows = await Order.aggregate([
    { $match: { ...LIVE, pickupDate: { $gte: from, $lte: to } } },
    { $group: { _id: '$pickupDate', revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
  ]);
  const map = new Map(rows.map((r) => [r._id, r]));
  return dateRange(from, to).map((d) => ({ date: d, revenue: r2(map.get(d)?.revenue || 0), orders: map.get(d)?.orders || 0 }));
}

export async function totals(from, to) {
  const [r] = await Order.aggregate([
    { $match: { ...LIVE, pickupDate: { $gte: from, $lte: to } } },
    { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 }, paid: { $sum: '$amountPaid' } } },
  ]);
  const revenue = r2(r?.revenue || 0);
  const orders = r?.orders || 0;
  return { revenue, orders, avgOrder: orders ? r2(revenue / orders) : 0, collected: r2(r?.paid || 0) };
}

export async function bestsellers(from, to, limit = 8) {
  return Order.aggregate([
    { $match: { ...LIVE, pickupDate: { $gte: from, $lte: to } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.name', product: { $first: '$items.product' }, image: { $first: '$items.image' }, category: { $first: '$items.category' }, qty: { $sum: '$items.qty' }, revenue: { $sum: '$items.lineTotal' } } },
    { $sort: { revenue: -1 } },
    { $limit: limit },
    { $project: { _id: 0, name: '$_id', product: 1, image: 1, category: 1, qty: 1, revenue: { $round: ['$revenue', 2] } } },
  ]);
}

export async function categoryMix(from, to) {
  return Order.aggregate([
    { $match: { ...LIVE, pickupDate: { $gte: from, $lte: to } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.category', revenue: { $sum: '$items.lineTotal' }, qty: { $sum: '$items.qty' } } },
    { $sort: { revenue: -1 } },
    { $project: { _id: 0, category: '$_id', revenue: { $round: ['$revenue', 2] }, qty: 1 } },
  ]);
}

export async function paymentMix(from, to) {
  return Order.aggregate([
    { $match: { ...LIVE, pickupDate: { $gte: from, $lte: to } } },
    { $group: { _id: '$paymentStatus', count: { $sum: 1 }, total: { $sum: '$total' } } },
    { $project: { _id: 0, status: '$_id', count: 1, total: { $round: ['$total', 2] } } },
  ]);
}

export async function outstanding() {
  const list = await Order.find({ status: { $nin: ['Cancelled', 'Collected'] }, paymentStatus: { $in: ['Unpaid', 'Deposit paid'] } })
    .select('orderNumber customer pickupDate pickupTime total amountPaid paymentStatus status').sort({ pickupDate: 1, pickupTime: 1 });
  const due = r2(list.reduce((s, o) => s + Math.max(0, o.total - o.amountPaid), 0));
  return { count: list.length, due, list };
}

export function rangeFor(range, tz) {
  const today = nowParts(tz).date;
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[range] || 30;
  const to = today;
  const from = addDays(today, -(days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { from, to, prevFrom, prevTo, today };
}

export async function dashboard(tz) {
  const today = nowParts(tz).date;
  const tomorrow = addDays(today, 1);
  const { from, to, prevFrom, prevTo } = rangeFor('7d', tz);
  const [cur, prev, todays, tomorrows, recent, lowStock, newEnq, pending, out, best, upcoming] = await Promise.all([
    totals(from, to),
    totals(prevFrom, prevTo),
    Order.find({ pickupDate: today, ...LIVE }).sort({ pickupTime: 1 }),
    Order.find({ pickupDate: tomorrow, ...LIVE }).sort({ pickupTime: 1 }),
    Order.find().sort({ createdAt: -1 }).limit(8),
    Product.find({ archived: false, $or: [{ stockStatus: { $in: ['Low stock', 'Sold out'] } }, { available: false }] }).select('name category stockStatus stockQty available images'),
    Enquiry.find({ status: 'New' }).sort({ createdAt: -1 }).limit(5),
    Order.countDocuments({ status: { $in: ['Pending', 'Confirmed'] }, pickupDate: { $gte: today } }),
    outstanding(),
    bestsellers(addDays(today, -29), today, 5),
    Order.countDocuments({ ...LIVE, status: { $nin: ['Collected', 'Cancelled'] }, pickupDate: { $gte: today, $lte: addDays(today, 6) } }),
  ]);
  const production = await Order.find({ pickupDate: { $in: [today, tomorrow] }, status: { $in: ['Confirmed', 'In Production'] } }).sort({ pickupDate: 1, pickupTime: 1 });
  const totalOrders = await Order.countDocuments(LIVE);
  return {
    today, tomorrow,
    kpis: {
      revenue7d: cur.revenue, revenuePrev7d: prev.revenue, orders7d: cur.orders, ordersPrev7d: prev.orders,
      totalOrders, pendingOrders: pending, upcomingPickups: upcoming, outstandingAmount: out.due, outstandingCount: out.count,
      avgOrder7d: cur.avgOrder,
    },
    todayPickups: todays, tomorrowPickups: tomorrows, production, recentOrders: recent, lowStock, newEnquiries: newEnq, bestsellers: best,
  };
}
