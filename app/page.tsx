"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { eur, fmtHM, fmtMin, frDate, typeLabel } from "@/lib/pricing";
import type { Devis, Realisation } from "@/lib/types";

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const PERIODS = [
  { id: "mois", label: "Ce mois" }, { id: "trim", label: "Ce trimestre" }, { id: "annee", label: "Cette année" },
  { id: "12m", label: "12 derniers mois" }, { id: "tout", label: "Tout" }, { id: "perso", label: "Personnalisé" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];
type Nat = "tout" | "interne" | "partenaire" | "externe";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isExt = (r: Realisation) => r.nature === "externe";
const billed = (r: Realisation) => (isExt(r) ? +r.facture || +r.valeur || 0 : 0);
const internalVal = (r: Realisation) => (r.nature === "interne" ? +r.valeur || 0 : 0);
const partnerVal = (r: Realisation) => (r.nature === "partenaire" ? +r.valeur || 0 : 0);
const amount = (r: Realisation) => billed(r) + internalVal(r) + partnerVal(r);
const pl = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;

function range(period: PeriodId, from: string, to: string) {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  if (period === "mois") return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)), label: `${MONTHS[m]} ${y}` };
  if (period === "trim") { const q = Math.floor(m / 3); return { from: iso(new Date(y, q * 3, 1)), to: iso(new Date(y, q * 3 + 3, 0)), label: `T${q + 1} ${y}` }; }
  if (period === "annee") return { from: `${y}-01-01`, to: `${y}-12-31`, label: `année ${y}` };
  if (period === "12m") return { from: iso(new Date(y, m - 11, 1)), to: iso(new Date(y, m + 1, 0)), label: "12 derniers mois" };
  if (period === "perso") return { from: from || "1900-01-01", to: to || "2999-12-31", label: `${from ? `du ${frDate(from)}` : "depuis le début"}${to ? ` au ${frDate(to)}` : ""}` };
  return { from: "1900-01-01", to: "2999-12-31", label: "depuis le début" };
}

const parseISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return { y, m, d }; };
function shiftMonths(s: string, k: number) {
  const { y, m, d } = parseISO(s);
  const last = new Date(y, m - 1 + k + 1, 0).getDate();
  return iso(new Date(y, m - 1 + k, Math.min(d, last)));
}
/** Période précédente comparable : même durée, décalée ; pour une période en cours, mêmes jours écoulés. */
function prevRange(period: PeriodId, rg: { from: string; to: string }) {
  if (period === "tout") return null;
  const today = iso(new Date());
  const end = rg.to < today ? rg.to : today;
  if (period === "perso") {
    if (rg.from < "1901-01-01" || rg.to > "2998-12-31") return null;
    const n = Math.round((new Date(end + "T00:00:00").getTime() - new Date(rg.from + "T00:00:00").getTime()) / 86400000) + 1;
    const pe = new Date(new Date(rg.from + "T00:00:00").getTime() - 86400000);
    const ps = new Date(pe.getTime() - (n - 1) * 86400000);
    return { from: iso(ps), to: iso(pe), label: "période précédente" };
  }
  const k = period === "mois" ? -1 : period === "trim" ? -3 : period === "annee" ? -12 : -12;
  const label = period === "mois" ? "mois précédent" : period === "trim" ? "trimestre précédent" : period === "annee" ? "même période l'an dernier" : "12 mois précédents";
  return { from: shiftMonths(rg.from, k), to: shiftMonths(end, k), label };
}

type G = { k: string; n: number; v: number; f: number; i: number; p: number };
function group(rows: Realisation[], key: (r: Realisation) => string | string[] | undefined): G[] {
  const m: Record<string, G> = {};
  rows.forEach((r) => {
    const keys = ([] as (string | undefined)[]).concat(key(r));
    keys.forEach((k0) => {
      const k = k0 || "Non précisé";
      m[k] ??= { k, n: 0, v: 0, f: 0, i: 0, p: 0 };
      m[k].n++; m[k].v += amount(r); m[k].f += billed(r); m[k].i += internalVal(r); m[k].p += partnerVal(r);
    });
  });
  return Object.values(m);
}

