import { handle } from "@/lib/api";
import { deleteDevis, getDevis, refreshBdc, saveBdc, saveDevis, setDevisStatut, signBdc, UserError } from "@/lib/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const d = await getDevis(id);
    if (!d) throw new UserError("Devis introuvable.");
    return d;
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  return handle((user) => {
    if (body.action === "save") return saveDevis(id, body.data, user);
    if (["envoye", "accepte", "refuse", "brouillon"].includes(body.action)) return setDevisStatut(id, body.action, user);
    if (body.action === "bdc-save") return saveBdc(id, body.data ?? null, user);
    if (body.action === "bdc-refresh") return refreshBdc(id);
    if (body.action === "bdc-sign") return signBdc(id, body.date ?? null);
    throw new UserError("Action inconnue.");
  });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => { await deleteDevis(id); return { ok: true }; });
}
