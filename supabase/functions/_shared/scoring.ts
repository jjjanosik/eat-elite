export type ScoreInputs = {
  nutriments: Record<string, unknown>;
  additivesTags: string[];
  weights: {
    nutritionWeight: number;
    additivesWeight: number;
  };
};

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeScore(inputs: ScoreInputs) {
  const nutriments = inputs.nutriments ?? {};
  const additivesCount = Array.isArray(inputs.additivesTags) ? inputs.additivesTags.length : 0;

  const sugar = toNumber(nutriments['sugars_100g']);
  const saturatedFat = toNumber(nutriments['saturated-fat_100g']);
  const sodium = toNumber(nutriments['sodium_100g']);
  const fiber = toNumber(nutriments['fiber_100g']);
  const protein = toNumber(nutriments['proteins_100g']);

  const sugarPenalty = clamp((sugar / 25) * 30, 0, 30);
  const satFatPenalty = clamp((saturatedFat / 10) * 25, 0, 25);
  const sodiumPenalty = clamp((sodium / 1.2) * 25, 0, 25);
  const fiberBonus = clamp((fiber / 8) * 10, 0, 10);
  const proteinBonus = clamp((protein / 20) * 10, 0, 10);

  const nutritionScore = clamp(Math.round(100 - sugarPenalty - satFatPenalty - sodiumPenalty + fiberBonus + proteinBonus), 0, 100);
  const additivesScore = clamp(Math.round(100 - additivesCount * 14), 0, 100);

  const score = Math.round(
    (nutritionScore * inputs.weights.nutritionWeight + additivesScore * inputs.weights.additivesWeight) / 100,
  );

  return {
    score,
    nutritionScore,
    additivesScore,
    additivesCount,
    features: {
      sugar,
      saturatedFat,
      sodium,
      fiber,
      protein,
    },
  };
}
