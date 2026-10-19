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

export type Client = {
  id: string;
  societe: string;
  forme: string; // forme sociale, ex. « société anonyme »
  capital: string;
  siege: string;
  rcsVille: string;
  rcsNumero: string;
  representant: string;
  fonction: string;
  contact: string;
  email: string;
  contratSigneLe?: string; // date de signature du contrat-cadre (ISO)
  contratLien?: string; // lien vers le contrat signé (GED, Drive, SharePoint)
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type Bdc = {
  v: number; // version du devis sur laquelle repose le bon de commande
  objet: string[];
  objetAutre: string;
  description: string;
  date: string;
  horaires: string;
  lieu: "" | "studio" | "site" | "autre";
  lieuAutre: string;
  moyens: string[];
  moyensAutres: string;
  livrables: string[];
  livrablesDescription: string;
  planning: { tournage: string; provisoire: string; validation: string; finale: string };
  signeLe?: string; // le bon de commande devient ferme à la signature des deux parties
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type Devis = {
  id: string;
  numero: string;
  projet: string;
  client: { nom: string; prenom?: string; service?: string; societe: string; email: string };
  clientId?: string;
  statut: DevisStatut;
  versions: DevisVersion[];
  realisationId?: string;
  bdc?: Bdc;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type Realisation = {
  id: string;
  nature: "interne" | "externe" | "partenaire";
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
  facture: number; // HT facturé (externe seulement; partenaire = prestation non facturée)
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
