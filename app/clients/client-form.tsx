"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { contratInfo } from "@/lib/legal";
import { frDate } from "@/lib/pricing";
import type { Client } from "@/lib/types";

type Form = Omit<Client, "id" | "createdAt" | "createdBy" | "updatedAt" | "contratSigneLe" | "contratLien" | "notes"> & { contratSigneLe: string; contratLien: string; notes: string };
const blank = (societe = ""): Form => ({ societe, forme: "", capital: "", siege: "", rcsVille: "", rcsNumero: "", representant: "", fonction: "", contact: "", email: "", contratSigneLe: "", contratLien: "", notes: "" });
const fromClient = (c: Client): Form => ({ ...blank(), ...c, contratSigneLe: c.contratSigneLe || "", contratLien: c.contratLien || "", notes: c.notes || "" });

function Inner({ id }: { id?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [form, setForm] = useState<Form>(() => blank(sp.get("societe") || ""));
  const [existing, setExisting] = useState<Client | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Client[]>("/api/clients").then((all) => {
      const c = all.find((x) => x.id === id);
      if (!c) throw new Error("Client introuvable.");
      setExisting(c); setForm(fromClient(c));
    }).catch((e) => setMsg({ t: e.message, ok: false })).finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const info = contratInfo(form.contratSigneLe || undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.societe.trim()) { setMsg({ t: "Il manque la dénomination sociale.", ok: false }); return; }
    setBusy(true); setMsg(null);
    try {
      if (id) {
        const c = await api<Client>(`/api/clients/${id}`, { method: "PUT", body: form });
        setExisting(c); setForm(fromClient(c)); setMsg({ t: "Fiche enregistrée.", ok: true });
      } else {
        await api<Client>("/api/clients", { method: "POST", body: form });
        router.push("/clients");
      }
    } catch (err) { setMsg({ t: (err as Error).message, ok: false }); } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try { await api(`/api/clients/${id}`, { method: "DELETE" }); router.push("/clients"); }
    catch (e) { setMsg({ t: (e as Error).message, ok: false }); setBusy(false); }
  }

  if (loading) return <main className="wrap"><p className="hint">Chargement…</p></main>;

  return (
    <main className="wrap">
      <div className="pagehead">
        <div>
          <Link href="/clients" className="hint">← Tous les clients</Link>
          <h2>{existing ? existing.societe : "Nouveau client"}</h2>
        </div>
      </div>
      <form className="panel" onSubmit={submit} noValidate>
        <div className="panel-body">
          <fieldset>
            <legend className="eyebrow">Société (pour le bon de commande)</legend>
            <label className="f"><span>Dénomination sociale <span className="req">*</span></span><input type="text" id="societe" value={form.societe} onChange={(e) => set("societe", e.target.value)} /></label>
            <div className="g2">
              <label className="f">Forme sociale<input type="text" id="forme" value={form.forme} onChange={(e) => set("forme", e.target.value)} placeholder="ex. société anonyme" /></label>
              <label className="f">Capital (en euros)<input type="text" id="capital" value={form.capital} onChange={(e) => set("capital", e.target.value)} placeholder="ex. 1 000 000" /></label>
            </div>
            <label className="f">Siège social<input type="text" id="siege" value={form.siege} onChange={(e) => set("siege", e.target.value)} placeholder="adresse complète" /></label>
            <div className="g2">
              <label className="f">RCS de (ville)<input type="text" id="rcsVille" value={form.rcsVille} onChange={(e) => set("rcsVille", e.target.value)} placeholder="ex. Paris" /></label>
              <label className="f">Numéro RCS<input type="text" id="rcsNumero" value={form.rcsNumero} onChange={(e) => set("rcsNumero", e.target.value)} placeholder="ex. 384 940 342" /></label>
            </div>
            <div className="g2">
              <label className="f">Représentée par<input type="text" id="representant" value={form.representant} onChange={(e) => set("representant", e.target.value)} /></label>
              <label className="f">Fonction<input type="text" id="fonction" value={form.fonction} onChange={(e) => set("fonction", e.target.value)} /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="eyebrow">Contact au quotidien</legend>
            <div className="g2">
              <label className="f">Nom<input type="text" id="contact" value={form.contact} onChange={(e) => set("contact", e.target.value)} /></label>
              <label className="f">E-mail<input type="email" id="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="eyebrow">Contrat-cadre</legend>
            <div className="g2">
              <label className="f">Date de signature<input type="date" id="contratSigneLe" value={form.contratSigneLe} onChange={(e) => set("contratSigneLe", e.target.value)} /></label>
              <label className="f">Lien vers le contrat signé<input type="url" id="contratLien" value={form.contratLien} onChange={(e) => set("contratLien", e.target.value)} placeholder="https://…" /></label>
            </div>
            {info ? (
              <p className="hint" style={{ margin: 0 }}>Un an, renouvelé tacitement : prochaine reconduction le <b>{frDate(info.renouvellement)}</b>. {info.preavisOuvert ? `Chaque partie peut y mettre fin avec 2 mois de préavis, donc avant le ${frDate(info.preavis)} pour cette échéance.` : "Le préavis de 2 mois pour cette échéance est dépassé."}</p>
            ) : (
              <p className="hint" style={{ margin: 0 }}>Pas encore signé : le bon de commande s'appuie sur ce contrat. Le contrat lui-même reste le document du service juridique.</p>
            )}
            <label className="f">Notes<textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>
          </fieldset>

          <div className="actions">
            <button className="btn primary" type="submit" disabled={busy}>{id ? "Enregistrer" : "Créer la fiche"}</button>
            {msg && <span className={`msg ${msg.ok ? "ok" : "bad"}`} role="status">{msg.t}</span>}
            {id && (!confirmDel ? (
              <button type="button" className="btn small danger" onClick={() => setConfirmDel(true)}>Supprimer</button>
            ) : (
              <><span className="msg bad">Supprimer cette fiche ? Les devis existants gardent le nom du client.</span>
                <button type="button" className="btn small danger" onClick={remove} disabled={busy}>Oui, supprimer</button>
                <button type="button" className="btn small" onClick={() => setConfirmDel(false)}>Annuler</button></>
            ))}
          </div>
        </div>
      </form>
    </main>
  );
}

export default function ClientForm({ id }: { id?: string }) {
  return <Suspense fallback={<main className="wrap"><p className="hint">Chargement…</p></main>}><Inner id={id} /></Suspense>;
}
