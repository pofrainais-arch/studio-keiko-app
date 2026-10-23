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
};

const C = { navy: "00485C", blue: "007D9F", red: "F37A6E", yellow: "FAB414", beige: "F8F7F5", sand: "EAE8E4", ink: "14171A", soft: "5F5C55", white: "FFFFFF" };
const FONT = "Arial";
const pl = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;

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
  const cards: [string, string, string, string][] = [
    ["Vidéos réalisées", String(d.nb.total), `${fmtHM(d.mins)} produites · ${d.nb.ext} externe · ${d.nb.int} interne · ${d.nb.par} partenaire`, C.navy],
    ["Facturé HT (externe)", eur(d.F), pl(d.clients, "client"), C.blue],
    ["Valeur interne HT", eur(d.I), `${pl(d.services, "service")} Ofi Invest, non facturé`, C.red],
    ["Valeur partenaires HT", eur(d.P), `${pl(d.partenaires, "partenaire")}, non facturé`, C.yellow],
  ];
  cards.forEach(([lab, val, det, col], i) => {
    const x = 0.6 + (i % 2) * 6.2, y = 1.8 + Math.floor(i / 2) * 2.4;
    s2.addShape("rect", { x, y, w: 5.9, h: 2.1, fill: { color: C.white }, line: { color: C.sand, width: 1 } });
    s2.addShape("rect", { x, y, w: 0.12, h: 2.1, fill: { color: col }, line: { color: col } });
    s2.addText(lab.toUpperCase(), { x: x + 0.35, y: y + 0.2, w: 5.3, h: 0.35, fontFace: FONT, fontSize: 12, color: C.soft, charSpacing: 2 });
    s2.addText(val, { x: x + 0.35, y: y + 0.6, w: 5.3, h: 0.8, fontFace: FONT, fontSize: 36, bold: true, color: C.ink });
    s2.addText(det, { x: x + 0.35, y: y + 1.4, w: 5.3, h: 0.5, fontFace: FONT, fontSize: 12, color: C.soft });
  });
  if (d.I + d.P > 0) {
    s2.addText(`Valeur totale produite : ${eur(d.F + d.I + d.P)} HT, dont ${eur(d.I + d.P)} HT de prestations non facturées (au tarif du studio).`, { x: 0.6, y: 6.55, w: 12, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.navy });
  }

  // 3. Évolution mensuelle
  if (d.months.length) {
    const s3 = pptx.addSlide();
    title(s3, "Évolution mensuelle", "Facturé, valeur interne et valeur partenaires, en euros HT");
    const labels = d.months.map((m) => m.label);
    s3.addChart("bar", [
      { name: "Facturé (externe)", labels, values: d.months.map((m) => Math.round(m.f)) },
      { name: "Valeur interne", labels, values: d.months.map((m) => Math.round(m.i)) },
      { name: "Valeur partenaires", labels, values: d.months.map((m) => Math.round(m.p)) },
    ], {
      x: 0.6, y: 1.5, w: 12.1, h: 5.3, barDir: "col", barGrouping: "stacked",
      chartColors: [C.blue, C.red, C.yellow], showLegend: true, legendPos: "b", legendFontFace: FONT, legendFontSize: 12,
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 11,
      valAxisLabelFormatCode: "# ##0", valGridLine: { color: C.sand, size: 0.75 }, catGridLine: { style: "none" },
    });
  }

  // 4. Répartition par type
  if (d.byType.length) {
    const s4 = pptx.addSlide();
    title(s4, "Répartition par type de réalisation", "Valeur HT (facturé + non facturé) et nombre de vidéos");
    const top = [...d.byType].sort((a, b) => b.v - a.v).slice(0, 8).reverse(); // en barres horizontales, la première catégorie est en bas
    s4.addChart("bar", [{ name: "Valeur HT", labels: top.map((t) => `${t.k} (${t.n})`), values: top.map((t) => Math.round(t.v)) }], {
      x: 0.6, y: 1.5, w: 12.1, h: 5.3, barDir: "bar", chartColors: [C.navy], showLegend: false,
      showValue: true, dataLabelFormatCode: "# ##0 €", dataLabelFontFace: FONT, dataLabelFontSize: 11,
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 12, valAxisHidden: true, valGridLine: { style: "none" },
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
