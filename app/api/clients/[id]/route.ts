import { handle } from "@/lib/api";
import { deleteClient, updateClient } from "@/lib/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  return handle(() => updateClient(id, body));
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => { await deleteClient(id); return { ok: true }; });
}
