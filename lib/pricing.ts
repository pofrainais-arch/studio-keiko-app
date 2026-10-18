// Grille tarifaire du studio (guide de réservation 2026), montants HT.

export const TIERS = [
  { label: "0–15 min", cap: 15, rate: 60 },
  { label: "15–30 min", cap: 15, rate: 40 },
  { label: "30–45 min", cap: 15, rate: 10 },
  { label: "au-delà de 45 min", cap: Infinity, rate: 5 },
];

export type OptionId = "ouverture" | "setup" | "mobile" | "podcast" | "grille";

export const OPTIONS: { id: OptionId; label: string; price: number | null; desc: string }[] = [
  { id: "ouverture", label: "Ouverture du studio", price: 800, desc: "Forfait d'accès et d'utilisation du studio" },
  { id: "setup", label: "Setup & plateau", price: 200, desc: "Décors, mur d'écrans, agencement plateau" },
  { id: "mobile", label: "Studio mobile (½ journée)", price: 800, desc: "Setup & captation sur site" },
  { id: "podcast", label: "Podcast (½ journée)", price: 600, desc: "Setup & enregistrement" },
  { id: "grille", label: "Captation, grille dégressive", price: null, desc: "Selon la durée de la vidéo finale" },
];

export const POSTPROD_RATE = 80;

export type TypeId = "studio" | "mobile" | "podcast" | "live" | "montage" | "motion" | "autre";

export const TYPES: { id: TypeId; label: string; def: Partial<Record<OptionId, true>> }[] = [
  { id: "studio", label: "Captation studio", def: { ouverture: true, grille: true } },
  { id: "mobile", label: "Studio mobile", def: { mobile: true, grille: true } },
  { id: "podcast", label: "Podcast", def: { podcast: true, grille: true } },
  { id: "live", label: "Live / webinar", def: { ouverture: true, setup: true, grille: true } },
  { id: "montage", label: "Montage seul", def: {} },
  { id: "motion", label: "Motion design", def: {} },
  { id: "autre", label: "Autre", def: {} },
];

export const typeLabel = (id?: string) => TYPES.find((t) => t.id === id)?.label ?? id ?? "—";
export const defaultOptions = (type: TypeId): Partial<Record<OptionId, true>> => ({ ...(TYPES.find((t) => t.id === type)?.def ?? {}) });

export type Line = { label: string; sub?: string; amount: number };

export type PricingInput = {
  duree: number; // minutes, vidéo finale
  options: Partial<Record<OptionId, boolean>>;
  postprod: number; // heures
  ajust?: number;
  extras?: { desc: string; montant: number }[];
};

export function fmtMin(m: number) {
  m = +m || 0;
  let mm = Math.floor(m);
  let ss = Math.round((m - mm) * 60);
  if (ss === 60) { mm++; ss = 0; }
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function parseDuree(s: string | number): number {
  const v = String(s ?? "").trim().replace(",", ".");
  if (!v) return NaN;
  if (v.includes(":")) {
    const [m, sec] = v.split(":").map(Number);
    if (isNaN(m) || isNaN(sec)) return NaN;
    return m + sec / 60;
  }
  return Number(v);
}

export function gridLines(duree: number): Line[] {
  let rem = Math.max(0, +duree || 0);
  const out: Line[] = [];
  for (const t of TIERS) {
    if (rem <= 1e-6) break;
    const used = Math.min(rem, t.cap);
    out.push({ label: `Vidéo finale, ${t.label}`, sub: `${fmtMin(used)} × ${t.rate} €/min`, amount: used * t.rate });
    rem -= used;
  }
  return out;
}

export function price(input: PricingInput): { lines: Line[]; total: number } {
  const lines: Line[] = [];
  for (const o of OPTIONS) {
    if (o.id !== "grille" && input.options[o.id] && o.price != null) lines.push({ label: o.label, sub: "forfait", amount: o.price });
  }
  if (input.options.grille) lines.push(...gridLines(input.duree));
  if (+input.postprod > 0) lines.push({ label: "Post-production", sub: `${String(+input.postprod).replace(".", ",")} h × ${POSTPROD_RATE} €`, amount: +input.postprod * POSTPROD_RATE });
  for (const e of input.extras ?? []) {
    if (e.desc || +e.montant) lines.push({ label: e.desc || "Prestation additionnelle", amount: +e.montant || 0 });
  }
  if (+(input.ajust ?? 0)) lines.push({ label: "Ajustement", amount: +(input.ajust ?? 0) });
  const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  return { lines, total };
}

export const eur = (n: number, dec = false) =>
  (dec ? (+n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(+n || 0).toLocaleString("fr-FR")) + " €";

export const frDate = (iso?: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
