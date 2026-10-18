import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "keiko_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me-dev-secret-change-me");

export type Session = { name: string };

export async function createToken(name: string) {
  return new SignJWT({ name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifyToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.name === "string" ? { name: payload.name } : null;
  } catch {
    return null;
  }
}

/** Constant-time-ish comparison of the shared team password. */
export function checkPassword(input: string) {
  const expected = process.env.APP_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "keiko");
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < input.length; i++) diff |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
