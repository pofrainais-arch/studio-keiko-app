// Présentation PowerPoint de la direction, générée dans le navigateur à partir des chiffres du tableau de bord.
import { eur, fmtHM } from "./pricing";

export type DeckGroup = { k: string; n: number; v: number };
export type DeckData = {
  label: string; // période, ex. « année 2026 »
  natTxt: string; // filtre de nature, ex. « (externe) » ou vide
  nb: { total: number; ext: number; int: number; par: number };
  mins: number;
  F: number; I: number; P: number;
  clients: number; services: number; partenaires: number;
  months: { label: string; f: number; i: number; p: number; n: number }[];
  byType: DeckGroup[];
  byService: DeckGroup[];
  byClient: DeckGroup[];
  byPartenaire: DeckGroup[];
  devis: { accepted: number; decided: number; pending: number; pendingHT: number };
  prev?: { label: string; total: number; mins: number; F: number; I: number; P: number }; // période précédente comparable, si elle existe
};

const C = { navy: "00485C", blue: "007D9F", red: "F37A6E", yellow: "FAB414", beige: "F8F7F5", sand: "EAE8E4", ink: "14171A", soft: "5F5C55", white: "FFFFFF" };
const FONT = "Arial";
const pl = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;

const pct = (cur: number, prev: number) => Math.round(((cur - prev) / prev) * 100);
/** « ▲ +12 % vs mois précédent (115) », ou vide s'il n'y a rien à comparer. */
function delta(cur: number, prev: number | undefined, label: string, fmt: (n: number) => string) {
  if (prev === undefined) return "";
  if (prev === 0) return cur === 0 ? "" : "nouveau, rien à comparer";
  const p = pct(cur, prev);
  return `${p > 0 ? "▲ +" : p < 0 ? "▼ " : "= "}${p} % vs ${label} (${fmt(prev)})`;
}
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / e;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e;
};

