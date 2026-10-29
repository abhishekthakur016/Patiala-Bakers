import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ah } from '../utils/http.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import * as S from '../validators/schemas.js';
import * as auth from '../controllers/auth.controller.js';
import * as cat from '../controllers/catalog.controller.js';
import * as ord from '../controllers/order.controller.js';

const r = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes and try again.' } });
const formLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many submissions. Please try again shortly.' } });

// Auth & account
r.post('/auth/register', authLimiter, validate({ body: S.registerSchema }), ah(auth.register));
r.post('/auth/login', authLimiter, validate({ body: S.loginSchema }), ah(auth.login));
r.post('/auth/logout', auth.logout);
r.get('/auth/me', optionalAuth, auth.me);
r.patch('/account/profile', requireAuth, validate({ body: S.profileSchema }), ah(auth.updateProfile));
r.post('/account/password', requireAuth, validate({ body: S.passwordSchema }), ah(auth.changePassword));
r.get('/account/cart', requireAuth, ah(auth.getCart));
r.put('/account/cart', requireAuth, validate({ body: S.cartSchema }), ah(auth.saveCart));
r.get('/account/orders', requireAuth, ah(ord.myOrders));
r.get('/account/orders/:orderNumber', requireAuth, ah(ord.myOrder));
r.post('/account/orders/:orderNumber/reorder', requireAuth, ah(ord.reorder));
r.get('/account/enquiries', requireAuth, ah(ord.myEnquiries));

// Catalogue & settings
r.get('/settings', ah(cat.getPublicSettings));
r.get('/products', ah(cat.listProducts));
r.get('/products/:idOrSlug', ah(cat.getProduct));
r.get('/availability', ah(cat.getAvailability));

// Cart & checkout
r.post('/cart/quote', validate({ body: S.cartSchema }), ah(cat.quoteCart));
r.post('/checkout', formLimiter, optionalAuth, validate({ body: S.checkoutSchema }), ah(ord.checkout));
r.get('/orders/:orderNumber/confirmation', optionalAuth, ah(ord.getConfirmation));
r.post('/orders/track', formLimiter, validate({ body: S.trackSchema }), ah(ord.trackOrder));

// Enquiries, contact, chat
r.post('/enquiries', formLimiter, optionalAuth, imageUpload.array('images', 5), ah(ord.createEnquiry));
r.post('/contact', formLimiter, validate({ body: S.contactSchema }), ah(cat.contact));
r.post('/chat', rateLimit({ windowMs: 60 * 1000, limit: 30 }), validate({ body: S.chatSchema }), ah(cat.chat));

export default r;
