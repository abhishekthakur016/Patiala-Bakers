export const CATEGORIES = [
  { id: 'cakes', name: 'Cakes', color: '#9B2A4A', blurb: 'Celebration cakes, eggless by default' },
  { id: 'custom-cakes', name: 'Custom Cakes', color: '#6E1630', blurb: 'Tiered and themed cakes, quoted to order' },
  { id: 'sweets', name: 'Indian Sweets', color: '#B07A1E', blurb: 'Desi ghee mithai in small batches' },
  { id: 'snacks', name: 'Snacks & Meals', color: '#0E8A78', blurb: 'Samosas, puffs and Punjabi plates' },
  { id: 'breads', name: 'Breads', color: '#5468B8', blurb: 'Fresh loaves baked every morning' },
  { id: 'biscuits', name: 'Biscuits', color: '#7A5A9E', blurb: 'Nankhatai, rusks and chai biscuits' },
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export const ORDER_STATUSES = ['Pending', 'Confirmed', 'In Production', 'Ready', 'Collected', 'Cancelled'];
// Allowed forward/backward transitions for the order lifecycle
export const ORDER_TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['In Production', 'Ready', 'Cancelled', 'Pending'],
  'In Production': ['Ready', 'Confirmed', 'Cancelled'],
  Ready: ['Collected', 'In Production', 'Cancelled'],
  Collected: ['Ready'],
  Cancelled: ['Pending', 'Confirmed'],
};
export const PAYMENT_STATUSES = ['Unpaid', 'Deposit paid', 'Paid', 'Refunded'];
export const PAYMENT_METHODS = ['pay_at_pickup', 'deposit_online', 'card_online', 'cash', 'card_in_store', 'bank_transfer'];
export const PRIORITIES = ['Normal', 'High'];
export const STOCK_STATES = ['In stock', 'Low stock', 'Sold out', 'Made to order', 'Unavailable'];
export const ENQUIRY_STATUSES = ['New', 'Quoted', 'Awaiting Payment', 'Confirmed', 'Declined', 'Converted'];

export const STAFF_ROLES = ['owner', 'manager', 'baker', 'counter'];
export const PERMISSIONS = ['orders', 'production', 'calendar', 'products', 'pricing', 'enquiries', 'customers', 'reports', 'ai', 'settings'];
export const ROLE_DEFAULT_PERMISSIONS = {
  owner: PERMISSIONS,
  manager: PERMISSIONS.filter((p) => p !== 'settings'),
  baker: ['orders', 'production', 'calendar', 'enquiries'],
  counter: ['orders', 'calendar', 'customers'],
};
