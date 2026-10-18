import { handle } from "@/lib/api";
import { createRealisation, listRealisations } from "@/lib/service";

export const dynamic = "force-dynamic";
export const GET = () => handle(() => listRealisations());
export async function POST(req: Request) {
  const body = await req.json();
  return handle((user) => createRealisation(body, user));
}
