import { notFound } from "next/navigation";
import { getDevis } from "@/lib/service";
import { eur, frDate } from "@/lib/pricing";
import { STATUT_LABEL } from "@/lib/types";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

export default async function Imprimer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const { v } = await searchParams;
  const d = await getDevis(id);
  if (!d) notFound();
  const ver = d.versions.find((x) => String(x.v) === v) ?? d.versions[d.versions.length - 1];
  const tva = (ver.totalHT * ver.tva) / 100;
  const date = ver.sentAt || ver.createdAt;
  const isLatest = ver.v === d.versions[d.versions.length - 1].v;
  return (
    <main className="wrap">
      <div className="actions noprint" style={{ justifyContent: "space-between" }}>
        <span className="hint">
          Version {ver.v} sur {d.versions.length} · {STATUT_LABEL[ver.statut]}{!isLatest && " · version antérieure, conservée pour l'historique"}
        </span>
        <PrintButton />
      </div>
      <article className="sheet">
        <div className="top">
          <div>
            <h3>DEVIS</h3>
            <div style={{ fontSize: 13, color: "#5F5C55" }}>{d.projet}</div>
          </div>
          <div className="meta">
            <div>N° <b>{d.numero}{d.versions.length > 1 ? ` · v${ver.v}` : ""}</b></div>
            <div>Date : {frDate(date)}</div>
            <div>Validité : {ver.validite} jours</div>
          </div>
        </div>
        <div className="parties">
          <div>
            <h4>Émetteur</h4>
            <p><b>Studio vidéo Keiko</b></p>
            <p>Ofi Invest</p>
            <p>Dossier suivi par {ver.createdBy}</p>
          </div>
          <div>
            <h4>Client</h4>
            <p><b>{d.client.societe || d.client.nom}</b></p>
            {d.client.societe && (d.client.nom || d.client.prenom) && <p>{[d.client.prenom, d.client.nom].filter(Boolean).join(" ")}</p>}
            {d.client.service && <p>{d.client.service}</p>}
            {d.client.email && <p>{d.client.email}</p>}
          </div>
        </div>
        <table>
          <thead><tr><th>Désignation</th><th className="r">Détail</th><th className="r">Montant HT</th></tr></thead>
          <tbody>
            {ver.lines.map((l, i) => (
              <tr key={i}><td>{l.label}</td><td className="r">{l.sub || ""}</td><td className="r">{eur(l.amount, true)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td /><td className="r">Total HT</td><td className="r">{eur(ver.totalHT, true)}</td></tr>
            <tr><td /><td className="r">TVA {ver.tva} %</td><td className="r">{eur(tva, true)}</td></tr>
            <tr className="grand"><td /><td className="r">Total TTC</td><td className="r">{eur(ver.totalHT + tva, true)}</td></tr>
          </tfoot>
        </table>
        {ver.remarques && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: 0 }}>{ver.remarques}</p>}
        <p className="foot">
          Captation facturée par tranche dégressive cumulée selon la durée de la vidéo finale : 0–15 min à 60 €/min, 15–30 min à 40 €/min, 30–45 min à 10 €/min, au-delà 5 €/min.
          Devis valable {ver.validite} jours à compter du {frDate(date)}. Bon pour accord : date et signature.
        </p>
      </article>
    </main>
  );
}
