import { handle } from "@/lib/api";
import { deleteRealisation, updateRealisation } from "@/lib/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  return handle(() => updateRealisation(id, body));
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => { await deleteRealisation(id); return { ok: true }; });
}
