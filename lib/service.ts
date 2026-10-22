import "server-only";
import { mutate, newId, readAll } from "./store";
import { price, todayISO, type TypeId } from "./pricing";
import { defaultBdc } from "./legal";
import type { Bdc, Client, Devis, DevisVersion, Realisation } from "./types";

const DEVIS = "devis";
const REAL = "realisations";
const CLIENTS = "clients";

export class UserError extends Error {}

// ---------- devis ----------

export type VersionInput = Pick<DevisVersion, "type" | "duree" | "options" | "postprod" | "extras" | "remise" | "tva" | "validite" | "remarques">;
export type DevisInput = { projet: string; client: Devis["client"]; clientId?: string; version: VersionInput };

function buildVersion(v: number, input: VersionInput, by: string): DevisVersion {
  const { lines, total } = price({
    duree: +input.duree || 0,
    options: input.options || {},
    postprod: +input.postprod || 0,
    extras: (input.extras || []).map((e) => ({ desc: String(e.desc || ""), montant: +e.montant || 0 })),
    ajust: -(+input.remise || 0),
  });
  return {
    v,
    statut: "brouillon",
    type: input.type,
    duree: +input.duree || 0,
    options: input.options || {},
    postprod: +input.postprod || 0,
    extras: (input.extras || []).filter((e) => e.desc || +e.montant).map((e) => ({ desc: String(e.desc || ""), montant: +e.montant || 0 })),
    remise: +input.remise || 0,
    tva: input.tva == null ? 20 : +input.tva,
    validite: +input.validite || 30,
    remarques: String(input.remarques || ""),
    lines: lines.map((l) => (l.label === "Ajustement" ? { ...l, label: "Remise" } : l)),
    totalHT: total,
    createdAt: new Date().toISOString(),
    createdBy: by,
  };
}

function validate(input: DevisInput) {
  if (!input.projet?.trim()) throw new UserError("Indiquez le nom du projet.");
  if (!input.client?.societe?.trim() && !input.client?.nom?.trim()) throw new UserError("Indiquez le client (société ou contact).");
  if (!(+input.version.duree >= 0)) throw new UserError("La durée n'est pas valide.");
}

export const listDevis = () => readAll<Devis>(DEVIS);
export async function getDevis(id: string) {
  return (await listDevis()).find((d) => d.id === id) ?? null;
}

export async function createDevis(input: DevisInput, by: string): Promise<Devis> {
  validate(input);
  return mutate<Devis, Devis>(DEVIS, (doc) => {
    doc.seq = (doc.seq || 0) + 1;
    const now = new Date().toISOString();
    const year = now.slice(0, 4);
    const countYear = doc.items.filter((d) => d.numero.startsWith(`DEV-${year}-`)).length + 1;
    const devis: Devis = {
      id: newId(),
      numero: `DEV-${year}-${String(countYear).padStart(3, "0")}`,
      projet: input.projet.trim(),
      client: { nom: input.client.nom?.trim() || "", prenom: input.client.prenom?.trim() || "", service: input.client.service?.trim() || "", societe: input.client.societe?.trim() || "", email: input.client.email?.trim() || "" },
      clientId: input.clientId || undefined,
      statut: "brouillon",
      versions: [buildVersion(1, input.version, by)],
      createdAt: now,
      createdBy: by,
      updatedAt: now,
    };
    doc.items.push(devis);
    return devis;
  });
}

/**
 * Saving a draft overwrites it. Saving over a version that was already
 * sent (or decided) keeps that version untouched and opens a new one.
 */
