import { Settings } from '../models/Settings.js';
import { defaultSettings } from '../seed/defaults.js';

let cache = null;
let cachedAt = 0;
const TTL = 10_000;

export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < TTL) return cache;
  let doc = await Settings.findOne({ key: 'main' });
  if (!doc) doc = await Settings.create(defaultSettings());
  cache = doc;
  cachedAt = Date.now();
  return doc;
}

export function invalidateSettings() {
  cache = null;
}

// Public subset safe for the storefront
export function publicSettings(s) {
  return {
    business: s.business,
    currency: s.currency,
    locale: s.locale,
    timezone: s.timezone,
    hours: s.hours,
    slotMinutes: s.slotMinutes,
    prepHours: s.prepHours,
    maxAdvanceDays: s.maxAdvanceDays,
    payments: {
      depositPercent: s.payments.depositPercent,
      depositRequiredFor: s.payments.depositRequiredFor,
      payAtPickup: s.payments.payAtPickup,
      onlineEnabled: s.payments.onlineEnabled,
    },
    fees: s.fees,
    cakeOptions: {
      sponges: s.cakeOptions.sponges.filter((o) => o.active !== false),
      fillings: s.cakeOptions.fillings.filter((o) => o.active !== false),
      finishes: s.cakeOptions.finishes.filter((o) => o.active !== false),
      addons: s.cakeOptions.addons.filter((o) => o.active !== false),
      maxMessageLength: s.cakeOptions.maxMessageLength,
    },
    chatWidget: s.chatWidget,
  };
}
