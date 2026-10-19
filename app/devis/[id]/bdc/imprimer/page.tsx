import { notFound } from "next/navigation";
import { getDevis, listClients } from "@/lib/service";
import { BDC_LIEU, BDC_LIVRABLES, BDC_MOYENS, BDC_OBJET, BDC_TITRE, OFI, bdcNumero, clientPhrase } from "@/lib/legal";
import { eur, frDate } from "@/lib/pricing";
import PrintButton from "../../imprimer/print-button";

export const dynamic = "force-dynamic";

const box = (on: boolean) => (on ? "☒" : "☐");
const dots = (v: string, fallback = "..............................................") => v || fallback;
const date = (v: string) => (v ? frDate(v) : "___ / ___ / _____");

export default async function ImprimerBdc({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDevis(id);
  if (!d || !d.bdc) notFound();
  const b = d.bdc;
  const ver = d.versions.find((x) => x.v === b.v) ?? d.versions[d.versions.length - 1];
  const clients = await listClients();
  const client = clients.find((c) => c.id === d.clientId) || clients.find((c) => c.societe.trim().toLowerCase() === d.client.societe.trim().toLowerCase()) || null;
  const tva = (ver.totalHT * ver.tva) / 100;
  const nom = d.client.societe || d.client.nom;

  return (
    <main className="wrap">
      <div className="actions noprint" style={{ justifyContent: "space-between" }}>
        <span className="hint">Bon de commande {bdcNumero(d.numero)} · devis {d.numero} version {ver.v}{b.signeLe ? ` · signé le ${frDate(b.signeLe)}` : " · à signer"}</span>
        <PrintButton />
      </div>
      <article className="sheet">
        <div className="top">
          <div>
            <h3 style={{ fontSize: 18 }}>{BDC_TITRE}</h3>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>BON DE COMMANDE N° {bdcNumero(d.numero)}</div>
          </div>
        </div>

        <section>
          <p className="legal"><b>ENTRE</b></p>
          <p className="legal">{OFI.nom}, société anonyme dont le siège social est situé {OFI.siege}, immatriculée au RCS de Paris sous le numéro {OFI.rcsNumero}, représentée par {OFI.representant}, dûment habilité aux fins des présentes,</p>
          <p className="legal">Ci-après le « Prestataire » ou « Ofi Invest AM »,</p>
          <p className="legal">D'une part,</p>
          <p className="legal"><b>ET</b></p>
          <p className="legal">{clientPhrase(client, nom)}</p>
          <p className="legal">Ci-après le « Client »,</p>
          <p className="legal">D'autre part,</p>
          <p className="legal">Ensemble les « Parties » ou individuellement une « Partie ».</p>
        </section>
        <section>
          <p className="legal">Les Parties ont conclu le {client?.contratSigneLe ? frDate(client.contratSigneLe) : "XX/XX/XXXX"} une convention cadre de prestations de services aux termes de laquelle Ofi Invest AM fournit au Client des prestations techniques, audiovisuelles, digitales et de post-production, réalisées au sein du Studio Keiko.</p>
          <p className="legal">En application de la convention cadre, les Parties ont signé le présent bon de commande.</p>
        </section>

        <section>
          <h4 className="sec">1. OBJET DE LA PRESTATION</h4>
          <div className="cbs">
            {BDC_OBJET.map((o) => <span key={o.id}>{box(b.objet.includes(o.id))} {o.label}</span>)}
            <span>{box(!!b.objetAutre)} Autre : {dots(b.objetAutre, "__________________")}</span>
          </div>
          <p className="legal"><b>Description détaillée :</b> {dots(b.description, "")}</p>
        </section>

        <section>
          <h4 className="sec">2. DATE ET HORAIRES</h4>
          <p className="legal">Date : {b.date ? frDate(b.date) : dots("")}</p>
          <p className="legal">Horaires réservés : {dots(b.horaires)}</p>
          <p className="legal">Lieu :</p>
          <div className="cbs">
            {BDC_LIEU.map((l) => <span key={l.id}>{box(b.lieu === l.id)} {l.label}{l.id === "autre" && b.lieu === "autre" && b.lieuAutre ? ` : ${b.lieuAutre}` : ""}</span>)}
          </div>
        </section>

        <section>
          <h4 className="sec">3. MOYENS MOBILISÉS</h4>
          <div className="cbs">{BDC_MOYENS.map((m) => <span key={m.id}>{box(b.moyens.includes(m.id))} {m.label}</span>)}</div>
          <p className="legal">Autres : {dots(b.moyensAutres)}</p>
        </section>

        <section>
          <h4 className="sec">4. LIVRABLES</h4>
          <div className="cbs">{BDC_LIVRABLES.map((l) => <span key={l.id}>{box(b.livrables.includes(l.id))} {l.label}</span>)}</div>
          <p className="legal">Description : {dots(b.livrablesDescription)}</p>
        </section>

        <section>
          <h4 className="sec">5. PLANNING</h4>
          <p className="legal">Tournage : {date(b.planning.tournage)}</p>
          <p className="legal">Version provisoire : {date(b.planning.provisoire)}</p>
          <p className="legal">Validation Client : {date(b.planning.validation)}</p>
          <p className="legal">Version finale : {date(b.planning.finale)}</p>
        </section>

        <section>
          <h4 className="sec">6. CONDITIONS FINANCIÈRES</h4>
          <p className="legal">Prestation : {d.projet}</p>
          <p className="legal">Montant total HT : <b>{eur(ver.totalHT, true)}</b></p>
          <p className="legal">TVA : <b>{eur(tva, true)}</b></p>
          <p className="legal">Montant TTC : <b>{eur(ver.totalHT + tva, true)}</b></p>
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>Détail du chiffrage (devis {d.numero}, version {ver.v})</th><th className="r">Détail</th><th className="r">Montant HT</th></tr></thead>
            <tbody>{ver.lines.map((l, i) => <tr key={i}><td>{l.label}</td><td className="r">{l.sub || ""}</td><td className="r">{eur(l.amount, true)}</td></tr>)}</tbody>
          </table>
        </section>

        <section>
          <div className="sign">
            <div><b>Pour le Client</b><span>Nom : {client?.representant || ""}</span><span>Fonction : {client?.fonction || ""}</span><span>Date :</span><span>Signature*</span></div>
            <div><b>Pour OFI INVEST AM</b><span>Nom :</span><span>Fonction :</span><span>Date :</span><span>Signature</span></div>
          </div>
          <p className="foot" style={{ border: 0, paddingTop: 4 }}>* précédée de la mention « bon pour acceptation »</p>
        </section>
      </article>
    </main>
  );
}
