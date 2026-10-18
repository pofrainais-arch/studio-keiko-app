import { NextResponse } from "next/server";
import { COOKIE, checkPassword, createToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { name, password } = await req.json().catch(() => ({}));
  const n = String(name || "").trim().slice(0, 40);
  if (!n) return NextResponse.json({ error: "Indiquez votre prénom." }, { status: 400 });
  if (!checkPassword(String(password || ""))) return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createToken(n), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
