import type { RequestHandler } from "express";
import type { User } from "@workspace/db";
import { SignupBody, LoginBody } from "./schemas";
import {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
} from "./logic/AuthLogic";
import {
  ValidationError,
  ConflictError,
  UnauthorizedError,
} from "../../core/errors";

function toAuthUser(u: User) {
  return { id: u.id, email: u.email, firmName: u.firmName };
}

export const signup: RequestHandler = async (req, res, next) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError("بيانات التسجيل غير صحيحة", parsed.error.flatten()));
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) {
    next(new ConflictError("هذا البريد الإلكتروني مسجّل بالفعل"));
    return;
  }
  const user = await createUser(email, parsed.data.password, parsed.data.firmName);
  startSession(req, user.id, () => res.status(201).json({ user: toAuthUser(user) }), next);
};

/* Regenerate the session on every auth boundary so a pre-login session id
   cannot be fixated and reused after authentication (session fixation). */
function startSession(
  req: Parameters<RequestHandler>[0],
  userId: string,
  onDone: () => void,
  next: Parameters<RequestHandler>[2],
) {
  req.session.regenerate((regenErr) => {
    if (regenErr) {
      next(regenErr);
      return;
    }
    req.session.userId = userId;
    req.session.save((saveErr) => {
      if (saveErr) {
        next(saveErr);
        return;
      }
      onDone();
    });
  });
}

export const login: RequestHandler = async (req, res, next) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError("بيانات الدخول غير صحيحة", parsed.error.flatten()));
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    next(new UnauthorizedError("البريد الإلكتروني أو كلمة المرور غير صحيحة"));
    return;
  }
  startSession(req, user.id, () => res.json({ user: toAuthUser(user) }), next);
};

export const logout: RequestHandler = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      next(err);
      return;
    }
    res.clearCookie("qanooni.sid");
    res.status(204).end();
  });
};

export const me: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    next(new UnauthorizedError());
    return;
  }
  const user = await findUserById(userId);
  if (!user) {
    req.session.destroy(() => undefined);
    next(new UnauthorizedError());
    return;
  }
  res.json({ user: toAuthUser(user) });
};