export async function saveDevis(id: string, input: DevisInput, by: string): Promise<Devis> {
  validate(input);
  return mutate<Devis, Devis>(DEVIS, (doc) => {
    const d = doc.items.find((x) => x.id === id);
    if (!d) throw new UserError("Devis introuvable.");
    d.projet = input.projet.trim();
    d.clientId = input.clientId || undefined;
    d.client = { nom: input.client.nom?.trim() || "", prenom: input.client.prenom?.trim() || "", service: input.client.service?.trim() || "", societe: input.client.societe?.trim() || "", email: input.client.email?.trim() || "" };
    const cur = d.versions[d.versions.length - 1];
    if (cur.statut === "brouillon") {
      d.versions[d.versions.length - 1] = { ...buildVersion(cur.v, input.version, by), createdAt: cur.createdAt };
    } else {
      d.versions.push(buildVersion(cur.v + 1, input.version, by));
      d.statut = "brouillon";
    }
    d.updatedAt = new Date().toISOString();
    return d;
  });
}

export async function deleteDevis(id: string) {
  await mutate<Devis, void>(DEVIS, (doc) => {
    doc.items = doc.items.filter((d) => d.id !== id);
  });
}

export async function setDevisStatut(id: string, statut: "envoye" | "accepte" | "refuse" | "brouillon", by: string): Promise<Devis> {
  const devis = await mutate<Devis, Devis>(DEVIS, (doc) => {
    const d = doc.items.find((x) => x.id === id);
    if (!d) throw new UserError("Devis introuvable.");
    const cur = d.versions[d.versions.length - 1];
    const now = new Date().toISOString();
    if (statut === "envoye") cur.sentAt = now;
    if (statut === "accepte" || statut === "refuse") { cur.decidedAt = now; if (!cur.sentAt) cur.sentAt = now; }
    if (statut === "brouillon") { delete cur.decidedAt; }
    cur.statut = statut;
    d.statut = statut;
    d.updatedAt = now;
    return d;
  });
  if (statut === "accepte") {
    const realId = await upsertRealisationFromDevis(devis, by);
    if (realId !== devis.realisationId) {
      return mutate<Devis, Devis>(DEVIS, (doc) => {
        const d = doc.items.find((x) => x.id === id)!;
        d.realisationId = realId;
        return d;
      });
    }
  }
  return devis;
}

// ---------- réalisations ----------

export type RealisationInput = Omit<Realisation, "id" | "valeur" | "detail" | "createdAt" | "updatedAt">;

function computeRealisation(input: RealisationInput): Pick<Realisation, "valeur" | "detail" | "facture" | "ajust" | "entite" | "refFact"> {
  const ext = input.nature === "externe";
  const { lines, total } = price({ duree: +input.duree || 0, options: input.options || {}, postprod: +input.postprod || 0, ajust: ext ? +input.ajust || 0 : 0 });
  return {
    valeur: total,
    detail: lines,
    facture: ext ? +input.facture || total : 0,
    ajust: ext ? +input.ajust || 0 : 0,
    entite: input.nature === "interne" ? input.entite || "" : "",
    refFact: ext ? input.refFact || "" : "",
  };
}

function validateReal(r: RealisationInput) {
  if (!r.titre?.trim()) throw new UserError("Indiquez le titre de la vidéo.");
  if (!r.date) throw new UserError("Indiquez la date de livraison.");
  if (!r.demandeur?.trim()) throw new UserError(r.nature === "externe" ? "Indiquez le client." : r.nature === "partenaire" ? "Indiquez le partenaire." : "Indiquez le service demandeur.");
  if (!(+r.duree >= 0)) throw new UserError("La durée n'est pas valide.");
}

export const listRealisations = () => readAll<Realisation>(REAL);

export async function createRealisation(input: RealisationInput, by: string): Promise<Realisation> {
  validateReal(input);
  return mutate<Realisation, Realisation>(REAL, (doc) => {
    const now = new Date().toISOString();
    const r: Realisation = { ...input, ...computeRealisation(input), id: newId(), saisiPar: input.saisiPar || by, createdAt: now, updatedAt: now };
    doc.items.push(r);
    return r;
  });
}