function HBars({ items, metric }: { items: G[]; metric: "v" | "n" }) {
  if (!items.length) return <p className="hint" style={{ margin: 0 }}>Rien sur la période.</p>;
  const top = [...items].sort((a, b) => b[metric] - a[metric]).slice(0, 8);
  const max = Math.max(...top.map((i) => i[metric])) || 1;
  return (
    <div className="hbars">
      {top.map((i) => (
        <div className="hbar" key={i.k}>
          <span className="lbl" title={i.k}>{i.k}</span>
          <span className="fig">{metric === "n" ? <>{pl(i.n, "vidéo")} <small>· {eur(i.v)}</small></> : <>{eur(i.v)} <small>· {pl(i.n, "vidéo")}</small></>}</span>
          <div className="track">
            {metric === "n" ? <div className="fill" style={{ width: `${(i.n / max) * 100}%` }} /> : <>
              <div className="fill" style={{ width: `${(i.f / max) * 100}%` }} />
              <div className="fill i" style={{ width: `${(i.i / max) * 100}%` }} />
              <div className="fill p" style={{ width: `${(i.p / max) * 100}%` }} />
            </>}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthChart({ rows, rg, period }: { rows: Realisation[]; rg: { from: string; to: string }; period: PeriodId }) {
  let start = new Date(rg.from + "T00:00:00"), end = new Date(rg.to + "T00:00:00");
  if (rows.length) {
    const ds = rows.map((r) => r.date).sort();
    if (start.getFullYear() < 2000) start = new Date(ds[0] + "T00:00:00");
    if (end.getFullYear() > 2900) end = new Date(ds[ds.length - 1] + "T00:00:00");
  }
  const now = new Date();
  if (end > now && period !== "perso") end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const months: { key: string; label: string; y: number; n: number; f: number; i: number; p: number }[] = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end && months.length < 60; d = new Date(d.getFullYear(), d.getMonth() + 1, 1))
    months.push({ key: iso(d).slice(0, 7), label: MONTHS[d.getMonth()], y: d.getFullYear(), n: 0, f: 0, i: 0, p: 0 });
  rows.forEach((r) => { const m = months.find((x) => x.key === r.date.slice(0, 7)); if (m) { m.n++; m.f += billed(r); m.i += internalVal(r); m.p += partnerVal(r); } });
  if (!months.length || !rows.length) return <p className="hint" style={{ margin: 0 }}>Rien sur la période.</p>;
  const W = Math.max(560, months.length * 58), H = 230, pl0 = 56, pr = 10, pt = 26, pb = 34, iw = W - pl0 - pr, ih = H - pt - pb;
  const max = Math.max(...months.map((m) => m.f + m.i + m.p)) || 1;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const nice = [1, 2, 2.5, 5, 10].map((k) => k * step).find((s) => max / s <= 5) || step * 10;
  const top = Math.ceil(max / nice) * nice;
  const ticks: number[] = []; for (let t = 0; t <= top + 1e-9; t += nice) ticks.push(t);
  const bw = iw / months.length;
  return (
    <svg className="chart" width="100%" style={{ minWidth: 560, maxHeight: 320 }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Montants par mois">
      {ticks.map((t) => { const y = pt + ih - (t / top) * ih; return (
        <g key={t}><line className="grid" x1={pl0} x2={W - pr} y1={y} y2={y} /><text x={pl0 - 8} y={y + 4} textAnchor="end">{t >= 1000 ? `${(t / 1000).toLocaleString("fr-FR")} k` : t}</text></g>
      ); })}
      {months.map((m, i) => {
        const hf = (m.f / top) * ih, hi = (m.i / top) * ih, hp = (m.p / top) * ih, x = pl0 + i * bw + bw * 0.18, w = bw * 0.64, yb = pt + ih;
        const tip = `${m.label} ${m.y} : ${eur(m.f)} facturés, ${eur(m.i)} de valeur interne, ${eur(m.p)} de valeur partenaires, ${m.n} vidéo(s)`;
        return (
          <g key={m.key}>
            {hf > 0 && <rect className="b1" x={x} y={yb - hf} width={w} height={hf}><title>{tip}</title></rect>}
            {hi > 0 && <rect className="b2" x={x} y={yb - hf - hi} width={w} height={hi}><title>{tip}</title></rect>}
            {hp > 0 && <rect className="b3" x={x} y={yb - hf - hi - hp} width={w} height={hp}><title>{tip}</title></rect>}
            {m.n > 0 && <text className="v" x={x + w / 2} y={yb - hf - hi - hp - 6} textAnchor="middle">{m.n}</text>}
            <text x={x + w / 2} y={H - pb + 16} textAnchor="middle">{m.label}</text>
            {(i === 0 || m.label === "janv.") && <text x={x + w / 2} y={H - pb + 29} textAnchor="middle">{m.y}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const [reals, setReals] = useState<Realisation[] | null>(null);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [err, setErr] = useState("");
  const [period, setPeriod] = useState<PeriodId>("annee");
  const [nat, setNat] = useState<Nat>("tout");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Promise.all([api<Realisation[]>("/api/realisations"), api<Devis[]>("/api/devis")])
      .then(([r, d]) => { setReals(r); setDevis(d); })
      .catch((e) => setErr(e.message));
  }, []);

  const rg = range(period, from, to);
  const rows = useMemo(() => (reals || []).filter((r) => r.date >= rg.from && r.date <= rg.to && (nat === "tout" || r.nature === nat)), [reals, rg.from, rg.to, nat]);
  const ext = rows.filter(isExt), int = rows.filter((r) => r.nature === "interne"), par = rows.filter((r) => r.nature === "partenaire");
  const F = ext.reduce((s, r) => s + billed(r), 0), I = int.reduce((s, r) => s + internalVal(r), 0), P = par.reduce((s, r) => s + partnerVal(r), 0);
  const mins = rows.reduce((s, r) => s + (+r.duree || 0), 0);
  const fmts = rows.reduce((s, r) => s + (+(r.formats || 0)), 0);

  const lastV = (d: Devis) => d.versions[d.versions.length - 1];
  const pending = devis.filter((d) => d.statut === "envoye");
  const decided = devis.filter((d) => (d.statut === "accepte" || d.statut === "refuse") && (lastV(d).decidedAt || d.updatedAt).slice(0, 10) >= rg.from && (lastV(d).decidedAt || d.updatedAt).slice(0, 10) <= rg.to);
  const accepted = decided.filter((d) => d.statut === "accepte");

  const byType = group(rows, (r) => typeLabel(r.type));
  const byDem = group(int, (r) => r.demandeur);
  const byEnt = group(int, (r) => r.entite);
  const byCli = group(ext, (r) => r.demandeur);
  const byPar = group(par, (r) => r.demandeur);
  const byTeam = group(rows, (r) => (r.equipe?.length ? r.equipe : undefined));
  const byDiff = group(rows, (r) => r.diffusion);
  const natTxt = nat === "tout" ? "" : nat === "interne" ? " (interne)" : nat === "partenaire" ? " (partenaires)" : " (externe)";

  function summary() {
    const L: string[] = [];
    L.push(`Studio vidéo Keiko — activité ${rg.label}${natTxt}`, "");
    L.push(`• ${pl(rows.length, "vidéo")} réalisée${rows.length > 1 ? "s" : ""}, ${fmtHM(mins)} produites`);
    if (ext.length) L.push(`• Externe : ${pl(ext.length, "vidéo")} facturée${ext.length > 1 ? "s" : ""}, ${eur(F)} HT de chiffre d'affaires`);
    if (int.length) L.push(`• Interne : ${pl(int.length, "vidéo")} pour les services d'Ofi Invest, non facturée${int.length > 1 ? "s" : ""}, représentant ${eur(I)} HT au tarif du studio`);
    if (par.length) L.push(`• Partenaires : ${pl(par.length, "vidéo")} réalisée${par.length > 1 ? "s" : ""} pour ${pl(new Set(par.map((r) => r.demandeur)).size, "partenaire")}, non facturée${par.length > 1 ? "s" : ""}, représentant ${eur(P)} HT au tarif du studio`);
    if ([ext.length, int.length, par.length].filter(Boolean).length > 1) L.push(`• Valeur totale produite : ${eur(F + I + P)} HT, dont ${eur(I + P)} HT de prestations non facturées`);
    if (decided.length) L.push(`• Devis : ${pl(accepted.length, "devis")} accepté${accepted.length > 1 ? "s" : ""} sur ${decided.length} (${Math.round((accepted.length / decided.length) * 100)} %), ${pending.length} en attente de réponse`);
    L.push("", "Répartition par type :");
    [...byType].sort((a, b) => b.v - a.v).forEach((t) => L.push(`  – ${t.k} : ${pl(t.n, "vidéo")}, ${eur(t.v)}`));
    if (byDem.length) { L.push("", "Principaux services internes :"); [...byDem].sort((a, b) => b.v - a.v).slice(0, 5).forEach((t) => L.push(`  – ${t.k} : ${pl(t.n, "vidéo")}, ${eur(t.v)} de valeur`)); }
    if (byEnt.some((e) => e.k !== "Non précisé")) { L.push("", "Par entité :"); [...byEnt].sort((a, b) => b.v - a.v).forEach((t) => L.push(`  – ${t.k} : ${pl(t.n, "vidéo")}, ${eur(t.v)} de valeur`)); }
    if (byPar.length) { L.push("", "Partenaires :"); [...byPar].sort((a, b) => b.v - a.v).slice(0, 5).forEach((t) => L.push(`  – ${t.k} : ${pl(t.n, "vidéo")}, ${eur(t.v)} de valeur offerte`)); }
    if (byCli.length) { L.push("", "Clients externes :"); [...byCli].sort((a, b) => b.v - a.v).slice(0, 5).forEach((t) => L.push(`  – ${t.k} : ${pl(t.n, "vidéo")}, ${eur(t.v)} facturés`)); }
    L.push("", "Valeurs interne et partenaires calculées sur la grille du guide de réservation 2026 (captation dégressive, forfaits studio, post-production 80 €/h).");
    return L.join("\n");
  }

  async function copy() {
    try { await navigator.clipboard.writeText(summary()); setMsg("Synthèse copiée."); } catch { setMsg("Copie impossible : sélectionnez le texte."); }
  }
  async function exportPptx() {
    setMsg("Préparation de la présentation…");
    try {
      const { buildDeck } = await import("@/lib/deck");
      const byMonth: Record<string, { f: number; i: number; p: number; n: number }> = {};
      rows.forEach((r) => {
        const k = r.date.slice(0, 7);
        byMonth[k] ??= { f: 0, i: 0, p: 0, n: 0 };
        byMonth[k].f += billed(r); byMonth[k].i += internalVal(r); byMonth[k].p += partnerVal(r); byMonth[k].n++;
      });
      const keys = Object.keys(byMonth).sort();
      const months: { label: string; f: number; i: number; p: number; n: number }[] = [];
      if (keys.length) {
        let [y, m] = keys[0].split("-").map(Number);
        const [ey, em] = keys[keys.length - 1].split("-").map(Number);
        while (y < ey || (y === ey && m <= em)) {
          const k = `${y}-${String(m).padStart(2, "0")}`;
          months.push({ label: `${MONTHS[m - 1]} ${String(y).slice(2)}`, ...(byMonth[k] || { f: 0, i: 0, p: 0, n: 0 }) });
          if (++m > 12) { m = 1; y++; }
        }
      }
      const toG = (g: G[]) => g.map(({ k, n, v }) => ({ k, n, v }));
      await buildDeck({
        label: rg.label, natTxt,
        nb: { total: rows.length, ext: ext.length, int: int.length, par: par.length },
        mins, F, I, P,
        clients: new Set(ext.map((r) => r.demandeur)).size, services: new Set(int.map((r) => r.demandeur)).size, partenaires: new Set(par.map((r) => r.demandeur)).size,
        months, byType: toG(byType), byService: toG(byDem), byClient: toG(byCli), byPartenaire: toG(byPar),
        prev: (() => {
          const pr = prevRange(period, rg);
          if (!pr) return undefined;
          const pr_rows = (reals || []).filter((r) => r.date >= pr.from && r.date <= pr.to && (nat === "tout" || r.nature === nat));
          return { label: pr.label, total: pr_rows.length, mins: pr_rows.reduce((t, r) => t + (+r.duree || 0), 0), F: pr_rows.reduce((t, r) => t + billed(r), 0), I: pr_rows.reduce((t, r) => t + internalVal(r), 0), P: pr_rows.reduce((t, r) => t + partnerVal(r), 0) };
        })(),
        devis: { accepted: accepted.length, decided: decided.length, pending: pending.length, pendingHT: pending.reduce((t, d) => t + lastV(d).totalHT, 0) },
      });
      setMsg("Présentation générée : elle se trouve dans vos téléchargements.");
    } catch (e) { setMsg(`Génération impossible (${(e as Error).message}).`); }
  }
  function exportCsv() {
    const cols = ["Date", "Nature", "Titre", "Client / service", "Entité", "Type", "Durée (min)", "Statut", "Chiffrage grille HT (€)", "Montant facturé HT (€)", "Valeur interne HT (€)", "Valeur partenaire HT (€)", "N° devis / facture", "Post-prod (h)", "Équipe", "Diffusion", "Déclinaisons", "Lien", "Notes", "Saisi par"];
    const q = (v: unknown) => { const s = v == null ? "" : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const num = (n: number) => String(Math.round((+n || 0) * 100) / 100).replace(".", ",");
    const lines = [cols.join(";"), ...[...rows].sort((a, b) => (a.date < b.date ? -1 : 1)).map((r) =>
      [frDate(r.date), isExt(r) ? "Externe" : r.nature === "partenaire" ? "Partenaire" : "Interne", r.titre, r.demandeur, r.entite, typeLabel(r.type), num(r.duree), r.statut === "cours" ? "En cours" : "Livré", num(r.valeur), num(billed(r)), num(internalVal(r)), num(partnerVal(r)), r.refFact, num(r.postprod), (r.equipe || []).join(", "), r.diffusion, r.formats || 0, r.lien, r.notes, r.saisiPar].map(q).join(";"))];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `studio-keiko-${(rg.label + natTxt).replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="wrap">
      <div className="pagehead">
        <h2>Tableau de bord, {rg.label}{natTxt}</h2>
        <div className="actions">
          <Link className="btn" href="/devis/nouveau">+ Devis</Link>
          <Link className="btn primary" href="/realisations/nouveau">+ Réalisation</Link>
        </div>
      </div>
      {err && <div className="banner err">{err}</div>}

      <div className="panel">
        <div className="panel-head">
          <div className="chips">{PERIODS.map((p) => <button key={p.id} className="chip" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}</div>
          <div className="chips">
            {(["tout", "externe", "interne", "partenaire"] as Nat[]).map((n) => <button key={n} className="chip" aria-pressed={nat === n} onClick={() => setNat(n)}>{n === "tout" ? "Toutes natures" : n === "interne" ? "Interne" : n === "partenaire" ? "Partenaires" : "Externe"}</button>)}
          </div>
        </div>
        {period === "perso" && (
          <div className="panel-body"><div className="g2" style={{ maxWidth: 420 }}>
            <label className="f">Du<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="f">Au<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div></div>
        )}
      </div>

      {reals !== null && !reals.length && (
        <div className="banner info">Le registre est vide. Saisissez une réalisation ou acceptez un devis : les statistiques apparaîtront ici.</div>
      )}

      <div className="kpis">
        <div className="kpi"><span className="eyebrow">vidéos réalisées</span><span className="v">{rows.length}<span style={{ fontSize: "0.5em", fontWeight: 500, color: "var(--ink-soft)", marginLeft: 8 }}>· {fmtHM(mins)}</span></span><span className="d">{pl(ext.length, "externe")} · {pl(int.length, "interne")} · {pl(par.length, "partenaire")}{fmts ? ` · + ${fmts} déclinaisons` : ""}</span></div>
        <div className="kpi"><span className="eyebrow">facturé HT (externe)</span><span className="v" style={{ color: "var(--accent)" }}>{eur(F)}</span><span className="d">{pl(new Set(ext.map((r) => r.demandeur)).size, "client")}</span></div>
        <div className="kpi"><span className="eyebrow">valeur interne HT</span><span className="v" style={{ color: "var(--int-ink)" }}>{eur(I)}</span><span className="d">{pl(new Set(int.map((r) => r.demandeur)).size, "service")} Ofi Invest, non facturé</span></div>
        <div className="kpi"><span className="eyebrow">valeur partenaires HT</span><span className="v" style={{ color: "var(--par-ink)" }}>{eur(P)}</span><span className="d">{pl(new Set(par.map((r) => r.demandeur)).size, "partenaire")}, non facturé</span></div>
        <div className="kpi"><span className="eyebrow">devis en attente</span><span className="v">{pending.length}</span><span className="d">{eur(pending.reduce((s, d) => s + lastV(d).totalHT, 0))} HT{decided.length ? ` · ${Math.round((accepted.length / decided.length) * 100)} % acceptés sur la période` : ""}</span></div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Évolution mensuelle</h3>
          <div className="legend"><span><i style={{ background: "var(--accent)" }} />Facturé (externe)</span><span><i style={{ background: "var(--int)" }} />Valeur interne</span><span><i style={{ background: "var(--par)" }} />Valeur partenaires</span><span>chiffre au-dessus : nombre de vidéos</span></div>
        </div>
        <div className="panel-body chartbox"><MonthChart rows={rows} rg={rg} period={period} /></div>
      </div>

      <div className="reports">
        <div className="panel wide"><div className="panel-head"><h3>Par type de réalisation</h3><span className="hint">facturé + valeur non facturée · {fmtHM(mins)} produites</span></div><div className="panel-body"><HBars items={byType} metric="v" /></div></div>
        <div className="panel"><div className="panel-head"><h3>Par service Ofi Invest</h3><span className="hint">valeur interne</span></div><div className="panel-body"><HBars items={byDem} metric="v" /></div></div>
        <div className="panel"><div className="panel-head"><h3>Par entité</h3><span className="hint">valeur interne</span></div><div className="panel-body"><HBars items={byEnt} metric="v" /></div></div>
        <div className="panel"><div className="panel-head"><h3>Par partenaire</h3><span className="hint">valeur offerte</span></div><div className="panel-body"><HBars items={byPar} metric="v" /></div></div>
        <div className="panel"><div className="panel-head"><h3>Par client externe</h3><span className="hint">montant facturé</span></div><div className="panel-body"><HBars items={byCli} metric="v" /></div></div>
        <div className="panel"><div className="panel-head"><h3>Par membre de l'équipe</h3><span className="hint">nombre de vidéos</span></div><div className="panel-body"><HBars items={byTeam} metric="n" /></div></div>
        <div className="panel wide"><div className="panel-head"><h3>Par canal de diffusion</h3><span className="hint">nombre de vidéos</span></div><div className="panel-body"><HBars items={byDiff} metric="n" /></div></div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Pour la direction</h3>
          <div className="actions">
            <button className="btn primary" onClick={copy}>Copier la synthèse</button>
            <button className="btn" onClick={exportCsv}>Exporter en CSV (Excel)</button>
            <button className="btn" onClick={exportPptx}>Présentation PowerPoint</button>
            {msg && <span className="msg ok" role="status">{msg}</span>}
          </div>
        </div>
        <div className="panel-body"><textarea className="summary-text" readOnly value={summary()} aria-label="Synthèse texte" /></div>
      </div>
    </main>
  );
}
