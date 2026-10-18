import "server-only";
import { cookies } from "next/headers";
import { COOKIE, verifyToken } from "./auth";

export async function getSession() {
  const c = await cookies();
  return verifyToken(c.get(COOKIE)?.value);
}
