import type { Line, OptionId, TypeId } from "./pricing";

export type DevisStatut = "brouillon" | "envoye" | "accepte" | "refuse";

export type DevisVersion = {
  v: number;
  statut: DevisStatut;
  type: TypeId;
  duree: number;
  options: Partial<Record<OptionId, boolean>>;
  postprod: number;
  extras: { desc: string; montant: number }[];
  remise: number; // € HT, positive = remise
  tva: number; // %
  validite: number; // jours
  remarques: string;
  lines: Line[];
  totalHT: number;
  createdAt: string;
  createdBy: string;
  sentAt?: string;
  decidedAt?: string;
};

export type Devis = {
  id: string;
  numero: string;
  projet: string;
  client: { nom: string; societe: string; email: string };
  statut: DevisStatut;
  versions: DevisVersion[];
  realisationId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type Realisation = {
  id: string;
  nature: "interne" | "externe";
  titre: string;
  date: string;
  demandeur: string;
  entite?: string;
  type: TypeId;
  duree: number;
  statut: "livre" | "cours";
  options: Partial<Record<OptionId, boolean>>;
  postprod: number;
  ajust: number;
  facture: number; // HT facturé (externe)
  refFact?: string;
  equipe: string[];
  diffusion?: string;
  formats?: number;
  lien?: string;
  notes?: string;
  valeur: number; // valorisation grille HT, figée à l'enregistrement
  detail: Line[];
  devisId?: string;
  saisiPar?: string;
  createdAt: string;
  updatedAt: string;
};

export const STATUT_LABEL: Record<DevisStatut, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
};
