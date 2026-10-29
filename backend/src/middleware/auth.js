import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ah, forbidden, unauthorized } from '../utils/http.js';

export const COOKIE = 'pb_session';

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), r: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, secure: env.isProd, sameSite: env.isProd ? 'none' : 'lax', path: '/' });
}

async function loadUser(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);
    return user && user.active ? user : null;
  } catch {
    return null;
  }
}

export const optionalAuth = ah(async (req, _res, next) => {
  req.user = await loadUser(req);
  next();
});

export const requireAuth = ah(async (req, _res, next) => {
  req.user = await loadUser(req);
  if (!req.user) throw unauthorized();
  next();
});

export const requireStaff = ah(async (req, _res, next) => {
  req.user = req.user || (await loadUser(req));
  if (!req.user) throw unauthorized();
  if (req.user.role !== 'staff') throw forbidden('Staff access only');
  next();
});

export const requirePermission = (permission) => (req, _res, next) => {
  if (!req.user?.can(permission)) return next(forbidden(`Your account does not have ${permission} access`));
  next();
};
