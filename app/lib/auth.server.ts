import { createCookieSessionStorage, redirect } from "react-router";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { users } from "~/db/schema";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.warn(
    "[auth] SESSION_SECRET is not set. Using insecure dev fallback. " +
      "Set SESSION_SECRET in your environment for production.",
  );
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET ?? "dev-insecure-secret-change-me"],
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24, // 24h
  },
});

const USER_SESSION_KEY = "userId";

async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request): Promise<number | null> {
  const session = await getSession(request);
  const userId = session.get(USER_SESSION_KEY);
  return typeof userId === "number" ? userId : null;
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname,
): Promise<number> {
  const userId = await getUserId(request);
  if (!userId) {
    const params = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${params}`);
  }
  return userId;
}

export async function getCurrentUser(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return null;
  const user = db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return user ?? null;
}

export async function login(
  username: string,
  password: string,
): Promise<{ id: number; username: string } | null> {
  const row = db.select().from(users).where(eq(users.username, username)).get();
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password);
  if (!ok) return null;
  return { id: row.id, username: row.username };
}

export async function signup(
  username: string,
  password: string,
): Promise<
  | { ok: true; user: { id: number; username: string } }
  | { ok: false; error: string }
> {
  if (username.length < 3)
    return { ok: false, error: "Username must be at least 3 characters" };
  if (password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters" };
  const existing = db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (existing) return { ok: false, error: "Username already taken" };
  const hash = await bcrypt.hash(password, 10);
  const inserted = db
    .insert(users)
    .values({ username, password: hash })
    .returning({ id: users.id, username: users.username })
    .get();
  return { ok: true, user: inserted };
}

export async function createUserSession({
  request,
  userId,
  redirectTo,
}: {
  request: Request;
  userId: number;
  redirectTo: string;
}) {
  const session = await getSession(request);
  session.set(USER_SESSION_KEY, userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
