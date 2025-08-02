/**
 * Replacement for Array.prototype.filter that allows for async predicates
 *
 * @param arr Array of items to filter
 * @param predicate Predicate function to filter items
 */
export async function asyncFilter<T>(
  arr: T[],
  predicate: (item: T) => Promise<boolean>,
): Promise<T[]> {
  const results = await Promise.all(arr.map(predicate))
  return arr.filter((_v, index) => results[index])
}
