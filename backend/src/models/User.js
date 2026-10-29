import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, STAFF_ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'staff'], default: 'customer', index: true },
    staffRole: { type: String, enum: [...STAFF_ROLES, null], default: null },
    permissions: [{ type: String, enum: PERMISSIONS }],
    dietaryPref: { type: String, default: '' },
    adminNotes: { type: String, default: '' },
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.setPassword = async function setPassword(pw) {
  this.passwordHash = await bcrypt.hash(pw, 12);
};
userSchema.methods.checkPassword = function checkPassword(pw) {
  return bcrypt.compare(pw, this.passwordHash);
};
userSchema.methods.can = function can(permission) {
  if (this.role !== 'staff') return false;
  if (this.staffRole === 'owner') return true;
  const perms = this.permissions?.length ? this.permissions : ROLE_DEFAULT_PERMISSIONS[this.staffRole] || [];
  return perms.includes(permission);
};
userSchema.methods.toSafeJSON = function toSafeJSON() {
  const perms = this.role === 'staff'
    ? (this.staffRole === 'owner' ? PERMISSIONS : (this.permissions?.length ? this.permissions : ROLE_DEFAULT_PERMISSIONS[this.staffRole] || []))
    : [];
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    staffRole: this.staffRole,
    permissions: perms,
    dietaryPref: this.dietaryPref,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
