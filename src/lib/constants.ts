export const DIET_TYPES = ['classic', 'vegetarian', 'vegan', 'pescetarian'] as const;
export const SEX_OPTIONS = ['male', 'female', 'other'] as const;

export const DIET_GOAL_OPTIONS = [
  'lower sugar',
  'higher protein',
  'lower sodium',
  'fewer additives',
  'more whole foods',
];

export const OUTCOME_OPTIONS = [
  'weight management',
  'better energy',
  'heart health',
  'gut health',
  'athletic performance',
];

export const DEFAULT_WEIGHTS = {
  nutrition_weight: 70,
  additives_weight: 30,
};
