export type OffProduct = {
  barcode: string;
  name: string | null;
  brands: string | null;
  image_url: string | null;
  ingredients_text: string | null;
  additives_tags: string[];
  nutriments: Record<string, unknown>;
  off_payload: Record<string, unknown>;
};

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

  return {
    barcode,
    name: product.product_name ?? null,
    brands: product.brands ?? null,
    image_url: product.image_front_url ?? product.image_url ?? null,
    ingredients_text: product.ingredients_text ?? null,
    additives_tags: Array.isArray(product.additives_tags) ? product.additives_tags : [],
    nutriments: typeof product.nutriments === 'object' && product.nutriments ? product.nutriments : {},
    off_payload: payload,
  };
}
