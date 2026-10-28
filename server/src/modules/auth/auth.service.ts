import { User, type IUser } from '../../models/index.js';
import { conflict, notFound, unauthenticated } from '../../utils/errors.js';
import type { HydratedDocument } from 'mongoose';
import type { LoginBody, RegisterBody, UpdateMeBody } from './auth.schemas.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken } from './tokens.js';

type UserDoc = HydratedDocument<IUser>;

/** Same message for an unknown email and a wrong password — never reveal which. */
export const INVALID_CREDENTIALS = 'Invalid email or password';

const isDuplicateKey = (err: unknown) =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;

export async function register(body: RegisterBody): Promise<{ user: UserDoc; token: string }> {
  const emailTaken = () => conflict('An account with this email already exists.', { email: body.email });
  if (await User.exists({ email: body.email })) throw emailTaken();

  try {
    const user = await User.create({
      name: body.name,
      email: body.email,
      role: body.role,
      passwordHash: await hashPassword(body.password),
      lastLoginAt: new Date(),
    });
    return { user, token: signToken(user.id, user.role) };
  } catch (err) {
    if (isDuplicateKey(err)) throw emailTaken(); // lost a race with a concurrent register
    throw err;
  }
}

export async function login({ email, password }: LoginBody): Promise<{ user: UserDoc; token: string }> {
  const user = await User.findOne({ email }).select('+passwordHash');
  // verifyPassword does the same bcrypt work whether or not the user exists.
  if (!(await verifyPassword(password, user?.passwordHash)) || !user) {
    throw unauthenticated(INVALID_CREDENTIALS);
  }
  // An update, not save(): logging in must not fail validation on an older profile.
  const updated = await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() }, { new: true });
  if (!updated) throw unauthenticated(INVALID_CREDENTIALS); // deleted in between
  return { user: updated, token: signToken(updated.id, updated.role) };
}

export async function getUser(userId: string): Promise<UserDoc> {
  const user = await User.findById(userId);
  if (!user) throw notFound('User');
  return user;
}

export async function updateMe(userId: string, body: UpdateMeBody): Promise<UserDoc> {
  const user = await getUser(userId);
  user.name = body.name;
  await user.save();
  return user;
}
