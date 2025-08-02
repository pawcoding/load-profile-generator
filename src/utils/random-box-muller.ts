/**
 * Generate a random number from a normal distribution using the Box-Muller transform
 *
 * @param mean Mean of the normal distribution
 * @param stdDev Standard deviation of the normal distribution
 */
export function randomBoxMuller(
  mean: number,
  stdDev: number,
  random: () => number
): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = random(); // Converting [0,1) to (0,1)
  while (v === 0) v = random();
  const randomStandardNormal =
    Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + stdDev * randomStandardNormal;
}
