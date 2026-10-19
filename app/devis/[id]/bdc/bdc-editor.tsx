"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { BDC_LIEU, BDC_LIVRABLES, BDC_MOYENS, BDC_OBJET, bdcNumero, defaultBdc } from "@/lib/legal";
import { eur, frDate, todayISO } from "@/lib/pricing";
import type { Bdc, Client, Devis } from "@/lib/types";

type Form = Pick<Bdc, "objet" | "objetAutre" | "description" | "date" | "horaires" | "lieu" | "lieuAutre" | "moyens" | "moyensAutres" | "livrables" | "livrablesDescription" | "planning">;
const pick = (b: Bdc): Form => ({ objet: b.objet, objetAutre: b.objetAutre, description: b.description, date: b.date, horaires: b.horaires, lieu: b.lieu, lieuAutre: b.lieuAutre, moyens: b.moyens, moyensAutres: b.moyensAutres, livrables: b.livrables, livrablesDescription: b.livrablesDescription, planning: b.planning });
const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

function Checks({ items, value, onChange }: { items: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
      {items.map((o) => (
        <label key={o.id} className="check"><input type="checkbox" checked={value.includes(o.id)} onChange={() => onChange(toggle(value, o.id))} /><span>{o.label}</span></label>
      ))}
    </div>
  );
}

