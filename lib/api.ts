import "server-only";
import { NextResponse } from "next/server";
import { UserError } from "./service";
import { getSession } from "./session";

export async function handle<T>(fn: (user: string) => Promise<T>) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Session expirée, reconnectez-vous." }, { status: 401 });
  try {
    return NextResponse.json(await fn(s.name));
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur, réessayez dans un instant." }, { status: 500 });
  }
}
