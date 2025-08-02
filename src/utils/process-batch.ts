import chalk from "chalk";
import { Logger } from "./logger.js";

const logger = new Logger("prba");

/**
 * Process an array of items in batches with a sleep between each batch.
 *
 * @param items Items to process
 * @param batchSize Number of items to process in each batch
 * @param callback Function to create the promise for each item
 * @param sleep Sleep time in ms between each batch
 */
export async function processPromisesBatch<T, U>(
  items: Array<T>,
  batchSize: number,
  callback: (item: T) => Promise<U>,
  sleep: number = 1000
): Promise<Array<U>> {
  logger.info(
    chalk.yellow(
      "Starting to process",
      chalk.bold(`${items.length} items`),
      `in groups of ${batchSize} items and`,
      chalk.bold(`${sleep / 1000} s`),
      "between groups\n"
    )
  );
  const start = process.hrtime();

  // Create batches
  const results: Array<U> = [];
  const batches: Array<Array<T>> = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  // Process each batch with sleep between each batch
  for (let i = 0; i < batches.length; i++) {
    logger.info(chalk.yellow(`Processing batch ${i + 1}`));
    const batchStart = process.hrtime();

    // Process i-th batch
    const batch = batches[i];
    const promises = batch.map((item) => callback(item));
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // Log progress
    const batchEnd = process.hrtime(batchStart);
    logger.info(
      chalk.yellow(
        `Finished batch ${i + 1} in`,
        chalk.bold(`${batchEnd[0]}.${Math.round(batchEnd[1] / 1000000)} s`),
        "\n"
      )
    );

    // Sleep before next batch for backoff and API limits
    if (sleep) {
      await new Promise((resolve) => setTimeout(resolve, sleep));
    }
  }

  // Log progress
  const end = process.hrtime(start);
  logger.info(
    chalk.yellow(
      "Finished processing all",
      chalk.bold(`${batches.length} batches`),
      "in",
      chalk.bold(`${end[0]}.${Math.round(end[1] / 1000000)} s`),
      "\n"
    )
  );

  return results;
}
