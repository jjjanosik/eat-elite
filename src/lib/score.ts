function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

export function getScoreIndicatorColor(score: number): string {
  const value = clampScore(score);

  if (value >= 80) return '#18B84A';
  if (value >= 40) return '#F08C00';
  return '#D1242F';
}

export function getAdditivesIndicatorColor(additivesCount: number): string {
  const count = Number.isFinite(additivesCount) ? Math.max(0, Math.floor(additivesCount)) : 0;

  if (count === 0) return '#18B84A';
  if (count <= 3) return '#F08C00';
  return '#D1242F';
}
