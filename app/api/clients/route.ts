import { handle } from "@/lib/api";
import { createClient, listClients } from "@/lib/service";

export const dynamic = "force-dynamic";
export const GET = () => handle(() => listClients());
export async function POST(req: Request) {
  const body = await req.json();
  return handle((user) => createClient(body, user));
}
