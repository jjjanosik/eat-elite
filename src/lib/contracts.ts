import type {
  HistoryDetailItem,
  HistoryListItem,
  HistoryProductDetail,
  HistoryProductSummary,
  HistorySnapshot,
  ScanResult,
} from '@/lib/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asBoolean(value: unknown): boolean {
  return Boolean(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function asObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function parseHistoryProductSummary(raw: unknown): HistoryProductSummary | null {
  if (!isRecord(raw)) return null;
  return {
    name: asNullableString(raw.name),
    brands: asNullableString(raw.brands),
    image_url: asNullableString(raw.image_url),
  };
}

export function parseHistoryListResponse(raw: unknown): HistoryListItem[] {
  const response = isRecord(raw) ? raw : {};
  const itemsRaw = Array.isArray(response.items) ? response.items : [];

  return itemsRaw.map((item): HistoryListItem => {
    const row = isRecord(item) ? item : {};
    return {
      id: asString(row.id),
      score: asNumber(row.score),
      created_at: asString(row.created_at),
      product: parseHistoryProductSummary(Array.isArray(row.product) ? row.product[0] : row.product),
    };
  });
}

function parseHistorySnapshot(raw: unknown): HistorySnapshot {
  const snapshot = isRecord(raw) ? raw : {};
  return {
    product_name: asNullableString(snapshot.product_name),
    product_brands: asNullableString(snapshot.product_brands),
    product_image_url: asNullableString(snapshot.product_image_url),
    ingredients_text: asNullableString(snapshot.ingredients_text),
    serving_size: asNullableString(snapshot.serving_size),
    serving_quantity: asNullableNumber(snapshot.serving_quantity),
    package_quantity: asNullableString(snapshot.package_quantity),
    nutrition_data_per: asNullableString(snapshot.nutrition_data_per),
    nutriments: isRecord(snapshot.nutriments) ? snapshot.nutriments : undefined,
    additives_tags: Array.isArray(snapshot.additives_tags) ? asStringArray(snapshot.additives_tags) : undefined,
    additives_count:
      snapshot.additives_count === undefined ? undefined : asNumber(snapshot.additives_count, 0),
    nutrition_score:
      snapshot.nutrition_score === undefined ? undefined : asNumber(snapshot.nutrition_score, 0),
    additives_score:
      snapshot.additives_score === undefined ? undefined : asNumber(snapshot.additives_score, 0),
    score_features: isRecord(snapshot.score_features) ? snapshot.score_features : undefined,
    weights: isRecord(snapshot.weights) ? snapshot.weights : undefined,
    goals: Array.isArray(snapshot.goals) ? asStringArray(snapshot.goals) : undefined,
    outcomes: Array.isArray(snapshot.outcomes) ? asStringArray(snapshot.outcomes) : undefined,
  };
}

function parseHistoryProductDetail(raw: unknown, snapshot: HistorySnapshot): HistoryProductDetail | null {
  if (!isRecord(raw)) return null;
  return {
    name: snapshot.product_name ?? asNullableString(raw.name),
    brands: snapshot.product_brands ?? asNullableString(raw.brands),
    image_url: snapshot.product_image_url ?? asNullableString(raw.image_url),
    ingredients_text: snapshot.ingredients_text ?? asNullableString(raw.ingredients_text),
    serving_size: snapshot.serving_size ?? asNullableString(raw.serving_size),
    serving_quantity: snapshot.serving_quantity ?? asNullableNumber(raw.serving_quantity),
    package_quantity: snapshot.package_quantity ?? asNullableString(raw.package_quantity),
    nutrition_data_per: snapshot.nutrition_data_per ?? asNullableString(raw.nutrition_data_per),
    additives_tags: snapshot.additives_tags ?? asStringArray(raw.additives_tags),
    nutriments: snapshot.nutriments ?? asObject(raw.nutriments),
  };
}

export function parseHistoryDetailResponse(raw: unknown): HistoryDetailItem {
  const row = isRecord(raw) ? raw : {};
  const snapshot = parseHistorySnapshot(row.inputs_snapshot);
  const productRaw = Array.isArray(row.product) ? row.product[0] : row.product;

  return {
    id: asString(row.id),
    barcode: asString(row.barcode),
    score: asNumber(row.score),
    score_version: asNumber(row.score_version),
    weights_version: asNumber(row.weights_version),
    ai_response: asNullableString(row.ai_response),
    ai_cached: asBoolean(row.ai_cached),
    created_at: asString(row.created_at),
    inputs_snapshot: snapshot,
    product: parseHistoryProductDetail(productRaw, snapshot),
  };
}

export function parseScanResult(raw: unknown): ScanResult {
  const data = isRecord(raw) ? raw : {};
  const productRaw = asObject(data.product);
  return {
    history_id: asString(data.history_id),
    product: {
      barcode: asString(productRaw.barcode),
      name: asNullableString(productRaw.name),
      brands: asNullableString(productRaw.brands),
      image_url: asNullableString(productRaw.image_url),
      ingredients_text: asNullableString(productRaw.ingredients_text),
      serving_size: asNullableString(productRaw.serving_size),
      serving_quantity: asNullableNumber(productRaw.serving_quantity),
      package_quantity: asNullableString(productRaw.package_quantity),
      nutrition_data_per: asNullableString(productRaw.nutrition_data_per),
      additives_tags: asStringArray(productRaw.additives_tags),
      nutriments: asObject(productRaw.nutriments),
    },
    score: asNumber(data.score),
    ai_response: asNullableString(data.ai_response),
    ai_error: asNullableString(data.ai_error),
    ai_cached: asBoolean(data.ai_cached),
    ai_pending: asBoolean(data.ai_pending),
    score_version: asNumber(data.score_version, 1),
    weights_version: asNumber(data.weights_version, 1),
  };
}