export async function updateRealisation(id: string, input: RealisationInput): Promise<Realisation> {
  validateReal(input);
  return mutate<Realisation, Realisation>(REAL, (doc) => {
    const i = doc.items.findIndex((x) => x.id === id);
    if (i < 0) throw new UserError("Réalisation introuvable.");
    const old = doc.items[i];
    doc.items[i] = { ...old, ...input, ...computeRealisation(input), id, createdAt: old.createdAt, updatedAt: new Date().toISOString() };
    return doc.items[i];
  });
}

export async function deleteRealisation(id: string) {
  await mutate<Realisation, void>(REAL, (doc) => {
    doc.items = doc.items.filter((r) => r.id !== id);
  });
}

/** An accepted quote becomes (or updates) an external production in the register. */
async function upsertRealisationFromDevis(d: Devis, by: string): Promise<string> {
  const v = d.versions[d.versions.length - 1];
  return mutate<Realisation, string>(REAL, (doc) => {
    const now = new Date().toISOString();
    const existing = d.realisationId ? doc.items.find((r) => r.id === d.realisationId) : undefined;
    const base: RealisationInput = {
      nature: "externe",
      titre: d.projet,
      date: existing?.date || todayISO(),
      demandeur: d.client.societe || d.client.nom,
      type: v.type as TypeId,
      duree: v.duree,
      statut: existing?.statut || "cours",
      options: v.options,
      postprod: v.postprod,
      ajust: 0,
      facture: v.totalHT,
      refFact: `${d.numero} v${v.v}`,
      equipe: existing?.equipe || [],
      diffusion: existing?.diffusion || "Clients / commerciaux",
      formats: existing?.formats || 0,
      lien: existing?.lien || "",
      notes: existing?.notes || "",
      devisId: d.id,
      saisiPar: existing?.saisiPar || by,
    };
    const computed = computeRealisation(base);
    if (existing) {
      Object.assign(existing, base, computed, { facture: v.totalHT, updatedAt: now });
      return existing.id;
    }
    const r: Realisation = { ...base, ...computed, facture: v.totalHT, id: newId(), createdAt: now, updatedAt: now };
    doc.items.push(r);
    return r.id;
  });
}


// ---------- clients (fiches et contrat-cadre) ----------

export type ClientInput = Omit<Client, "id" | "createdAt" | "createdBy" | "updatedAt">;
const clean = (i: ClientInput): ClientInput => ({
  societe: String(i.societe || "").trim(),
  forme: String(i.forme || "").trim(),
  capital: String(i.capital || "").trim(),
  siege: String(i.siege || "").trim(),
  siren: String(i.siren || "").trim(),
  tva: String(i.tva || "").trim(),
  representant: String(i.representant || "").trim(),
  fonction: String(i.fonction || "").trim(),
  contact: String(i.contact || "").trim(),
  email: String(i.email || "").trim(),
  contratSigneLe: /^\d{4}-\d{2}-\d{2}$/.test(i.contratSigneLe || "") ? i.contratSigneLe : undefined,
  contratLien: String(i.contratLien || "").trim() || undefined,
  notes: String(i.notes || "").trim() || undefined,
});

export const listClients = () => readAll<Client>(CLIENTS);

export async function createClient(input: ClientInput, by: string): Promise<Client> {
  const c = clean(input);
  if (!c.societe) throw new UserError("Indiquez la dénomination sociale du client.");
  return mutate<Client, Client>(CLIENTS, (doc) => {
    if (doc.items.some((x) => x.societe.toLowerCase() === c.societe.toLowerCase())) throw new UserError("Un client porte déjà ce nom.");
    const now = new Date().toISOString();
    const client: Client = { ...c, id: newId(), createdAt: now, createdBy: by, updatedAt: now };
    doc.items.push(client);
    return client;
  });
}

