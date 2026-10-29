// Initial business configuration taken from the Patiala Bakers preview.
// Everything here is editable by staff in Admin → Settings; it is only used to create the first settings document.
export const defaultSettings = () => ({
  key: 'main',
  business: {
    name: 'Patiala Bakers',
    tagline: 'Eggless cakes & Indian sweets',
    address: '161 High St, Belmont VIC 3216',
    phone: '+61 480 303 950',
    email: 'bakerspatiala@gmail.com',
    abn: '',
    announcement: 'Every cake is eggless by default · Order 48 hours ahead for pickup in Belmont',
  },
  currency: 'AUD',
  locale: 'en-AU',
  timezone: 'Australia/Melbourne',
  hours: [
    { closed: false, open: '10:00', close: '16:00' }, // Sun
    { closed: true, open: '10:00', close: '18:00' }, // Mon
    { closed: false, open: '10:00', close: '18:00' },
    { closed: false, open: '10:00', close: '18:00' },
    { closed: false, open: '10:00', close: '18:00' },
    { closed: false, open: '10:00', close: '18:00' },
    { closed: false, open: '09:00', close: '18:00' }, // Sat
  ],
  slotMinutes: 60,
  slotCapacity: 4,
  lastSlotBeforeCloseMinutes: 60,
  maxAdvanceDays: 60,
  prepHours: { cakes: 48, 'custom-cakes': 120, sweets: 24, snacks: 4, breads: 4, biscuits: 4 },
  blockedDates: [],
  blockedSlots: [],
  payments: { depositPercent: 50, depositRequiredFor: ['custom-cakes'], payAtPickup: true, onlineEnabled: false },
  fees: { serviceFee: 0, serviceFeeLabel: 'Service fee' },
  cakeOptions: {
    sponges: [
      { name: 'Vanilla', price: 0 }, { name: 'Chocolate', price: 0 }, { name: 'Butterscotch', price: 0 },
      { name: 'Red velvet', price: 4 }, { name: 'Pistachio', price: 5 },
    ],
    fillings: [
      { name: 'Fresh cream', price: 0 }, { name: 'Chocolate ganache', price: 4 }, { name: 'Mango compote', price: 4 },
      { name: 'Mixed berry', price: 5 }, { name: 'Rasmalai cream', price: 6 },
    ],
    finishes: [
      { name: 'Classic piped', price: 0 }, { name: 'Semi-naked', price: 0 }, { name: 'Chocolate drip', price: 8 },
      { name: 'Floral buttercream', price: 12 }, { name: 'Gold leaf luxe', price: 18 },
    ],
    addons: [
      { name: 'Birthday candles', price: 3 }, { name: 'Sparkler candle', price: 5 }, { name: 'Chocolate plaque', price: 6 },
      { name: 'Cake topper', price: 8 }, { name: 'Fresh flowers', price: 12 }, { name: 'Macarons ×6', price: 15 },
    ],
    maxMessageLength: 40,
  },
  notifications: { newOrder: true, enquiry: true, lowStock: true, customerConfirmation: true, staffEmail: 'bakerspatiala@gmail.com' },
  chatWidget: {
    enabled: true,
    name: 'Patiala Bakers assistant',
    color: '#6E1630',
    welcome: 'Hi! I can help with cake sizes, eggless and vegan options, pickup times and custom cake requests.',
    prompts: [
      'Are your cakes eggless?', 'How much notice is needed for a custom cake?', 'What sizes are available?',
      'Can I order a vegan cake?', 'What time can I pick up my order?', 'How do I request a custom cake?',
    ],
    qa: [
      { q: 'Do you deliver?', a: 'We are pickup only from 161 High St, Belmont. For large custom orders, ask us about delivery when you enquire.' },
      { q: 'Do your products contain nuts?', a: 'Some do, and everything is made in a kitchen that handles nuts. Each product page lists its allergens. Tell us about allergies in your order notes.' },
    ],
  },
  bakers: ['Gurdeep', 'Meena', 'Tom', 'Ravi'],
});
