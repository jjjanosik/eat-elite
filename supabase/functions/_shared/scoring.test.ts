import { assertEquals } from 'jsr:@std/assert';
import { computeScore } from './scoring.ts';

Deno.test('computeScore returns bounded values', () => {
  const result = computeScore({
    nutriments: {
      sugars_100g: 5,
      'saturated-fat_100g': 2,
      sodium_100g: 0.2,
      fiber_100g: 3,
      proteins_100g: 8,
    },
    additivesTags: ['en:e100', 'en:e200'],
    weights: {
      nutritionWeight: 70,
      additivesWeight: 30,
    },
  });

  assertEquals(result.score >= 0 && result.score <= 100, true);
  assertEquals(result.nutritionScore >= 0 && result.nutritionScore <= 100, true);
  assertEquals(result.additivesScore >= 0 && result.additivesScore <= 100, true);
  assertEquals(result.additivesCount, 2);
});

Deno.test('computeScore penalizes many additives', () => {
  const lowAdditives = computeScore({
    nutriments: {},
    additivesTags: ['en:e100'],
    weights: {
      nutritionWeight: 50,
      additivesWeight: 50,
    },
  });
  const highAdditives = computeScore({
    nutriments: {},
    additivesTags: ['en:e100', 'en:e200', 'en:e300', 'en:e400', 'en:e500'],
    weights: {
      nutritionWeight: 50,
      additivesWeight: 50,
    },
  });

  assertEquals(highAdditives.score < lowAdditives.score, true);
});
