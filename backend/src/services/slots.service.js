import { Order } from '../models/Order.js';
import { SlotBooking } from '../models/misc.js';
import { badRequest, conflict } from '../utils/http.js';
import { addDays, fromMinutes, isDateStr, isTimeStr, localStamp, nowParts, toMinutes, weekday } from '../utils/time.js';

export function slotTimesFor(date, settings) {
  const day = settings.hours[weekday(date)];
  if (!day || day.closed) return [];
  const step = settings.slotMinutes || 60;
  const start = toMinutes(day.open);
  const last = toMinutes(day.close) - (settings.lastSlotBeforeCloseMinutes ?? step);
  const out = [];
  for (let m = start; m <= last; m += step) out.push(fromMinutes(m));
  return out;
}

export function isDateBlocked(date, settings) {
  return settings.blockedDates.find((b) => b.date === date) || null;
}

const ACTIVE = { $nin: ['Cancelled'] };

export async function bookedCounts(date) {
  const rows = await Order.aggregate([
    { $match: { pickupDate: date, status: ACTIVE } },
    { $group: { _id: '$pickupTime', n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

/** Returns slot availability for a date, taking lead time into account. */
export async function slotsForDate(date, settings, leadHours = 0) {
  const tz = settings.timezone;
  const now = nowParts(tz);
  const nowStamp = localStamp(now.date, now.time);
  const blocked = isDateBlocked(date, settings);
  const times = slotTimesFor(date, settings);
  const booked = await bookedCounts(date);
  const cap = settings.slotCapacity;
  return times.map((time) => {
    const n = booked[time] || 0;
    const slotBlock = settings.blockedSlots.find((b) => b.date === date && b.time === time);
    let reason = '';
    if (blocked) reason = blocked.reason || 'Closed';
    else if (slotBlock) reason = slotBlock.reason || 'Unavailable';
    else if (localStamp(date, time) - nowStamp < leadHours * 60) reason = 'Not enough notice';
    else if (n >= cap) reason = 'Full';
    return { time, capacity: cap, booked: n, remaining: Math.max(0, cap - n), available: !reason, reason };
  });
}

/** Summary of the next N days for the checkout date picker. */
export async function availableDates(settings, leadHours = 0, days = 21) {
  const today = nowParts(settings.timezone).date;
  const out = [];
  for (let i = 0; i < Math.min(days, settings.maxAdvanceDays); i++) {
    const date = addDays(today, i);
    const slots = await slotsForDate(date, settings, leadHours);
    const open = slots.filter((s) => s.available).length;
    const day = settings.hours[weekday(date)];
    let reason = '';
    if (!day || day.closed) reason = 'Closed';
    else if (isDateBlocked(date, settings)) reason = isDateBlocked(date, settings).reason || 'Closed';
    else if (!open) reason = slots.some((s) => s.reason === 'Full') ? 'Fully booked' : 'Too soon';
    out.push({ date, openSlots: open, available: open > 0, reason });
  }
  return out;
}

export async function assertPickupValid(date, time, settings, leadHours) {
  if (!isDateStr(date) || !isTimeStr(time)) throw badRequest('Please choose a valid pickup date and time.');
  const today = nowParts(settings.timezone).date;
  if (date < today) throw badRequest('Pickup date is in the past.');
  if (date > addDays(today, settings.maxAdvanceDays)) throw badRequest(`Orders can be placed up to ${settings.maxAdvanceDays} days ahead.`);
  const slots = await slotsForDate(date, settings, leadHours);
  const slot = slots.find((s) => s.time === time);
  if (!slot) throw badRequest('The bakery is not open for pickup at that time.');
  if (!slot.available) {
    const msg = {
      'Not enough notice': `Your order needs at least ${leadHours} hours notice. Please choose a later pickup time.`,
      Full: 'That pickup slot has just filled up. Please choose another time.',
    }[slot.reason] || `That pickup time is unavailable (${slot.reason}).`;
    throw conflict(msg, { field: 'pickup' });
  }
  return slot;
}

/** Atomically reserves one unit of capacity in a slot. Returns false when the slot is full. */
export async function reserveSlot(date, time, capacity) {
  await syncSlot(date, time);
  try {
    await SlotBooking.findOneAndUpdate({ date, time, count: { $lt: capacity } }, { $inc: { count: 1 } }, { upsert: true, new: true });
    return true;
  } catch (e) {
    if (e.code === 11000) return false;
    throw e;
  }
}

export async function releaseSlot(date, time) {
  await SlotBooking.updateOne({ date, time, count: { $gt: 0 } }, { $inc: { count: -1 } });
}

/** Recalculates a slot counter from orders (source of truth) — used after admin edits. */
export async function syncSlot(date, time) {
  const n = await Order.countDocuments({ pickupDate: date, pickupTime: time, status: ACTIVE });
  await SlotBooking.updateOne({ date, time }, { $set: { count: n } }, { upsert: true });
}