export async function updateClient(id: string, input: ClientInput): Promise<Client> {
  const c = clean(input);
  if (!c.societe) throw new UserError("Indiquez la dénomination sociale du client.");
  return mutate<Client, Client>(CLIENTS, (doc) => {
    const i = doc.items.findIndex((x) => x.id === id);
    if (i < 0) throw new UserError("Client introuvable.");
    if (doc.items.some((x) => x.id !== id && x.societe.toLowerCase() === c.societe.toLowerCase())) throw new UserError("Un client porte déjà ce nom.");
    doc.items[i] = { ...doc.items[i], ...c, updatedAt: new Date().toISOString() };
    return doc.items[i];
  });
}

export async function deleteClient(id: string) {
  await mutate<Client, void>(CLIENTS, (doc) => { doc.items = doc.items.filter((x) => x.id !== id); });
}

// ---------- bon de commande (rattaché au devis accepté) ----------

const BDC_STR = (v: unknown) => String(v ?? "").trim();
const BDC_DATE = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
const BDC_LIST = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export async function saveBdc(id: string, input: Partial<Bdc> | null, by: string): Promise<Devis> {
  return mutate<Devis, Devis>(DEVIS, (doc) => {
    const d = doc.items.find((x) => x.id === id);
    if (!d) throw new UserError("Devis introuvable.");
    const now = new Date().toISOString();
    if (!d.bdc) {
      if (d.statut !== "accepte") throw new UserError("Le bon de commande se crée à partir d'un devis accepté.");
      d.bdc = defaultBdc(d.versions[d.versions.length - 1], d.projet, by);
    } else if (d.bdc.signeLe) {
      throw new UserError("Le bon de commande est signé : rouvrez-le pour le modifier.");
    }
    if (input) {
      const p = input.planning || ({} as Bdc["planning"]);
      d.bdc = {
        ...d.bdc,
        objet: BDC_LIST(input.objet),
        objetAutre: BDC_STR(input.objetAutre),
        description: BDC_STR(input.description),
        date: BDC_DATE(input.date),
        horaires: BDC_STR(input.horaires),
        lieu: ["studio", "site", "autre"].includes(String(input.lieu)) ? (input.lieu as Bdc["lieu"]) : "",
        lieuAutre: BDC_STR(input.lieuAutre),
        moyens: BDC_LIST(input.moyens),
        moyensAutres: BDC_STR(input.moyensAutres),
        livrables: BDC_LIST(input.livrables),
        livrablesDescription: BDC_STR(input.livrablesDescription),
        planning: { tournage: BDC_DATE(p.tournage), provisoire: BDC_DATE(p.provisoire), validation: BDC_DATE(p.validation), finale: BDC_DATE(p.finale) },
      };
    }
    d.bdc.updatedAt = now;
    d.updatedAt = now;
    return d;
  });
}

/** Aligne le montant du bon de commande sur la dernière version acceptée du devis. */
export async function refreshBdc(id: string): Promise<Devis> {
  return mutate<Devis, Devis>(DEVIS, (doc) => {
    const d = doc.items.find((x) => x.id === id);
    if (!d?.bdc) throw new UserError("Pas de bon de commande pour ce devis.");
    if (d.bdc.signeLe) throw new UserError("Le bon de commande est signé : rouvrez-le avant de le modifier.");
    if (d.statut !== "accepte") throw new UserError("Acceptez d'abord la nouvelle version du devis.");
    d.bdc.v = d.versions[d.versions.length - 1].v;
    d.bdc.updatedAt = new Date().toISOString();
    return d;
  });
}

export async function signBdc(id: string, date: string | null): Promise<Devis> {
  return mutate<Devis, Devis>(DEVIS, (doc) => {
    const d = doc.items.find((x) => x.id === id);
    if (!d?.bdc) throw new UserError("Pas de bon de commande pour ce devis.");
    if (date === null) { delete d.bdc.signeLe; }
    else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new UserError("Indiquez la date de signature.");
      d.bdc.signeLe = date;
    }
    d.bdc.updatedAt = new Date().toISOString();
    return d;
  });
}
