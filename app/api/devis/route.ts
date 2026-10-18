import { handle } from "@/lib/api";
import { createDevis, listDevis } from "@/lib/service";

export const dynamic = "force-dynamic";
export const GET = () => handle(() => listDevis());
export async function POST(req: Request) {
  const body = await req.json();
  return handle((user) => createDevis(body, user));
}
