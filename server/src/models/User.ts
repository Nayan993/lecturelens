import { Schema, model, type Model } from 'mongoose';
import { ROLES, type Role } from './enums.js';
import { clientJson } from './shared.js';

export { ROLES, type Role };

/** `users` — docs/CONTRACTS.md §4.1. */
export interface IUser {
  email: string;
  /** bcrypt, cost 12. Server-only: `select: false` and always stripped from JSON. */
  passwordHash: string;
  name: string;
  /** Immutable after register. */
  role: Role;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Must be a valid email address'],
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    role: { type: String, enum: ROLES, required: true, immutable: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: clientJson(['passwordHash']) },
);

userSchema.index({ email: 1 }, { unique: true });

export const User = model<IUser, Model<IUser>>('User', userSchema);
