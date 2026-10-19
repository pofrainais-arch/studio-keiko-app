"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { contratInfo } from "@/lib/legal";
import { frDate } from "@/lib/pricing";
import type { Client, Devis } from "@/lib/types";

export default function Clients() {
  const router = useRouter();
  const [items, setItems] = useState<Client[] | null>(null);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    Promise.all([api<Client[]>("/api/clients"), api<Devis[]>("/api/devis")]).then(([c, d]) => { setItems(c); setDevis(d); }).catch((e) => setErr(e.message));
  }, []);

  const rows = (items || []).filter((c) => !q || `${c.societe} ${c.representant} ${c.contact}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.societe.localeCompare(b.societe, "fr"));
  const withoutContract = (items || []).filter((c) => !c.contratSigneLe).length;
  const nb = (c: Client) => devis.filter((d) => d.clientId === c.id).length;

  return (
    <main className="wrap">
      <div className="pagehead">
        <h2>Clients</h2>
        <Link className="btn primary" href="/clients/nouveau">+ Nouveau client</Link>
      </div>
      {err && <div className="banner err">{err}</div>}
      {withoutContract > 0 && <div className="banner info">{withoutContract} client{withoutContract > 1 ? "s" : ""} sans contrat-cadre signé : à régulariser avant la signature d'un bon de commande.</div>}
      <section className="panel">
        <div className="panel-head">
          <div className="toolbar"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une société, un contact…" aria-label="Rechercher" /></div>
        </div>
        <div className="tablebox">
          {items === null ? <p className="hint" style={{ padding: 18 }}>Chargement…</p> : !items.length ? (
            <div className="empty"><strong>Aucun client pour l'instant</strong><span>Une fiche client reprend les informations du contrat-cadre (société, siège, représentant) pour préremplir les bons de commande, et suit sa date de signature et de renouvellement.</span><Link className="btn primary" href="/clients/nouveau">Créer la première fiche</Link></div>
          ) : (
            <table className="list">
              <thead><tr><th>Client</th><th>Représentant</th><th>Contrat-cadre</th><th>Reconduction</th><th className="r">Devis</th></tr></thead>
              <tbody>
                {rows.map((c) => {
                  const info = contratInfo(c.contratSigneLe);
                  return (
                    <tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)}>
                      <td><div className="t-title"><Link href={`/clients/${c.id}`} onClick={(e) => e.stopPropagation()}>{c.societe}</Link></div><div className="t-sub">{[c.contact, c.email].filter(Boolean).join(" · ")}</div></td>
                      <td>{c.representant || <span className="t-sub">à compléter</span>}</td>
                      <td>{c.contratSigneLe ? <><span className="pill livre">Signé</span><div className="t-sub">le {frDate(c.contratSigneLe)}</div></> : <span className="pill cours">Non signé</span>}</td>
                      <td>{info ? <>{frDate(info.renouvellement)}<div className="t-sub">{info.preavisOuvert ? `préavis possible jusqu'au ${frDate(info.preavis)}` : "préavis de 2 mois dépassé"}</div></> : <span className="t-sub">—</span>}</td>
                      <td className="r">{nb(c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
