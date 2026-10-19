"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { OPTIONS, TYPES, defaultOptions, eur, fmtMin, frDate, parseDuree, price, type OptionId, type TypeId } from "@/lib/pricing";
import { STATUT_LABEL, type Client, type Devis } from "@/lib/types";

type Form = {
  projet: string;
  clientId: string;
  client: { nom: string; prenom: string; service: string; societe: string; email: string };
  type: TypeId;
  duree: string;
  options: Partial<Record<OptionId, boolean>>;
  postprod: string;
  extras: { desc: string; montant: string }[];
  remise: string;
  tva: string;
  validite: string;
  remarques: string;
};

const blank = (): Form => ({
  projet: "",
  clientId: "",
  client: { nom: "", prenom: "", service: "", societe: "", email: "" },
  type: "studio",
  duree: "",
  options: defaultOptions("studio"),
  postprod: "",
  extras: [],
  remise: "",
  tva: "20",
  validite: "30",
  remarques: "",
});

function fromDevis(d: Devis): Form {
  const v = d.versions[d.versions.length - 1];
  return {
    projet: d.projet,
    clientId: d.clientId || "",
    client: { prenom: "", service: "", ...d.client },
    type: v.type,
    duree: v.duree ? fmtMin(v.duree) : "",
    options: { ...v.options },
    postprod: v.postprod ? String(v.postprod) : "",
    extras: v.extras.map((e) => ({ desc: e.desc, montant: String(e.montant) })),
    remise: v.remise ? String(v.remise) : "",
    tva: String(v.tva),
    validite: String(v.validite),
    remarques: v.remarques,
  };
}

function toPayload(f: Form, clientId = "") {
  return {
    projet: f.projet,
    clientId,
    client: f.client,
    version: {
      type: f.type,
      duree: parseDuree(f.duree) || 0,
      options: f.options,
      postprod: +f.postprod.replace(",", ".") || 0,
      extras: f.extras.map((e) => ({ desc: e.desc, montant: +e.montant.replace(",", ".") || 0 })),
      remise: +f.remise.replace(",", ".") || 0,
      tva: f.tva === "" ? 20 : +f.tva.replace(",", "."),
      validite: +f.validite || 30,
      remarques: f.remarques,
    },
  };
}

