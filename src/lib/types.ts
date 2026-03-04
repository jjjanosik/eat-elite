export type Sex = 'male' | 'female' | 'other';
export type DietType = 'classic' | 'vegetarian' | 'vegan' | 'pescetarian';

export type UserProfile = {
  user_id: string;
  sex: Sex | null;
  birthdate: string | null;
  diet_type: DietType | null;
  diet_goals: string[];
  outcomes: string[];
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type UserScoreWeights = {
  id: string;
  user_id: string;
  score_version: number;
  weights_version: number;
  nutrition_weight: number;
  additives_weight: number;
  nutrition_subweights: Record<string, number>;
  additives_subweights: Record<string, number>;
  created_at: string;
};

export type Product = {
  barcode: string;
  name: string | null;
  brands: string | null;
  image_url: string | null;
  ingredients_text: string | null;
  serving_size: string | null;
  serving_quantity: number | null;
  package_quantity: string | null;
  nutrition_data_per: string | null;
  additives_tags: string[];
  nutriments: Record<string, unknown>;
};

export type ScanResult = {
  history_id: string;
  product: Product;
  score: number;
  ai_response: string | null;
  ai_error: string | null;
  ai_cached: boolean;
  ai_pending: boolean;
  score_version: number;
  weights_version: number;
};

export type HistoryProductSummary = {
  name: string | null;
  brands: string | null;
  image_url: string | null;
};

export type HistorySnapshot = {
  product_name?: string | null;
  product_brands?: string | null;
  product_image_url?: string | null;
  ingredients_text?: string | null;
  serving_size?: string | null;
  serving_quantity?: number | null;
  package_quantity?: string | null;
  nutrition_data_per?: string | null;
  nutriments?: Record<string, unknown>;
  additives_tags?: string[];
  additives_count?: number;
  nutrition_score?: number;
  additives_score?: number;
  score_features?: Record<string, unknown>;
  weights?: Record<string, unknown>;
  goals?: string[];
  outcomes?: string[];
};

export type HistoryListItem = {
  id: string;
  score: number;
  created_at: string;
  product: HistoryProductSummary | null;
};

export type HistoryProductDetail = HistoryProductSummary & {
  ingredients_text: string | null;
  serving_size: string | null;
  serving_quantity: number | null;
  package_quantity: string | null;
  nutrition_data_per: string | null;
  additives_tags: string[];
  nutriments: Record<string, unknown>;
};

export type HistoryDetailItem = {
  id: string;
  barcode: string;
  score: number;
  score_version: number;
  weights_version: number;
  ai_response: string | null;
  ai_cached: boolean;
  created_at: string;
  inputs_snapshot: HistorySnapshot;
  product: HistoryProductDetail | null;
};

export type OnboardingAnswers = {
  sex: Sex | null;
  birthdate: string;
  diet_type: DietType | null;
  diet_goals: string[];
  outcomes: string[];
  notifications_enabled: boolean;
};
