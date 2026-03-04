export type OffProduct = {
  barcode: string;
  name: string | null;
  brands: string | null;
  image_url: string | null;
  ingredients_text: string | null;
  additives_tags: string[];
  nutriments: Record<string, unknown>;
  serving_size: string | null;
  serving_quantity: number | null;
  package_quantity: string | null;
  nutrition_data_per: string | null;
  off_payload: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function formatPackageQuantity(product: Record<string, unknown>): string | null {
  const directQuantity = asNullableString(product.quantity);
  if (directQuantity) return directQuantity;

  const productQuantity = asNullableNumber(product.product_quantity);
  const productQuantityUnit = asNullableString(product.product_quantity_unit);
  if (productQuantity === null || !productQuantityUnit) return null;
  return `${productQuantity} ${productQuantityUnit}`;
}

export function extractServingInfoFromOffPayload(payload: unknown): {
  serving_size: string | null;
  serving_quantity: number | null;
  package_quantity: string | null;
  nutrition_data_per: string | null;
} {
  const payloadRecord = isRecord(payload) ? payload : {};
  const product = (isRecord(payloadRecord.product) ? payloadRecord.product : payloadRecord) as Record<string, unknown>;
  const nutriments = isRecord(product.nutriments) ? product.nutriments : {};

  return {
    serving_size: asNullableString(product.serving_size),
    serving_quantity: asNullableNumber(product.serving_quantity) ?? asNullableNumber(nutriments.serving_quantity),
    package_quantity: formatPackageQuantity(product),
    nutrition_data_per: asNullableString(product.nutrition_data_per),
  };
}

export async function fetchOpenFoodFactsProduct(barcode: string): Promise<OffProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const start = Date.now();
  const response = await fetch(url);
  const latencyMs = Date.now() - start;

  if (!response.ok) {
    console.error('OFF fetch failed', { barcode, status: response.status, latencyMs });
    throw new Error('open_food_facts_fetch_failed');
  }

  const payload = await response.json();
  const product = payload?.product;

  if (!product) {
    console.warn('OFF product not found', { barcode, latencyMs });
    return null;
  }

  console.log('OFF fetch success', { barcode, latencyMs });

  const servingInfo = extractServingInfoFromOffPayload(payload);

  return {
    barcode,
    name: product.product_name ?? null,
    brands: product.brands ?? null,
    image_url: product.image_front_url ?? product.image_url ?? null,
    ingredients_text: product.ingredients_text ?? null,
    additives_tags: Array.isArray(product.additives_tags) ? product.additives_tags : [],
    nutriments: typeof product.nutriments === 'object' && product.nutriments ? product.nutriments : {},
    serving_size: servingInfo.serving_size,
    serving_quantity: servingInfo.serving_quantity,
    package_quantity: servingInfo.package_quantity,
    nutrition_data_per: servingInfo.nutrition_data_per,
    off_payload: payload,
  };
}