export default function BdcEditor({ id }: { id: string }) {
  const [devis, setDevis] = useState<Devis | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState("");
  const [signDate, setSignDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function load(d: Devis) {
    setDevis(d);
    const f = d.bdc ? pick(d.bdc) : pick(defaultBdc(d.versions[d.versions.length - 1], d.projet, ""));
    setForm(f);
    setSaved(d.bdc ? JSON.stringify(f) : "");
  }
  useEffect(() => {
    Promise.all([api<Devis>(`/api/devis/${id}`), api<Client[]>("/api/clients")])
      .then(([d, c]) => { setClients(c); load(d); })
      .catch((e) => setMsg({ t: e.message, ok: false }))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="wrap"><p className="hint">Chargement…</p></main>;
  if (!devis || !form) return <main className="wrap"><div className="banner err">{msg?.t || "Devis introuvable."}</div></main>;

  const latest = devis.versions[devis.versions.length - 1];
  const bdc = devis.bdc;
  const ver = devis.versions.find((v) => v.v === (bdc?.v ?? latest.v)) ?? latest;
  const tva = (ver.totalHT * ver.tva) / 100;
  const signed = !!bdc?.signeLe;
  const dirty = !bdc || JSON.stringify(form) !== saved;
  const client = clients.find((c) => c.id === devis.clientId) || clients.find((c) => c.societe.trim().toLowerCase() === devis.client.societe.trim().toLowerCase());
  const cannotCreate = !bdc && devis.statut !== "accepte";
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setPlan = (k: keyof Form["planning"], v: string) => setForm((f) => (f ? { ...f, planning: { ...f.planning, [k]: v } } : f));

  async function run(action: string, extra: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null);
    try {
      const d = await api<Devis>(`/api/devis/${id}`, { method: "PUT", body: { action, ...extra } });
      load(d); setMsg({ t: ok, ok: true });
    } catch (e) { setMsg({ t: (e as Error).message, ok: false }); } finally { setBusy(false); }
  }

  return (
    <main className="wrap">
      <div className="pagehead">
        <div>
          <Link href={`/devis/${id}`} className="hint">← Devis {devis.numero}</Link>
          <h2>Bon de commande {bdcNumero(devis.numero)}</h2>
        </div>
        {bdc && <span className={`pill ${signed ? "livre" : "cours"}`}>{signed ? `Signé le ${frDate(bdc.signeLe!)}` : "À signer"}</span>}
      </div>

      {cannotCreate && <div className="banner warn"><span>Le bon de commande se crée à partir d'un devis accepté. <Link href={`/devis/${id}`}>Retour au devis</Link></span></div>}
      {!client?.contratSigneLe && <div className="banner warn"><span>{client ? `Aucun contrat-cadre signé pour ${client.societe}.` : "Ce client n'a pas de fiche, le contrat-cadre n'est donc pas suivi."} Le bon de commande s'appuie sur ce contrat. <Link href={client ? `/clients/${client.id}` : `/clients/nouveau?societe=${encodeURIComponent(devis.client.societe)}`}>{client ? "Ouvrir la fiche" : "Créer la fiche"}</Link></span></div>}
      {bdc && bdc.v !== latest.v && (
        <div className="banner info"><span>Le devis a évolué : sa version {latest.v} ({STATUT(latest.statut)}). Ce bon de commande reste sur la version {bdc.v} ({eur(ver.totalHT)} HT).</span>
          {devis.statut === "accepte" && !signed && <button className="btn small" disabled={busy} onClick={() => run("bdc-refresh", {}, `Montant aligné sur la version ${latest.v}.`)}>Passer sur la version {latest.v}</button>}
        </div>
      )}
      {signed && (
        <div className="banner info"><span>Ce bon de commande est ferme : les deux parties l'ont signé. Pour le modifier, rouvrez-le (une modification après validation peut donner lieu à facturation complémentaire, art. 4 du contrat).</span>
          <button className="btn small" disabled={busy} onClick={() => run("bdc-sign", { date: null }, "Bon de commande rouvert.")}>Rouvrir</button>
        </div>
      )}

      <section className="split">
        <div className="panel">
          <fieldset disabled={signed || cannotCreate} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div className="panel-body">
              <fieldset>
                <legend className="eyebrow">1. Objet de la prestation</legend>
                <Checks items={BDC_OBJET} value={form.objet} onChange={(v) => set("objet", v)} />
                <label className="f">Autre<input type="text" value={form.objetAutre} onChange={(e) => set("objetAutre", e.target.value)} /></label>
                <label className="f">Description détaillée<textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
              </fieldset>

              <fieldset>
                <legend className="eyebrow">2. Date et horaires</legend>
                <div className="g2">
                  <label className="f">Date<input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></label>
                  <label className="f">Horaires réservés<input type="text" value={form.horaires} onChange={(e) => set("horaires", e.target.value)} placeholder="ex. 9h30 – 12h30" /></label>
                </div>
                <div className="chips" role="group" aria-label="Lieu">
                  {BDC_LIEU.map((l) => <button key={l.id} type="button" className="chip" aria-pressed={form.lieu === l.id} onClick={() => set("lieu", form.lieu === l.id ? "" : l.id)}>{l.label}</button>)}
                </div>
                {form.lieu === "autre" && <label className="f">Précisez le lieu<input type="text" value={form.lieuAutre} onChange={(e) => set("lieuAutre", e.target.value)} /></label>}
              </fieldset>

              <fieldset>
                <legend className="eyebrow">3. Moyens mobilisés</legend>
                <Checks items={BDC_MOYENS} value={form.moyens} onChange={(v) => set("moyens", v)} />
                <label className="f">Autres<input type="text" value={form.moyensAutres} onChange={(e) => set("moyensAutres", e.target.value)} /></label>
              </fieldset>

              <fieldset>
                <legend className="eyebrow">4. Livrables</legend>
                <Checks items={BDC_LIVRABLES} value={form.livrables} onChange={(v) => set("livrables", v)} />
                <label className="f">Description<input type="text" value={form.livrablesDescription} onChange={(e) => set("livrablesDescription", e.target.value)} /></label>
              </fieldset>

              <fieldset>
                <legend className="eyebrow">5. Planning</legend>
                <div className="g2">
                  <label className="f">Tournage<input type="date" value={form.planning.tournage} onChange={(e) => setPlan("tournage", e.target.value)} /></label>
                  <label className="f">Version provisoire<input type="date" value={form.planning.provisoire} onChange={(e) => setPlan("provisoire", e.target.value)} /></label>
                  <label className="f">Validation Client<input type="date" value={form.planning.validation} onChange={(e) => setPlan("validation", e.target.value)} /></label>
                  <label className="f">Version finale<input type="date" value={form.planning.finale} onChange={(e) => setPlan("finale", e.target.value)} /></label>
                </div>
              </fieldset>

              <div className="actions">
                <button className="btn primary" disabled={busy || !dirty || cannotCreate} onClick={() => run("bdc-save", { data: form }, "Bon de commande enregistré.")}>{bdc ? "Enregistrer" : "Créer le bon de commande"}</button>
                {msg && <span className={`msg ${msg.ok ? "ok" : "bad"}`} role="status">{msg.t}</span>}
              </div>
            </div>
          </fieldset>
        </div>

        <aside className="sticky" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="panel">
            <div className="total"><span className="eyebrow">6. Conditions financières</span><span className="amt">{eur(ver.totalHT)}</span></div>
            <div className="panel-body" style={{ gap: 10 }}>
              <p className="hint" style={{ margin: 0 }}>Repris du devis {devis.numero}, version {ver.v}. Le détail du chiffrage est joint au bon de commande imprimé.</p>
              <table className="lines"><tbody>
                {ver.lines.map((l, i) => <tr key={i}><td>{l.label}{l.sub && <span className="sub">{l.sub}</span>}</td><td className="r">{eur(l.amount, true)}</td></tr>)}
                <tr className="sum"><td>Montant total HT</td><td className="r">{eur(ver.totalHT, true)}</td></tr>
                <tr className="sum"><td>TVA {ver.tva} %</td><td className="r">{eur(tva, true)}</td></tr>
                <tr className="grand"><td>Montant TTC</td><td className="r">{eur(ver.totalHT + tva, true)}</td></tr>
              </tbody></table>
            </div>
          </div>
          {bdc && (
            <div className="panel">
              <div className="panel-head"><h3>Signature</h3></div>
              <div className="panel-body" style={{ gap: 12 }}>
                {dirty && !signed && <p className="hint" style={{ margin: 0 }}>Enregistrez vos modifications avant d'imprimer ou de marquer comme signé.</p>}
                <div className="actions">
                  <Link className="btn small primary" aria-disabled={dirty} style={dirty ? { pointerEvents: "none", opacity: 0.5 } : undefined} href={`/devis/${id}/bdc/imprimer`} target="_blank">Imprimer / PDF</Link>
                </div>
                {!signed && (
                  <div className="actions">
                    <label className="f" style={{ flex: 1 }}>Signé par les deux parties le<input type="date" value={signDate} onChange={(e) => setSignDate(e.target.value)} /></label>
                    <button className="btn ok" disabled={busy || dirty || !signDate} onClick={() => run("bdc-sign", { date: signDate }, "Bon de commande marqué comme signé.")}>Marquer comme signé</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

const STATUT = (s: string) => ({ brouillon: "brouillon", envoye: "envoyée", accepte: "acceptée", refuse: "refusée" }[s] || s);
