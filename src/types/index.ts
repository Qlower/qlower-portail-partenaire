// ── Partner ───────────────────────────────────────────────────
export type ContratType = "affiliation" | "marque_blanche";
export type PartnerType = "cgp" | "agence-immo" | "apporteur" | "courtier" | "conciergerie" | "proptech" | "banque" | "influenceur" | "autre";
export type PartnerStatut = "en_attente" | "contrat_envoye" | "actif" | "suspendu";
export type LeadStage = "Abonne" | "Payeur" | "Non payeur";
export type LeadSource = "UTM" | "Manuel" | "Promo";
export type CommissionType = "souscription" | "annuelle" | "biens" | "pct_ca";

export interface Tranche {
  max: number;
  montant: number;
}

export interface CommissionRule {
  type: CommissionType;
  montant?: number;
  pct?: number;
  tranches?: Tranche[];
  actif: boolean;
}

export interface Partner {
  id: string;
  user_id: string | null;
  nom: string;
  contact_prenom: string | null;
  contact_nom: string | null;
  email: string | null;
  type: PartnerType;
  contrat: ContratType;
  code: string;
  utm: string;
  statut: PartnerStatut;
  active: boolean;
  metier: string | null;
  siret: string | null;
  tva: string | null;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  telephone: string | null;
  iban: string | null;
  bic: string | null;
  kbis_url: string | null;
  lien_envoye_le: string | null;
  leads: number;
  abonnes: number;
  biens_moyens: number;
  ca_par_client: number;
  comm_obj_annuel: number;
  comm_rules: CommissionRule[];
  hs_sync: boolean;
  brand_color: string;
  brand_logo: string;
  access_fee: number;
  created_at: string;
  updated_at: string;
}

// ── Lead ──────────────────────────────────────────────────────
export interface Lead {
  id: number;
  partner_id: string;
  nom: string;
  email: string | null;
  source: LeadSource;
  stage: LeadStage;
  mois: string | null;
  biens: number;
  hs_contact_id: string | null;
  commission_due: boolean;
  created_at: string;
  hs_deleted?: boolean;
  hs_deleted_at?: string | null;
  subscribed_at?: string | null;
  unsubscribed_at?: string | null;
  first_paid_at?: string | null;
}

// ── Stats ─────────────────────────────────────────────────────
export interface StatMonthly {
  id: number;
  partner_id: string;
  mois: string;
  leads: number;
  abonnes: number;
  created_at: string;
}

// ── Action ────────────────────────────────────────────────────
export type ActionType = "lien" | "contact" | "campagne" | "autre";

export interface PartnerAction {
  id: number;
  partner_id: string;
  type: ActionType;
  label: string;
  date: string;
  created_at: string;
}

// ── Referral ──────────────────────────────────────────────────
export interface Referral {
  id: number;
  partner_id: string;
  prenom: string;
  nom: string;
  email: string;
  tel: string | null;
  biens: string | null;
  comment: string | null;
  statut: string;
  hs_contact_id: string | null;
  created_at: string;
}

// ── Invoice ───────────────────────────────────────────────────
export type InvoiceStatus = "Payee" | "En attente" | "Annulee";

export interface Invoice {
  id: string;
  partner_id: string;
  date: string;
  montant: number;
  statut: InvoiceStatus;
  created_at: string;
}

// ── Commission Result ─────────────────────────────────────────
export interface CommissionDetail {
  label: string;
  calc: string;
  montant: number;
}

export interface CommissionResult {
  total: number;
  detail: CommissionDetail[];
}

// ── API Payloads ──────────────────────────────────────────────
export interface CreateContactPayload {
  prenom: string;
  nom: string;
  email: string;
  tel?: string;
  biens?: string;
  comment?: string;
  partnerUtm: string;
  partnerId: string;
}

export interface OnboardPartnerPayload {
  partnerName: string;
  utmValue: string;
}
