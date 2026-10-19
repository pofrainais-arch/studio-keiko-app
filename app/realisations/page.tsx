"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { TYPES, eur, fmtMin, frDate, typeLabel } from "@/lib/pricing";
import type { Realisation } from "@/lib/types";

export default function RealisationsList() {
  const router = useRouter();
  const [items, setItems] = useState<Realisation[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [nat, setNat] = useState("");
  const [type, setType] = useState("");
  const [year, setYear] = useState("");
  useEffect(() => { api<Realisation[]>("/api/realisations").then(setItems).catch((e) => setErr(e.message)); }, []);

  const years = Array.from(new Set((items || []).map((r) => r.date.slice(0, 4)))).sort().reverse();
  const rows = (items || [])
    .filter((r) => (!nat || r.nature === nat) && (!type || r.type === type) && (!year || r.date.startsWith(year)))
    .filter((r) => !q || [r.titre, r.demandeur, r.entite, r.equipe?.join(" "), r.notes].join(" ").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const totF = rows.reduce((s, r) => s + (r.nature === "externe" ? r.facture : 0), 0);
  const totI = rows.reduce((s, r) => s + (r.nature === "interne" ? r.valeur : 0), 0);
  const totP = rows.reduce((s, r) => s + (r.nature === "partenaire" ? r.valeur : 0), 0);
  const mins = rows.reduce((s, r) => s + (+r.duree || 0), 0);

  return (
    <main className="wrap">
      <div className="pagehead">
        <h2>Réalisations</h2>
        <Link className="btn primary" href="/realisations/nouveau">+ Saisir une réalisation</Link>
      </div>
      {err && <div className="banner err">{err}</div>}
      <section className="panel">
        <div className="panel-head">
          <div className="toolbar">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un titre, un service…" aria-label="Rechercher" />
            <select value={nat} onChange={(e) => setNat(e.target.value)} aria-label="Nature"><option value="">Toutes les natures</option><option value="interne">Interne</option><option value="partenaire">Partenaire</option><option value="externe">Externe</option></select>
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">Tous les types</option>{TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
            <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Année"><option value="">Toutes les années</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
          </div>
        </div>
        <div className="tablebox">
          {items === null ? <p className="hint" style={{ padding: 18 }}>Chargement…</p> : !items.length ? (
            <div className="empty"><strong>Aucune réalisation pour l'instant</strong><span>Chaque vidéo livrée s'enregistre en une minute. Les devis acceptés arrivent ici automatiquement.</span><Link className="btn primary" href="/realisations/nouveau">Saisir la première réalisation</Link></div>
          ) : (
            <table className="list">
              <thead><tr><th>Date</th><th>Réalisation</th><th>Nature</th><th>Type</th><th className="r">Durée</th><th className="r">Montant HT</th><th>Statut</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => router.push(`/realisations/${r.id}`)}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{frDate(r.date)}</td>
                    <td><div className="t-title"><Link href={`/realisations/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.titre}</Link></div>
                      <div className="t-sub">{[r.demandeur, r.entite, r.equipe?.join(", ")].filter(Boolean).join(" · ")}</div></td>
                    <td>{r.nature === "externe" ? <span className="pill ext">Externe</span> : r.nature === "partenaire" ? <span className="pill par">Partenaire</span> : <span className="pill int">Interne</span>}</td>
                    <td>{typeLabel(r.type)}</td>
                    <td className="r">{fmtMin(r.duree)}</td>
                    <td className="r">{r.nature === "externe" ? <>{eur(r.facture)}<div className="t-sub">facturé{r.refFact ? ` · ${r.refFact}` : ""}</div></> : <>{eur(r.valeur)}<div className="t-sub">{r.nature === "partenaire" ? "valeur partenaire" : "valeur interne"}</div></>}</td>
                    <td><span className={`pill ${r.statut}`}>{r.statut === "cours" ? "En cours" : "Livré"}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td /><td className="t-sub">{rows.length} réalisation{rows.length > 1 ? "s" : ""}</td><td /><td /><td className="r mono">{fmtMin(mins)}</td>
                <td className="r mono"><strong>{eur(totF)}</strong><div className="t-sub">facturé</div><strong>{eur(totI)}</strong><div className="t-sub">valeur interne</div>{totP > 0 && <><strong>{eur(totP)}</strong><div className="t-sub">valeur partenaires</div></>}</td><td /></tr></tfoot>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
