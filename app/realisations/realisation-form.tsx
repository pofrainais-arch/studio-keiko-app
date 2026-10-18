"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { OPTIONS, TYPES, defaultOptions, eur, fmtMin, parseDuree, price, todayISO, type OptionId, type TypeId } from "@/lib/pricing";
import type { Realisation } from "@/lib/types";

type Form = {
  nature: "interne" | "externe";
  titre: string; date: string; demandeur: string; entite: string;
  type: TypeId; duree: string; statut: "livre" | "cours";
  options: Partial<Record<OptionId, boolean>>;
  postprod: string; ajust: string; facture: string; refFact: string;
  equipe: string; diffusion: string; formats: string; lien: string; notes: string;
};

const blank = (nature: Form["nature"] = "interne"): Form => ({
  nature, titre: "", date: todayISO(), demandeur: "", entite: "", type: "studio", duree: "", statut: "livre",
  options: defaultOptions("studio"), postprod: "", ajust: "", facture: "", refFact: "",
  equipe: "", diffusion: "", formats: "", lien: "", notes: "",
});

const fromReal = (r: Realisation): Form => ({
  nature: r.nature, titre: r.titre, date: r.date, demandeur: r.demandeur, entite: r.entite || "",
  type: r.type, duree: r.duree ? fmtMin(r.duree) : "", statut: r.statut, options: { ...r.options },
  postprod: r.postprod ? String(r.postprod) : "", ajust: r.ajust ? String(r.ajust) : "",
  facture: r.nature === "externe" && r.facture !== r.valeur ? String(r.facture) : "", refFact: r.refFact || "",
  equipe: (r.equipe || []).join(", "), diffusion: r.diffusion || "", formats: r.formats ? String(r.formats) : "",
  lien: r.lien || "", notes: r.notes || "",
});

const DIFFUSIONS = ["Intranet", "LinkedIn", "Site Ofi Invest", "Événement / plénière", "Clients / commerciaux", "Autre"];

