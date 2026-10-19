// Textes et listes du bon de commande, repris du modèle du service juridique
// (« Bon de commande PS Studio - Ofi Invest AM - Client - Oct 2026 V.1 »).
// Si le juridique modifie le modèle, ce fichier est le seul à adapter.
import type { Bdc, Client, DevisVersion } from "./types";

export const BLANK = "[●]";

export const OFI = {
  nom: "OFI INVEST ASSET MANAGEMENT",
  siege: "127-129, quai du Président Roosevelt, 92130 Issy-les-Moulineaux",
  rcsNumero: "384 940 342",
  representant: "Guillaume Poli",
};

export const BDC_TITRE = "CONTRAT-CADRE DE PRESTATIONS DU STUDIO KEIKO";

export const BDC_OBJET = [
  { id: "studio", label: "Studio vidéo" },
  { id: "podcast", label: "Podcast" },
  { id: "captation", label: "Captation évènementielle" },
  { id: "streaming", label: "Streaming" },
  { id: "postprod", label: "Postproduction" },
];
export const BDC_LIEU = [
  { id: "studio", label: "Studio Keiko" },
  { id: "site", label: "Site Client" },
  { id: "autre", label: "Autre" },
] as const;
export const BDC_MOYENS = [
  { id: "realisateur", label: "Réalisateur" },
  { id: "technicien", label: "Technicien plateau" },
  { id: "monteur", label: "Monteur" },
  { id: "motion", label: "Motion designer" },
  { id: "streaming", label: "Streaming live" },
  { id: "podcast", label: "Studio podcast" },
  { id: "habillage", label: "Habillage graphique" },
  { id: "soustitrage", label: "Sous-titrage" },
  { id: "traduction", label: "Traduction" },
];
export const BDC_LIVRABLES = [
  { id: "mp4", label: "Fichier MP4" },
  { id: "podcast", label: "Podcast audio" },
  { id: "capsule", label: "Capsule vidéo" },
  { id: "replay", label: "Replay évènement" },
  { id: "extraits", label: "Extraits réseaux sociaux" },
  { id: "soustitres", label: "Sous-titres" },
  { id: "autre", label: "Autre" },
];

export const bdcNumero = (devisNumero: string) => devisNumero.replace(/^DEV/, "BDC");

/** Valeurs proposées à la création du bon de commande, d'après le devis accepté. */
export function defaultBdc(ver: DevisVersion, projet: string, by: string): Bdc {
  const objet = new Set<string>(), moyens = new Set<string>(["realisateur"]), livrables = new Set<string>();
  let lieu: Bdc["lieu"] = "studio";
  switch (ver.type) {
    case "studio": objet.add("studio"); moyens.add("technicien"); livrables.add("mp4"); break;
    case "mobile": objet.add("captation"); moyens.add("technicien"); livrables.add("mp4"); lieu = "site"; break;
    case "podcast": objet.add("podcast"); moyens.add("podcast"); livrables.add("podcast"); break;
    case "live": objet.add("streaming"); moyens.add("streaming"); moyens.add("technicien"); livrables.add("replay"); break;
    case "montage": objet.add("postprod"); moyens.delete("realisateur"); livrables.add("mp4"); break;
    case "motion": objet.add("postprod"); moyens.delete("realisateur"); moyens.add("motion"); livrables.add("capsule"); break;
    default: break;
  }
  if (+ver.postprod > 0) { objet.add("postprod"); moyens.add("monteur"); }
  const now = new Date().toISOString();
  return {
    v: ver.v,
    objet: [...objet],
    objetAutre: ver.type === "autre" ? "Autre prestation" : "",
    description: projet,
    date: "",
    horaires: "",
    lieu,
    lieuAutre: "",
    moyens: [...moyens],
    moyensAutres: "",
    livrables: [...livrables],
    livrablesDescription: "",
    planning: { tournage: "", provisoire: "", validation: "", finale: "" },
    createdAt: now,
    createdBy: by,
    updatedAt: now,
  };
}

/** Un contrat-cadre se renouvelle chaque année par tacite reconduction, résiliable avec 2 mois de préavis (art. 16). */
export function contratInfo(signeLe?: string, today = new Date()) {
  if (!signeLe) return null;
  const s = new Date(signeLe + "T00:00:00");
  if (isNaN(+s)) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let renouvellement = new Date(s.getFullYear() + 1, s.getMonth(), s.getDate());
  while (renouvellement <= t) renouvellement = new Date(renouvellement.getFullYear() + 1, renouvellement.getMonth(), renouvellement.getDate());
  const preavis = new Date(renouvellement.getFullYear(), renouvellement.getMonth() - 2, renouvellement.getDate());
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { renouvellement: iso(renouvellement), preavis: iso(preavis), preavisOuvert: t < preavis };
}

export const orBlank = (v?: string) => (v && v.trim() ? v.trim() : BLANK);

export function clientPhrase(c: Pick<Client, "societe" | "forme" | "capital" | "siege" | "rcsVille" | "rcsNumero" | "representant"> | null, fallbackName: string) {
  const nom = c?.societe?.trim() || fallbackName || "[Dénomination sociale]";
  return `${nom}, ${orBlank(c?.forme)} au capital de ${orBlank(c?.capital)} euros, dont le siège social est situé ${orBlank(c?.siege)}, immatriculée au RCS de ${orBlank(c?.rcsVille)} sous le numéro ${orBlank(c?.rcsNumero)}, représentée par ${orBlank(c?.representant)}, dûment habilité aux fins des présentes,`;
}
