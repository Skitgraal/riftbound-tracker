/** Types de la veille des sorties (Module 1). Voir docs/DATA_MODEL.md. */

export type Tier = 'official' | 'relay' | 'leak';
export const TIER_RANK: Record<Tier, number> = { official: 3, relay: 2, leak: 1 };

export type ProductType = 'display' | 'booster' | 'box_exclusive' | 'deck' | 'bundle' | 'draw_product' | 'other';
export type Status = 'rumor' | 'announced' | 'preorder' | 'released' | 'cancelled';
export type DatePrecision = 'day' | 'month' | 'quarter' | 'unknown';

export interface Money {
  amount: number;
  currency: string;
}

export interface FuzzyDate {
  /** AAAA-MM-JJ, AAAA-MM ou AAAA-Qn selon la précision. */
  value: string;
  precision: DatePrecision;
}

export interface Draw {
  opensAt: string | null;
  closesAt: string | null;
  url: string | null;
  region: string | null;
}

export interface Offer {
  source: string;
  url: string;
  price: Money | null;
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown';
  lastSeenAt: string;
}

/** Source déclarée dans config/sources.yml. */
export interface SourceConfig {
  id: string;
  name: string;
  kind: 'riot-news' | 'riot-merch' | 'shopify';
  tier: Tier;
  url: string;
  enabled: boolean;
  /** Catégories d'articles ignorées (riot-news). */
  skip_categories?: string[];
  /** Collections Shopify lues (shopify) : seulement celles de Riftbound, jamais tout le catalogue. */
  collections?: string[];
  /** Devise des prix de la boutique (shopify : la liste JSON ne la donne pas). */
  currency?: string;
}

/** Article ou page récupéré par un collecteur, avant extraction. */
export interface Doc {
  source: SourceConfig;
  url: string;
  title: string;
  publishedAt: string | null;
  /** Texte brut (titre, chapeau, corps) : c'est ce qui est envoyé au LLM. */
  text: string;
  image: string | null;
  /** Le corps complet a été lu (sinon `text` ne contient que le titre et le chapeau). */
  full?: boolean;
}

/** Valeur vue par une source à un instant donné. */
export interface Claim {
  field: 'name' | 'set' | 'type' | 'msrp' | 'releaseDate' | 'announcedAt' | 'status' | 'image' | 'imageFallback' | 'officialUrl' | 'draw';
  value: unknown;
  source: string;
  tier: Tier;
  url: string;
  evidence: string;
  observedAt: string;
  invalid?: boolean;
}

/** Produit tel que vu dans un document (sortie de l'extraction ou d'un collecteur structuré). */
export interface Sighting {
  name: string;
  set: string | null;
  type: ProductType;
  msrp: Money | null;
  releaseDate: FuzzyDate | null;
  status: Status | null;
  draws: Draw[];
  image: string | null;
  /** Visuel de secours (bannière d'article) : utilisé seulement si aucune vraie photo du produit n'existe. */
  fallbackImage?: string | null;
  evidence: string;
  offer?: Omit<Offer, 'lastSeenAt'>;
}

export interface Product {
  slug: string;
  name: string;
  set: string | null;
  type: ProductType;
  language: 'EN';
  msrp: Money | null;
  announcedAt: string | null;
  releaseDate: FuzzyDate | null;
  status: Status;
  reliability: 'confirmed' | 'unconfirmed';
  /** Copie locale du visuel, relative à data/ (`media/…`) ; vide = « image à venir ». */
  image: string | null;
  /** Adresse d'origine du visuel retenu par les affirmations (à recopier s'il change). */
  imageSource: string | null;
  officialUrl: string | null;
  cmProductId: number | null;
  possibleDuplicateOf: string | null;
  draws: Draw[];
  offers: Offer[];
  claims: Claim[];
  createdAt: string;
  updatedAt: string;
}
