# Patiala Bakers — MERN storefront & bakery admin

A full-stack bakery platform built from the `Patiala_Bakers_Preview.html` design: a customer storefront (catalogue, cake builder, cart, pickup-slot checkout, accounts, custom-cake enquiries, chat) and a protected admin app (dashboard, orders, production, pickup calendar, products & inventory, bulk pricing, enquiries, customers, reports, AI assistant, settings).

```
patiala-bakers/
├── backend/    Express + Mongoose REST API  (Node 18.17+, ES modules)
└── frontend/   React 18 + Vite + Tailwind storefront and admin
```

## Quick start (local)

```bash
npm run install:all
```

Copy the env files and edit them:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Option A — no database install (demo data, resets on restart).** Set `USE_MEMORY_DB=true` in `backend/.env`. The first run downloads a MongoDB binary (~600 MB) once, then seeds the catalogue, an owner account, ~140 demo orders and sample enquiries automatically.

**Option B — MongoDB Atlas.** Put your connection string in `MONGODB_URI`, keep `USE_MEMORY_DB=false`, then seed:

```bash
npm run seed          # catalogue + settings + owner account (keeps existing data)
npm run seed:fresh    # WIPES the database, then seeds everything including demo orders
```

Run both apps (two terminals):

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Storefront: http://localhost:5173 · Admin: http://localhost:5173/admin

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `backend/.env` (defaults `owner@patialabakers.com.au` / `ChangeMe!2026`). **Change this password before going live** (Admin → Settings → Staff & access).

## Configuration

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string; required in production |
| `CLIENT_URL` | Allowed browser origin(s) for CORS, comma separated |
| `CLOUDINARY_*` | Product and enquiry image storage. Blank = local `backend/uploads/` (dev only) |
| `SMTP_*`, `EMAIL_FROM` | Order confirmations, quotes, staff alerts. Blank = emails are logged, not sent |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional online card payments / deposits. Also switch on in Admin → Settings → Payments |

Business details, opening hours, slot length and capacity, lead times per category, deposit %, service fee, cake options (sponges, fillings, finishes, add-ons and their prices), notifications and the chat widget are all **editable in Admin → Settings** — the values from the preview are only the initial defaults (`backend/src/seed/defaults.js`).

For Stripe, point a webhook at `POST /api/payments/stripe/webhook` for `checkout.session.completed`. Orders are only marked paid after Stripe confirms payment server-side (webhook, or a server-side session lookup when the customer returns).

## How the important rules are enforced (server-side)

- **Prices** — the browser only sends product ids, options and quantities. `services/pricing.service.js` prices every line from current database prices and settings; totals from the client are never used.
- **Pickup validation** — `services/slots.service.js` checks opening hours, blocked dates/slots, max days ahead, lead time (largest of the cart's products/categories) and slot capacity. Capacity is reserved atomically per slot.
- **Duplicate orders** — checkout sends an idempotency key; a retry returns the existing order instead of creating another.
- **Stock** — tracked quantities are decremented atomically and status moves to Low stock / Sold out automatically.
- **Order lifecycle** — Pending → Confirmed → In Production → Ready → Collected (or Cancelled), with allowed transitions in `config/constants.js` and a full status history.
- **Access** — JWT in an HTTP-only cookie; customers only see their own orders; guests view a confirmation with a private token. Staff have roles (owner, manager, baker, counter) and per-module permissions.

## API overview

Public: `GET /api/settings`, `GET /api/products`, `GET /api/products/:slug`, `GET /api/availability`, `POST /api/cart/quote`, `POST /api/checkout`, `GET /api/orders/:no/confirmation`, `POST /api/orders/track`, `POST /api/enquiries` (multipart), `POST /api/contact`, `POST /api/chat`, auth under `/api/auth/*` and `/api/account/*`.

Admin (staff cookie + permission): `/api/admin/dashboard`, `orders`, `production`, `calendar`, `products`, `uploads`, `pricing/*`, `enquiries`, `customers`, `reports`, `ai/ask`, `settings`, `staff`, `messages`.

## Notes

- **Images.** The preview only bundled four illustrations (rasmalai cake, ladoo, samosa, custom cake); they are in `frontend/public/images/`. Products without a photo show a generated illustration instead of a broken image. Upload real photos from Admin → Products.
- **Testimonials** on the homepage are the preview's sample reviews and are labelled as such — replace them with genuine reviews (`frontend/src/pages/storefront/Home.jsx`).
- **AI assistant & chat** are rule-based and answer from live MongoDB data; price changes are previewed and require approval. They can be swapped for an LLM later behind the same endpoints.
- **ABN** is blank by default — add it in Settings.

## Production build

```bash
npm run build
```

Serve `frontend/dist` from any static host (set `VITE_API_URL` to your API URL at build time) and run `npm start` in `backend/` with `NODE_ENV=production`. When the frontend and API are on different domains, cookies are sent with `SameSite=None; Secure`, so both must use HTTPS.
