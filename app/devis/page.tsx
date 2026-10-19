"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { eur, frDate } from "@/lib/pricing";
import { STATUT_LABEL, type Devis, type DevisStatut } from "@/lib/types";

export default function DevisList() {
  const router = useRouter();
  const [items, setItems] = useState<Devis[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [st, setSt] = useState<"" | DevisStatut>("");
  useEffect(() => { api<Devis[]>("/api/devis").then(setItems).catch((e) => setErr(e.message)); }, []);

  const rows = (items || [])
    .filter((d) => !st || d.statut === st)
    .filter((d) => !q || `${d.numero} ${d.projet} ${d.client.societe} ${d.client.nom}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const cur = (d: Devis) => d.versions[d.versions.length - 1];
  const pending = (items || []).filter((d) => d.statut === "envoye");

  return (
    <main className="wrap">
      <div className="pagehead">
        <h2>Devis</h2>
        <Link className="btn primary" href="/devis/nouveau">+ Nouveau devis</Link>
      </div>
      {err && <div className="banner err">{err}</div>}
      {pending.length > 0 && (
        <div className="banner info">{pending.length} devis en attente de réponse, pour {eur(pending.reduce((s, d) => s + cur(d).totalHT, 0))} HT.</div>
      )}
      <section className="panel">
        <div className="panel-head">
          <div className="toolbar">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client, un projet…" aria-label="Rechercher" />
            <select value={st} onChange={(e) => setSt(e.target.value as DevisStatut | "")} aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              {(Object.keys(STATUT_LABEL) as DevisStatut[]).map((s) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="tablebox">
          {items === null ? <p className="hint" style={{ padding: 18 }}>Chargement…</p> : !items.length ? (
            <div className="empty"><strong>Aucun devis pour l'instant</strong><span>Créez un devis : il sera numéroté automatiquement et chaque envoi est conservé.</span><Link className="btn primary" href="/devis/nouveau">Créer le premier devis</Link></div>
          ) : (
            <table className="list">
              <thead><tr><th>N°</th><th>Projet</th><th>Statut</th><th className="r">Version</th><th className="r">Total HT</th><th>Mis à jour</th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} onClick={() => router.push(`/devis/${d.id}`)}>
                    <td className="mono"><Link href={`/devis/${d.id}`} onClick={(e) => e.stopPropagation()}>{d.numero}</Link></td>
                    <td><div className="t-title">{d.projet}</div><div className="t-sub">{[d.client.societe, d.client.service, [d.client.prenom, d.client.nom].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}</div></td>
                    <td><span className={`pill ${d.statut}`}>{STATUT_LABEL[d.statut]}</span></td>
                    <td className="r">v{cur(d).v}</td>
                    <td className="r">{eur(cur(d).totalHT)}</td>
                    <td className="mono">{frDate(d.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
