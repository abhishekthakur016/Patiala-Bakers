import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { ah } from './utils/http.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { stripeWebhook } from './controllers/order.controller.js';
import { LOCAL_UPLOAD_DIR } from './services/upload.service.js';
import publicRoutes from './routes/public.routes.js';
import adminRoutes from './routes/admin.routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientUrls, credentials: true }));
  app.use(pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/api/health' },
    serializers: { req: (req) => ({ method: req.method, url: req.url }), res: (res) => ({ statusCode: res.statusCode }) },
  }));

  // Stripe needs the raw body to verify signatures
  app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), ah(stripeWebhook));

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  app.use('/uploads', express.static(LOCAL_UPLOAD_DIR, { maxAge: '7d' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use('/api', publicRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
