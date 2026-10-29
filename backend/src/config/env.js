import 'dotenv/config';

const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  mongoUri: process.env.MONGODB_URI || '',
  useMemoryDb: bool(process.env.USE_MEMORY_DB),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'owner@patialabakers.com.au',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!2026',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: bool(process.env.SMTP_SECURE),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Patiala Bakers <no-reply@patialabakers.com.au>',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};

if (!env.jwtSecret) {
  if (env.isProd) throw new Error('JWT_SECRET must be set in production');
  env.jwtSecret = 'dev-only-insecure-secret-change-me';
}

export const cloudinaryEnabled = () => Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
export const smtpEnabled = () => Boolean(env.smtp.host);
export const stripeEnabled = () => Boolean(env.stripe.secretKey);