export default function DevisEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [devis, setDevis] = useState<Devis | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [saved, setSaved] = useState<string>(JSON.stringify(blank()));
  const [loading, setLoading] = useState(!!id);
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => { api<Client[]>("/api/clients").then(setClients).catch(() => {}); }, []);

  useEffect(() => {
    if (!id) return;
    api<Devis>(`/api/devis/${id}`)
      .then((d) => { setDevis(d); const f = fromDevis(d); setForm(f); setSaved(JSON.stringify(f)); })
      .catch((e) => setMsg({ t: e.message, ok: false }))
      .finally(() => setLoading(false));
  }, [id]);

  const dirty = JSON.stringify(form) !== saved;
  const societeKey = form.client.societe.trim().toLowerCase();
  const matched = clients.find((c) => c.id === form.clientId) || (societeKey ? clients.find((c) => c.societe.trim().toLowerCase() === societeKey) : undefined);
  const payload = toPayload(form, matched?.id || "");
  const calc = useMemo(
    () => price({ duree: payload.version.duree, options: payload.version.options, postprod: payload.version.postprod, extras: payload.version.extras, ajust: -payload.version.remise }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(payload.version)]
  );
  const tvaAmt = (calc.total * (payload.version.tva || 0)) / 100;
  const cur = devis?.versions[devis.versions.length - 1];
  const locked = !!cur && cur.statut !== "brouillon";

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setClient = (k: keyof Form["client"], v: string) => setForm((f) => ({ ...f, clientId: k === "societe" ? "" : f.clientId, client: { ...f.client, [k]: v } }));
  function pickClient(cid: string) {
    const c = clients.find((x) => x.id === cid);
    if (!c) { set("clientId", ""); return; }
    setForm((f) => ({ ...f, clientId: c.id, client: { ...f.client, societe: c.societe, nom: c.contact || f.client.nom, email: c.email || f.client.email } }));
  }

  async function save() {
    if (isNaN(parseDuree(form.duree)) && form.duree.trim()) { setMsg({ t: "La durée n'est pas valide (ex. 12 ou 12:30).", ok: false }); return; }
    setBusy(true); setMsg(null);
    try {
      const d = id
        ? await api<Devis>(`/api/devis/${id}`, { method: "PUT", body: { action: "save", data: payload } })
        : await api<Devis>("/api/devis", { method: "POST", body: payload });
      const newVersion = locked;
      setDevis(d); const f = fromDevis(d); setForm(f); setSaved(JSON.stringify(f));
      setMsg({ t: newVersion ? `Version ${d.versions.length} créée, la version envoyée est conservée.` : "Devis enregistré.", ok: true });
      if (!id) router.replace(`/devis/${d.id}`);
    } catch (e) {
      setMsg({ t: (e as Error).message, ok: false });
    } finally { setBusy(false); }
  }

  async function setStatut(action: "envoye" | "accepte" | "refuse") {
    if (!id) return;
    setBusy(true); setMsg(null);
    try {
      const d = await api<Devis>(`/api/devis/${id}`, { method: "PUT", body: { action } });
      setDevis(d);
      setMsg({
        t: action === "accepte" ? "Devis accepté : la réalisation a été ajoutée au registre." : action === "envoye" ? "Devis marqué comme envoyé. Toute modification créera une nouvelle version." : "Devis marqué comme refusé.",
        ok: true,
      });
    } catch (e) { setMsg({ t: (e as Error).message, ok: false }); } finally { setBusy(false); }
  }

  async function remove() {
    if (!id) return;
    setBusy(true);
    try { await api(`/api/devis/${id}`, { method: "DELETE" }); router.push("/devis"); }
    catch (e) { setMsg({ t: (e as Error).message, ok: false }); setBusy(false); }
  }

  function emailText() {
    const c = form.client;
    const L: string[] = [];
    L.push(`Objet : Devis ${devis?.numero ?? ""}${cur ? ` (v${cur.v})` : ""} – ${form.projet || "votre projet vidéo"}`, "");
    L.push(c.prenom || c.nom ? `Bonjour ${c.prenom || c.nom.split(" ")[0]},` : "Bonjour,", "");
    L.push(`Merci pour votre confiance. Vous trouverez ci-dessous notre proposition pour « ${form.projet || "votre projet"} ».`, "");
    calc.lines.forEach((l) => L.push(`  • ${l.label}${l.sub ? ` (${l.sub})` : ""} : ${eur(l.amount, true)}`));
    L.push("", `Total HT : ${eur(calc.total, true)}`, `TVA (${payload.version.tva} %) : ${eur(tvaAmt, true)}`, `Total TTC : ${eur(calc.total + tvaAmt, true)}`, "");
    L.push(`Ce devis est valable ${payload.version.validite} jours. N'hésitez pas à revenir vers moi pour tout ajustement.`, "", "Bien à vous,", "Studio vidéo Keiko – Ofi Invest");
    return L.join("\n");
  }
  async function copyEmail() {
    try { await navigator.clipboard.writeText(emailText()); setMsg({ t: "Texte de l'e-mail copié.", ok: true }); }
    catch { setMsg({ t: "Copie impossible depuis ce navigateur.", ok: false }); }
  }

  if (loading) return <main className="wrap"><p className="hint">Chargement du devis…</p></main>;

  return (
    <main className="wrap">
      <div className="pagehead">
        <div>
          <Link href="/devis" className="hint">← Tous les devis</Link>
          <h2>{devis ? `${devis.numero} · ${devis.projet}` : "Nouveau devis"}</h2>
        </div>
        {devis && cur && (
          <span className={`pill ${devis.statut}`}>{STATUT_LABEL[devis.statut]} · version {cur.v}</span>
        )}
      </div>

      {locked && (
        <div className="banner info">
          La version {cur!.v} est {STATUT_LABEL[cur!.statut].toLowerCase()}e et reste conservée telle quelle. Si vous modifiez le devis, l'enregistrement créera une version {cur!.v + 1}.
        </div>
      )}

      <section className="split">
        <div className="panel">
          <div className="panel-body">
            <fieldset>
              <legend className="eyebrow">Client et projet</legend>
              <label className="f"><span>Nom du projet <span className="req">*</span></span>
                <input type="text" id="projet" value={form.projet} onChange={(e) => set("projet", e.target.value)} placeholder="ex. Interview expert, allocation d'actifs 2026" />
              </label>
              {clients.length > 0 && (
                <label className="f">Client enregistré
                  <select id="clientId" value={matched?.id || ""} onChange={(e) => pickClient(e.target.value)}>
                    <option value="">Autre client (saisie libre)</option>
                    {[...clients].sort((a, b) => a.societe.localeCompare(b.societe, "fr")).map((c) => <option key={c.id} value={c.id}>{c.societe}</option>)}
                  </select>
                </label>
              )}
              <div className="g3">
                <label className="f"><span>Société <span className="req">*</span></span><input type="text" id="societe" value={form.client.societe} onChange={(e) => setClient("societe", e.target.value)} /></label>
                <label className="f">Service<input type="text" id="service" value={form.client.service} onChange={(e) => setClient("service", e.target.value)} /></label>
                <label className="f">E-mail<input type="email" id="email" value={form.client.email} onChange={(e) => setClient("email", e.target.value)} /></label>
              </div>
              <div className="g3">
                <label className="f">Prénom<input type="text" id="prenom" value={form.client.prenom} onChange={(e) => setClient("prenom", e.target.value)} /></label>
                <label className="f">Nom<input type="text" id="contact" value={form.client.nom} onChange={(e) => setClient("nom", e.target.value)} /></label>
              </div>
              {form.client.societe.trim() && (!matched ? (
                <p className="banner warn" style={{ margin: 0 }}><span>Ce client n'a pas de fiche : le contrat-cadre n'est pas suivi. <Link href={`/clients/nouveau?societe=${encodeURIComponent(form.client.societe.trim())}`} target="_blank">Créer la fiche</Link></span></p>
              ) : !matched.contratSigneLe ? (
                <p className="banner warn" style={{ margin: 0 }}><span>Aucun contrat-cadre signé pour {matched.societe} : à faire signer avant le bon de commande. <Link href={`/clients/${matched.id}`} target="_blank">Ouvrir la fiche</Link></span></p>
              ) : (
                <p className="hint" style={{ margin: 0 }}>Contrat-cadre signé le {frDate(matched.contratSigneLe)}.</p>
              ))}
            </fieldset>

            <fieldset>
              <legend className="eyebrow">Prestation</legend>
              <div className="chips" role="group" aria-label="Type de réalisation">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" className="chip" aria-pressed={form.type === t.id}
                    onClick={() => setForm((f) => ({ ...f, type: t.id, options: defaultOptions(t.id) }))}>{t.label}</button>
                ))}
              </div>
              <div className="g3">
                <label className="f">Durée de la vidéo finale
                  <input type="text" className="dur" id="duree" inputMode="decimal" value={form.duree} onChange={(e) => set("duree", e.target.value)} placeholder="ex. 12 ou 12:30" />
                </label>
                <label className="f">Post-production (heures)
                  <input type="number" id="postprod" min="0" step="0.5" value={form.postprod} onChange={(e) => set("postprod", e.target.value)} placeholder="0" />
                </label>
                <label className="f">Remise (€ HT)
                  <input type="number" id="remise" min="0" step="10" value={form.remise} onChange={(e) => set("remise", e.target.value)} placeholder="0" />
                </label>
              </div>
              <div className="checks">
                {OPTIONS.map((o) => (
                  <label key={o.id} className="check">
                    <input type="checkbox" checked={!!form.options[o.id]} onChange={(e) => set("options", { ...form.options, [o.id]: e.target.checked })} />
                    <span>{o.label}<span className="hint" style={{ display: "block" }}>{o.desc}</span></span>
                    <span className="p">{o.price != null ? eur(o.price) : "selon durée"}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="eyebrow">Prestations additionnelles</legend>
              {form.extras.map((x, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 120px auto", gap: 8 }}>
                  <input type="text" aria-label="Description" value={x.desc} placeholder="ex. Sous-titrage anglais" onChange={(e) => set("extras", form.extras.map((y, j) => (j === i ? { ...y, desc: e.target.value } : y)))} />
                  <input type="number" aria-label="Montant HT" value={x.montant} placeholder="0" onChange={(e) => set("extras", form.extras.map((y, j) => (j === i ? { ...y, montant: e.target.value } : y)))} />
                  <button type="button" className="btn small danger" aria-label="Retirer la ligne" onClick={() => set("extras", form.extras.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <div><button type="button" className="btn small" onClick={() => set("extras", [...form.extras, { desc: "", montant: "" }])}>+ Ajouter une ligne</button></div>
            </fieldset>

            <fieldset>
              <legend className="eyebrow">Conditions</legend>
              <div className="g2">
                <label className="f">TVA (%)<input type="number" id="tva" min="0" step="0.1" value={form.tva} onChange={(e) => set("tva", e.target.value)} /></label>
                <label className="f">Validité (jours)<input type="number" id="validite" min="1" value={form.validite} onChange={(e) => set("validite", e.target.value)} /></label>
              </div>
              <label className="f">Remarques affichées sur le devis<textarea id="remarques" value={form.remarques} onChange={(e) => set("remarques", e.target.value)} placeholder="ex. Tournage prévu le 12 novembre, 2 intervenants." /></label>
            </fieldset>

            <div className="actions">
              <button className="btn primary" onClick={save} disabled={busy || (!!id && !dirty)}>
                {!id ? "Créer le devis" : locked && dirty ? `Enregistrer en version ${cur!.v + 1}` : "Enregistrer"}
              </button>
              {msg && <span className={`msg ${msg.ok ? "ok" : msg.ok === false ? "bad" : ""}`} role="status">{msg.t}</span>}
            </div>
          </div>
        </div>

        <aside className="sticky" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="panel">
            <div className="total"><span className="eyebrow">Total HT</span><span className="amt">{eur(calc.total)}</span></div>
            <div className="panel-body" style={{ gap: 10 }}>
              <table className="lines"><tbody>
                {calc.lines.length ? calc.lines.map((l, i) => (
                  <tr key={i}><td>{l.label}{l.sub && <span className="sub">{l.sub}</span>}</td><td className="r">{eur(l.amount, true)}</td></tr>
                )) : <tr><td className="hint">Choisissez une prestation et une durée.</td><td /></tr>}
                <tr className="sum"><td>TVA {payload.version.tva} %</td><td className="r">{eur(tvaAmt, true)}</td></tr>
                <tr className="grand"><td>Total TTC</td><td className="r">{eur(calc.total + tvaAmt, true)}</td></tr>
              </tbody></table>
            </div>
          </div>

          {devis && cur && (
            <div className="panel">
              <div className="panel-head"><h3>Suivi du devis</h3></div>
              <div className="panel-body" style={{ gap: 12 }}>
                {dirty && <p className="hint" style={{ margin: 0 }}>Enregistrez vos modifications avant de changer le statut.</p>}
                <div className="actions">
                  {cur.statut === "brouillon" && <button className="btn" disabled={busy || dirty} onClick={() => setStatut("envoye")}>Marquer comme envoyé</button>}
                  {cur.statut !== "accepte" && <button className="btn ok" disabled={busy || dirty} onClick={() => setStatut("accepte")}>Accepté</button>}
                  {cur.statut !== "refuse" && cur.statut !== "accepte" && <button className="btn danger" disabled={busy || dirty} onClick={() => setStatut("refuse")}>Refusé</button>}
                </div>
                {devis.realisationId && (
                  <p style={{ margin: 0, fontSize: 13 }}>Réalisation créée dans le registre : <Link href={`/realisations/${devis.realisationId}`}>la compléter</Link>.</p>
                )}
                {(cur.statut === "accepte" || devis.bdc) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                    <div className="eyebrow">Bon de commande</div>
                    {devis.bdc ? (
                      <>
                        <div><span className={`pill ${devis.bdc.signeLe ? "livre" : "cours"}`}>{devis.bdc.signeLe ? `Signé le ${frDate(devis.bdc.signeLe)}` : "À signer"}</span>
                          {devis.bdc.v !== cur.v && <span className="t-sub" style={{ display: "block" }}>repose sur la version {devis.bdc.v} du devis</span>}</div>
                        <div className="actions">
                          <Link className="btn small" href={`/devis/${devis.id}/bdc`}>Ouvrir</Link>
                          <Link className="btn small" href={`/devis/${devis.id}/bdc/imprimer`} target="_blank">Imprimer / PDF</Link>
                        </div>
                      </>
                    ) : (
                      <div className="actions"><Link className="btn small primary" href={`/devis/${devis.id}/bdc`}>Créer le bon de commande</Link></div>
                    )}
                    {cur.statut === "accepte" && !matched?.contratSigneLe && <p className="hint" style={{ margin: 0 }}>Aucun contrat-cadre signé suivi pour ce client.</p>}
                  </div>
                )}
                <div className="actions">
                  <Link className="btn small" href={`/devis/${devis.id}/imprimer?v=${cur.v}`} target="_blank">Imprimer / PDF</Link>
                  <button className="btn small" onClick={copyEmail}>Copier l'e-mail</button>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>Versions</div>
                  <div className="versions">
                    {[...devis.versions].reverse().map((v) => (
                      <div key={v.v} className={`ver ${v.v === cur.v ? "cur" : ""}`}>
                        <span><span className="vn">v{v.v}</span> · <span className={`pill ${v.statut}`}>{STATUT_LABEL[v.statut]}</span>
                          <span className="t-sub" style={{ display: "block" }}>
                            {v.sentAt ? `envoyée le ${frDate(v.sentAt)}` : `créée le ${frDate(v.createdAt)}`} par {v.createdBy}
                          </span>
                        </span>
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span className="mono">{eur(v.totalHT)}</span>
                          <Link className="btn small" href={`/devis/${devis.id}/imprimer?v=${v.v}`} target="_blank">Voir</Link>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="actions" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  {!confirmDel ? (
                    <button className="btn small danger" onClick={() => setConfirmDel(true)}>Supprimer le devis</button>
                  ) : (
                    <>
                      <span className="msg bad">Supprimer définitivement ce devis et ses versions ?</span>
                      <button className="btn small danger" onClick={remove} disabled={busy}>Oui, supprimer</button>
                      <button className="btn small" onClick={() => setConfirmDel(false)}>Annuler</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
