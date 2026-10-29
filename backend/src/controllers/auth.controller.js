import { User } from '../models/User.js';
import { Cart } from '../models/misc.js';
import { badRequest, conflict, unauthorized } from '../utils/http.js';
import { clearSession, issueSession } from '../middleware/auth.js';

export async function register(req, res) {
  const { name, email, phone, password } = req.body;
  if (await User.exists({ email })) throw conflict('An account with that email already exists. Try signing in.', { fields: { email: 'Already registered' } });
  const user = new User({ name, email, phone: phone || '', role: 'customer' });
  await user.setPassword(password);
  await user.save();
  issueSession(res, user);
  res.status(201).json({ user: user.toSafeJSON() });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.active || !(await user.checkPassword(password))) throw unauthorized('Email or password is incorrect.');
  user.lastLoginAt = new Date();
  await user.save();
  issueSession(res, user);
  res.json({ user: user.toSafeJSON() });
}

export function logout(_req, res) {
  clearSession(res);
  res.json({ ok: true });
}

export function me(req, res) {
  res.json({ user: req.user ? req.user.toSafeJSON() : null });
}

export async function updateProfile(req, res) {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.checkPassword(req.body.currentPassword))) throw badRequest('Current password is incorrect.', { fields: { currentPassword: 'Incorrect password' } });
  await user.setPassword(req.body.newPassword);
  await user.save();
  res.json({ ok: true });
}

// ── Persisted cart for signed-in customers ──
export async function getCart(req, res) {
  const cart = await Cart.findOne({ user: req.user._id });
  res.json({ items: cart?.items || [] });
}

export async function saveCart(req, res) {
  const cart = await Cart.findOneAndUpdate({ user: req.user._id }, { items: req.body.items }, { upsert: true, new: true });
  res.json({ items: cart.items });
}