export default function RealisationForm({ id }: { id?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(blank);
  const [existing, setExisting] = useState<Realisation | null>(null);
  const [all, setAll] = useState<Realisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    api<Realisation[]>("/api/realisations")
      .then((items) => {
        setAll(items);
        if (id) {
          const r = items.find((x) => x.id === id);
          if (r) { setExisting(r); setForm(fromReal(r)); setMoreOpen(!!(r.equipe?.length || r.diffusion || r.formats || r.lien || r.notes)); } else setMsg({ t: "Réalisation introuvable.", ok: false });
        } else {
          let nature: Form["nature"] = "interne";
          try { nature = (localStorage.getItem("keiko-nature") as Form["nature"]) || "interne"; } catch {}
          setForm(blank(nature));
        }
      })
      .catch((e) => setMsg({ t: e.message, ok: false }))
      .finally(() => setLoading(false));
  }, [id]);

  const ext = form.nature === "externe";
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const duree = parseDuree(form.duree);
  const opts = ext ? form.options : defaultOptions(form.type);
  const calc = useMemo(
    () => price({ duree: isNaN(duree) ? 0 : duree, options: opts, postprod: +form.postprod || 0, ajust: ext ? +form.ajust || 0 : 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duree, JSON.stringify(opts), form.postprod, form.ajust, ext]
  );
  const demandeurs = Array.from(new Set(all.filter((r) => r.nature === form.nature).map((r) => r.demandeur).filter(Boolean))).sort();
  const entites = Array.from(new Set(all.map((r) => r.entite).filter(Boolean) as string[])).sort();

  function setNature(n: Form["nature"]) {
    try { localStorage.setItem("keiko-nature", n); } catch {}
    setForm((f) => ({ ...f, nature: n, options: n === "interne" ? defaultOptions(f.type) : f.options }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const miss: string[] = [];
    if (!form.titre.trim()) miss.push("le titre");
    if (!form.date) miss.push("la date");
    if (!form.demandeur.trim()) miss.push(ext ? "le client" : "le service demandeur");
    if (isNaN(duree) || duree < 0) miss.push("la durée (ex. 12 ou 12:30)");
    if (miss.length) { setMsg({ t: `Il manque ${miss.join(", ")}.`, ok: false }); return; }
    const body = {
      nature: form.nature, titre: form.titre.trim(), date: form.date, demandeur: form.demandeur.trim(), entite: ext ? "" : form.entite.trim(),
      type: form.type, duree, statut: form.statut, options: opts, postprod: +form.postprod || 0,
      ajust: ext ? +form.ajust || 0 : 0, facture: ext ? +form.facture || 0 : 0, refFact: ext ? form.refFact.trim() : "",
      equipe: form.equipe.split(",").map((s) => s.trim()).filter(Boolean), diffusion: form.diffusion,
      formats: +form.formats || 0, lien: form.lien.trim(), notes: form.notes.trim(), devisId: existing?.devisId,
    };
    setBusy(true); setMsg(null);
    try {
      if (id) {
        const r = await api<Realisation>(`/api/realisations/${id}`, { method: "PUT", body });
        setExisting(r); setForm(fromReal(r)); setMsg({ t: "Modifications enregistrées.", ok: true });
      } else {
        const r = await api<Realisation>("/api/realisations", { method: "POST", body });
        setAll((a) => [...a, r]);
        setForm((f) => ({ ...blank(f.nature) }));
        setMsg({ t: `« ${r.titre} » enregistrée (${ext ? `${eur(r.facture)} HT facturés` : `${eur(r.valeur)} HT de valeur interne`}). Vous pouvez saisir la suivante.`, ok: true });
      }
    } catch (err) { setMsg({ t: (err as Error).message, ok: false }); } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try { await api(`/api/realisations/${id}`, { method: "DELETE" }); router.push("/realisations"); }
    catch (e) { setMsg({ t: (e as Error).message, ok: false }); setBusy(false); }
  }

  if (loading) return <main className="wrap"><p className="hint">Chargement…</p></main>;

  return (
    <main className="wrap">
      <div className="pagehead">
        <div>
          <Link href="/realisations" className="hint">← Toutes les réalisations</Link>
          <h2>{existing ? existing.titre : "Nouvelle réalisation"}</h2>
        </div>
        {existing?.devisId && <Link className="btn small" href={`/devis/${existing.devisId}`}>Voir le devis d'origine</Link>}
      </div>

      <section className="split">
        <form className="panel" onSubmit={submit} noValidate>
          <div className="panel-body">
            <fieldset>
              <legend className="eyebrow">L'essentiel</legend>
              <div className="seg" role="radiogroup" aria-label="Nature de la réalisation">
                <button type="button" role="radio" data-nature="interne" aria-checked={!ext} onClick={() => setNature("interne")}><b>Interne</b><span>Service Ofi Invest · non facturée</span></button>
                <button type="button" role="radio" data-nature="externe" aria-checked={ext} onClick={() => setNature("externe")}><b>Externe</b><span>Client · facturée</span></button>
              </div>
              <label className="f"><span>Titre de la vidéo <span className="req">*</span></span>
                <input type="text" id="titre" value={form.titre} onChange={(e) => set("titre", e.target.value)} placeholder="ex. Interview CIO, perspectives marchés T4" />
              </label>
              <div className="g2">
                <label className="f"><span>{ext ? "Client (société)" : "Service demandeur"} <span className="req">*</span></span>
                  <input type="text" id="demandeur" list="demandeurs" value={form.demandeur} onChange={(e) => set("demandeur", e.target.value)} placeholder={ext ? "ex. Cabinet Bertrand Patrimoine" : "ex. Communication corporate"} />
                  <datalist id="demandeurs">{demandeurs.map((d) => <option key={d} value={d} />)}</datalist>
                </label>
                {!ext && (
                  <label className="f">Entité
                    <input type="text" id="entite" list="entites" value={form.entite} onChange={(e) => set("entite", e.target.value)} placeholder="ex. Ofi Invest Asset Management" />
                    <datalist id="entites">{entites.map((d) => <option key={d} value={d} />)}</datalist>
                  </label>
                )}
              </div>
              <div className="chips" role="group" aria-label="Type de réalisation">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" className="chip" aria-pressed={form.type === t.id}
                    onClick={() => setForm((f) => ({ ...f, type: t.id, options: defaultOptions(t.id) }))}>{t.label}</button>
                ))}
              </div>
              <div className="g3">
                <label className="f"><span>Date de livraison <span className="req">*</span></span><input type="date" id="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></label>
                <label className="f"><span>Durée de la vidéo finale <span className="req">*</span></span>
                  <input type="text" className="dur" id="duree" inputMode="decimal" value={form.duree} onChange={(e) => set("duree", e.target.value)} placeholder="ex. 12 ou 12:30" />
                </label>
                <label className="f">Statut
                  <select id="statut" value={form.statut} onChange={(e) => set("statut", e.target.value as Form["statut"])}><option value="livre">Livré</option><option value="cours">En cours</option></select>
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend className="eyebrow">{ext ? "Chiffrage, grille du studio (HT)" : "Temps passé"}</legend>
              {ext && (
                <div className="checks">
                  {OPTIONS.map((o) => (
                    <label key={o.id} className="check">
                      <input type="checkbox" checked={!!form.options[o.id]} onChange={(e) => set("options", { ...form.options, [o.id]: e.target.checked })} />
                      <span>{o.label}</span><span className="p">{o.price != null ? eur(o.price) : "selon durée"}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="g2">
                <label className="f">Heures de post-production<input type="number" id="postprod" min="0" step="0.5" value={form.postprod} onChange={(e) => set("postprod", e.target.value)} placeholder="0" /></label>
                {ext && <label className="f">Ajustement (€ HT)<input type="number" id="ajust" step="10" value={form.ajust} onChange={(e) => set("ajust", e.target.value)} placeholder="0" /></label>}
              </div>
              {ext && (
                <div className="g2">
                  <label className="f">Montant facturé HT<input type="number" id="facture" min="0" step="10" value={form.facture} onChange={(e) => set("facture", e.target.value)} placeholder={eur(calc.total)} /><span className="hint">Laissez vide si identique au chiffrage.</span></label>
                  <label className="f">N° de devis ou de facture<input type="text" id="refFact" value={form.refFact} onChange={(e) => set("refFact", e.target.value)} /></label>
                </div>
              )}
            </fieldset>

            <details className="more" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
              <summary>Détails pour les statistiques</summary>
              <div>
                <div className="g2">
                  <label className="f">Équipe (prénoms, séparés par des virgules)<input type="text" id="equipe" value={form.equipe} onChange={(e) => set("equipe", e.target.value)} placeholder="ex. Léa, Karim" /></label>
                  <label className="f">Diffusion
                    <select id="diffusion" value={form.diffusion} onChange={(e) => set("diffusion", e.target.value)}>
                      <option value="">Non précisé</option>{DIFFUSIONS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </label>
                </div>
                <div className="g2">
                  <label className="f">Déclinaisons livrées (formats, langues)<input type="number" id="formats" min="0" value={form.formats} onChange={(e) => set("formats", e.target.value)} placeholder="0" /></label>
                  <label className="f">Lien vers la vidéo<input type="url" id="lien" value={form.lien} onChange={(e) => set("lien", e.target.value)} placeholder="https://…" /></label>
                </div>
                <label className="f">Notes<textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>
              </div>
            </details>

            <div className="actions">
              <button type="submit" className="btn primary" disabled={busy}>{id ? "Enregistrer les modifications" : "Enregistrer"}</button>
              {msg && <span className={`msg ${msg.ok ? "ok" : msg.ok === false ? "bad" : ""}`} role="status">{msg.t}</span>}
            </div>
            {id && (
              <div className="actions" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                {!confirmDel ? <button type="button" className="btn small danger" onClick={() => setConfirmDel(true)}>Supprimer</button> : (
                  <><span className="msg bad">Supprimer cette réalisation ?</span>
                    <button type="button" className="btn small danger" onClick={remove} disabled={busy}>Oui, supprimer</button>
                    <button type="button" className="btn small" onClick={() => setConfirmDel(false)}>Annuler</button></>
                )}
              </div>
            )}
          </div>
        </form>

        <aside className="panel sticky" aria-label="Valorisation">
          <div className="total">
            <span className="eyebrow">{ext ? "Chiffrage HT" : "Valeur interne HT"}</span>
            <span className="amt" style={{ color: ext ? "var(--accent)" : "var(--int)" }}>{eur(ext && +form.facture ? +form.facture : calc.total)}</span>
          </div>
          <div className="panel-body" style={{ gap: 12 }}>
            <p className="hint" style={{ margin: 0 }}>{ext ? "Montant facturé au client, selon la grille du studio sauf montant saisi." : "Non facturée : ce que la vidéo aurait coûté au tarif du studio."}</p>
            <table className="lines"><tbody>
              {calc.lines.length ? calc.lines.map((l, i) => (
                <tr key={i}><td>{l.label}{l.sub && <span className="sub">{l.sub}</span>}</td><td className="r">{eur(l.amount)}</td></tr>
              )) : <tr><td className="hint">Choisissez un type et une durée.</td><td /></tr>}
            </tbody></table>
          </div>
        </aside>
      </section>
    </main>
  );
}