export async function buildDeck(d: DeckData) {
  const { default: Pptx } = await import("pptxgenjs");
  const pptx = new Pptx();
  pptx.layout = "LAYOUT_WIDE"; // 13,33 × 7,5 po
  pptx.author = "Ofi Studio";
  pptx.title = `Ofi Studio, activité ${d.label}`;

  const title = (s: ReturnType<typeof pptx.addSlide>, text: string, sub?: string) => {
    s.background = { color: C.beige };
    s.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText(text, { x: 0.6, y: 0.35, w: 12, h: 0.7, fontFace: FONT, fontSize: 28, bold: true, color: C.navy });
    if (sub) s.addText(sub, { x: 0.6, y: 1.0, w: 12, h: 0.4, fontFace: FONT, fontSize: 14, color: C.soft });
    s.addText(`Ofi Studio · Ofi Invest AM · ${d.label}${d.natTxt}`, { x: 0.6, y: 7.0, w: 9, h: 0.3, fontFace: FONT, fontSize: 10, color: C.soft });
  };

  // 1. Titre
  const s1 = pptx.addSlide();
  s1.background = { color: C.navy };
  s1.addShape("ellipse", { x: 9.6, y: 1.2, w: 3, h: 3, fill: { type: "none" }, line: { color: C.beige, width: 3 } });
  s1.addShape("ellipse", { x: 9.6, y: 2.0, w: 3, h: 2.2, fill: { type: "none" }, line: { color: "7FB6CC", width: 2.5 } });
  s1.addShape("ellipse", { x: 9.6, y: 2.9, w: 3, h: 1.2, fill: { type: "none" }, line: { color: "5B96B3", width: 2 } });
  s1.addShape("triangle", { x: 10.7, y: 2.25, w: 0.8, h: 0.9, rotate: 90, fill: { color: C.red }, line: { color: C.beige, width: 3 } });
  s1.addText("Ofi Studio", { x: 0.7, y: 2.2, w: 8.5, h: 1, fontFace: FONT, fontSize: 48, bold: true, color: C.white });
  s1.addText(`Activité ${d.label}${d.natTxt}`, { x: 0.7, y: 3.2, w: 8.5, h: 0.6, fontFace: FONT, fontSize: 24, color: C.beige });
  s1.addText("Ofi Invest AM · studio vidéo Keiko", { x: 0.7, y: 3.9, w: 8.5, h: 0.4, fontFace: FONT, fontSize: 14, color: "A9CBD8" });

  // 2. Chiffres clés
  const s2 = pptx.addSlide();
  title(s2, "Chiffres clés", `${pl(d.nb.total, "vidéo")} réalisée${d.nb.total > 1 ? "s" : ""} sur la période`);
  const pv = d.prev;
  const pvl = pv?.label ?? "";
  const cards: [string, string, string, string, string][] = [
    ["Vidéos réalisées", String(d.nb.total), `${fmtHM(d.mins)} produites · ${d.nb.ext} externe · ${d.nb.int} interne · ${d.nb.par} partenaire`, C.navy, delta(d.nb.total, pv?.total, pvl, String)],
    ["Facturé HT (externe)", eur(d.F), pl(d.clients, "client"), C.blue, delta(d.F, pv?.F, pvl, eur)],
    ["Valeur interne HT", eur(d.I), `${pl(d.services, "service")} Ofi Invest, non facturé`, C.red, delta(d.I, pv?.I, pvl, eur)],
    ["Valeur partenaires HT", eur(d.P), `${pl(d.partenaires, "partenaire")}, non facturé`, C.yellow, delta(d.P, pv?.P, pvl, eur)],
  ];
  cards.forEach(([lab, val, det, col, cmp], i) => {
    const x = 0.6 + (i % 2) * 6.2, y = 1.8 + Math.floor(i / 2) * 2.4;
    s2.addShape("rect", { x, y, w: 5.9, h: 2.1, fill: { color: C.white }, line: { color: C.sand, width: 1 } });
    s2.addShape("rect", { x, y, w: 0.12, h: 2.1, fill: { color: col }, line: { color: col } });
    s2.addText(lab.toUpperCase(), { x: x + 0.35, y: y + 0.15, w: 5.3, h: 0.35, fontFace: FONT, fontSize: 12, color: C.soft, charSpacing: 2 });
    s2.addText(val, { x: x + 0.35, y: y + 0.5, w: 5.3, h: 0.8, fontFace: FONT, fontSize: 36, bold: true, color: C.ink });
    s2.addText(det, { x: x + 0.35, y: y + 1.25, w: 5.3, h: 0.35, fontFace: FONT, fontSize: 12, color: C.soft });
    if (cmp) s2.addText(cmp, { x: x + 0.35, y: y + 1.6, w: 5.3, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.navy });
  });
  if (d.I + d.P > 0) {
    s2.addText(`Valeur totale produite : ${eur(d.F + d.I + d.P)} HT, dont ${eur(d.I + d.P)} HT de prestations non facturées (au tarif du studio).`, { x: 0.6, y: 6.55, w: 12, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.navy });
  }

  // 2b. Comparaison avec la période précédente
  if (pv && (pv.total || pv.F || pv.I || pv.P)) {
    const s2b = pptx.addSlide();
    title(s2b, "Par rapport à la période précédente", `${d.label}, comparaison avec : ${pvl}`);
    const head = ["", d.label, pvl.charAt(0).toUpperCase() + pvl.slice(1), "Évolution"].map((t) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.navy }, align: "center" as const } }));
    const line = (name: string, cur: number, prev: number, fmt: (n: number) => string) => {
      const ev = prev === 0 ? (cur === 0 ? "=" : "nouveau") : `${pct(cur, prev) > 0 ? "▲ +" : pct(cur, prev) < 0 ? "▼ " : "= "}${pct(cur, prev)} %`;
      const col = prev === 0 || pct(cur, prev) === 0 ? C.soft : pct(cur, prev) > 0 ? "1E7B4B" : "B3392C";
      return [
        { text: name, options: { bold: true, align: "left" as const } },
        { text: fmt(cur), options: { align: "center" as const } },
        { text: fmt(prev), options: { align: "center" as const, color: C.soft } },
        { text: ev, options: { align: "center" as const, bold: true, color: col } },
      ];
    };
    const tot = (f: number, i: number, p: number) => f + i + p;
    s2b.addTable([
      head,
      line("Vidéos réalisées", d.nb.total, pv.total, String),
      line("Durée produite", d.mins, pv.mins, fmtHM),
      line("Facturé HT (externe)", d.F, pv.F, eur),
      line("Valeur interne HT", d.I, pv.I, eur),
      line("Valeur partenaires HT", d.P, pv.P, eur),
      line("Valeur totale produite HT", tot(d.F, d.I, d.P), tot(pv.F, pv.I, pv.P), eur),
    ], { x: 0.6, y: 1.7, w: 12.1, colW: [4.3, 2.6, 2.6, 2.6], rowH: 0.55, fontFace: FONT, fontSize: 15, color: C.ink, fill: { color: C.white }, border: { type: "solid", color: C.sand, pt: 1 }, valign: "middle" });
    s2b.addText("La période précédente couvre la même durée, décalée dans le temps (pour une période en cours, le même nombre de jours écoulés).", { x: 0.6, y: 6.3, w: 12, h: 0.5, fontFace: FONT, fontSize: 12, color: C.soft });
  }

  // 3. Évolution mensuelle
  if (d.months.length) {
    const s3 = pptx.addSlide();
    title(s3, "Évolution mensuelle", "Facturé, valeur interne et valeur partenaires, en euros HT");
    const X0 = 1.5, X1 = 12.7, YT = 1.9, YB = 6.0; // zone du graphique
    const tot = d.months.map((m) => m.f + m.i + m.p);
    const top = niceMax(Math.max(...tot));
    for (let g = 0; g <= 4; g++) {
      const y = YB - ((YB - YT) * g) / 4;
      s3.addShape("line", { x: X0, y, w: X1 - X0, h: 0, line: { color: C.sand, width: 0.75 } });
      s3.addText(eur((top * g) / 4), { x: 0.4, y: y - 0.15, w: 1.0, h: 0.3, fontFace: FONT, fontSize: 10, color: C.soft, align: "right" });
    }
    const slot = (X1 - X0) / d.months.length, bw = Math.min(slot * 0.62, 1.1);
    const small = d.months.length > 12;
    d.months.forEach((m, i) => {
      const x = X0 + i * slot + (slot - bw) / 2;
      let y = YB;
      ([[m.f, C.blue], [m.i, C.red], [m.p, C.yellow]] as [number, string][]).forEach(([v, col]) => {
        const h = ((YB - YT) * v) / top;
        if (h > 0.005) { y -= h; s3.addShape("rect", { x, y, w: bw, h, fill: { color: col }, line: { color: col, width: 0.25 } }); }
      });
      if (m.n > 0) s3.addText(String(m.n), { x: x - 0.2, y: y - 0.3, w: bw + 0.4, h: 0.28, fontFace: FONT, fontSize: 10, bold: true, color: C.ink, align: "center" });
      s3.addText(m.label, { x: X0 + i * slot - 0.1, y: YB + 0.08, w: slot + 0.2, h: 0.3, fontFace: FONT, fontSize: small ? 8 : 10, color: C.soft, align: "center" });
    });
    ([["Facturé (externe)", C.blue], ["Valeur interne", C.red], ["Valeur partenaires", C.yellow]] as [string, string][]).forEach(([t, col], i) => {
      s3.addShape("rect", { x: 1.5 + i * 2.7, y: 6.55, w: 0.2, h: 0.2, fill: { color: col }, line: { color: col } });
      s3.addText(t, { x: 1.8 + i * 2.7, y: 6.48, w: 2.3, h: 0.34, fontFace: FONT, fontSize: 11, color: C.ink });
    });
    s3.addText("Chiffre au-dessus : nombre de vidéos", { x: 9.2, y: 6.48, w: 3.5, h: 0.34, fontFace: FONT, fontSize: 10, color: C.soft, align: "right" });
    const best = d.months.reduce((a, m, i) => (tot[i] > tot[a] ? i : a), 0);
    if (tot[best] > 0) s3.addText(`Meilleur mois : ${d.months[best].label}, ${eur(tot[best])} HT de valeur produite.`, { x: 0.6, y: 1.35, w: 12, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: C.navy });
  }

  // 4. Répartition par type
  if (d.byType.length) {
    const s4 = pptx.addSlide();
    title(s4, "Répartition par type de réalisation", "Valeur HT (facturé + non facturé) et nombre de vidéos");
    const top = [...d.byType].sort((a, b) => b.v - a.v).slice(0, 8);
    const max = Math.max(...top.map((t) => t.v)) || 1;
    const rowH = Math.min(0.6, 4.9 / top.length);
    top.forEach((t, i) => {
      const y = 1.7 + i * (rowH + 0.08);
      const w = Math.max(0.05, (t.v / max) * 7);
      s4.addText(`${t.k}  (${t.n})`, { x: 0.6, y, w: 3.7, h: rowH, fontFace: FONT, fontSize: 13, color: C.ink, align: "right", valign: "middle" });
      s4.addShape("rect", { x: 4.5, y: y + 0.05, w, h: rowH - 0.1, fill: { color: C.navy }, line: { color: C.navy } });
      s4.addText(eur(t.v), { x: 4.6 + w, y, w: 2, h: rowH, fontFace: FONT, fontSize: 12, bold: true, color: C.ink, valign: "middle" });
    });
  }

  // 5. Qui nous sollicite
  const lists: [string, DeckGroup[], string, string][] = [
    ["Services internes", d.byService, "valeur", C.red],
    ["Partenaires", d.byPartenaire, "valeur offerte", C.yellow],
    ["Clients externes", d.byClient, "facturés", C.blue],
  ];
  if (lists.some(([, g]) => g.length)) {
    const s5 = pptx.addSlide();
    title(s5, "Qui fait appel au studio", "Les cinq premiers de chaque catégorie");
    lists.forEach(([name, g, unit, col], i) => {
      const x = 0.6 + i * 4.1;
      s5.addShape("rect", { x, y: 1.7, w: 3.9, h: 0.5, fill: { color: col }, line: { color: col } });
      s5.addText(name, { x: x + 0.15, y: 1.7, w: 3.6, h: 0.5, fontFace: FONT, fontSize: 15, bold: true, color: col === C.yellow ? C.ink : C.white, valign: "middle" });
      const top = [...g].sort((a, b) => b.v - a.v).slice(0, 5);
      if (!top.length) { s5.addText("Rien sur la période.", { x, y: 2.4, w: 3.9, h: 0.4, fontFace: FONT, fontSize: 12, color: C.soft }); return; }
      s5.addText(top.map((t) => ({ text: `${t.k}\n`, options: { bold: true, fontSize: 17, color: C.ink, breakLine: false } })).flatMap((r, j) => [
        r, { text: `${pl(top[j].n, "vidéo")} · ${eur(top[j].v)} ${unit}\n`, options: { fontSize: 13, color: C.soft } },
      ]), { x, y: 2.35, w: 3.9, h: 4.4, fontFace: FONT, valign: "top", paraSpaceAfter: 10 });
    });
  }

  // 6. Devis
  if (d.devis.decided || d.devis.pending) {
    const s6 = pptx.addSlide();
    title(s6, "Devis", "Activité commerciale du studio");
    const rate = d.devis.decided ? Math.round((d.devis.accepted / d.devis.decided) * 100) : 0;
    const k: [string, string, string][] = [
      ["Devis acceptés", `${d.devis.accepted} / ${d.devis.decided}`, d.devis.decided ? `${rate} % d'acceptation sur la période` : "Aucun devis décidé sur la période"],
      ["En attente de réponse", String(d.devis.pending), `${eur(d.devis.pendingHT)} HT`],
    ];
    k.forEach(([lab, val, det], i) => {
      const x = 0.6 + i * 6.2;
      s6.addShape("rect", { x, y: 1.9, w: 5.9, h: 2.2, fill: { color: C.white }, line: { color: C.sand, width: 1 } });
      s6.addText(lab.toUpperCase(), { x: x + 0.35, y: 2.1, w: 5.3, h: 0.35, fontFace: FONT, fontSize: 12, color: C.soft, charSpacing: 2 });
      s6.addText(val, { x: x + 0.35, y: 2.5, w: 5.3, h: 0.9, fontFace: FONT, fontSize: 40, bold: true, color: C.navy });
      s6.addText(det, { x: x + 0.35, y: 3.4, w: 5.3, h: 0.5, fontFace: FONT, fontSize: 13, color: C.soft });
    });
  }

  // 7. Méthode
  const s7 = pptx.addSlide();
  title(s7, "Repères de lecture");
  s7.addText([
    { text: "Externe : vidéos facturées à un client du groupe, le montant facturé HT constitue le chiffre d'affaires.", options: { bullet: true, breakLine: true } },
    { text: "Interne : vidéos réalisées pour les services d'Ofi Invest, non facturées, valorisées au tarif du studio.", options: { bullet: true, breakLine: true } },
    { text: "Partenaires : prestations réalisées pour des partenaires, non facturées, valorisées au tarif du studio.", options: { bullet: true, breakLine: true } },
    { text: "Valorisation : grille du guide de réservation 2026 (captation dégressive, forfaits studio, post-production 80 € HT par heure).", options: { bullet: true } },
  ], { x: 0.8, y: 1.6, w: 11.7, h: 4.2, fontFace: FONT, fontSize: 18, color: C.ink, paraSpaceAfter: 14, valign: "top" });

  const safe = `${d.label}${d.natTxt}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  await pptx.writeFile({ fileName: `ofi-studio-${safe}.pptx` });
}
