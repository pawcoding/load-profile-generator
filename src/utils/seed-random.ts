/**
 * Generate a random number based on a seed using the mulberry32 algorithm.
 * This is used cause JS's Math.random() has no support for seeds and the algorithm is fast.
 * The author states that it actually can't produce about 1/3 of all possible 32-bit numbers,
 * but that's still sufficient for our use case.
 *
 * See: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 *
 * @param seed The seed to use for the random number generator.
 */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
