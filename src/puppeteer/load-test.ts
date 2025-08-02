import chalk from "chalk";
import { Command } from "commander";
import { Page as PPage } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import { readPageCSV } from "../csv/read-page-csv.js";
import { readTransitionsCSV } from "../csv/read-transitions-csv.js";
import { Logger } from "../utils/logger.js";
import { mulberry32 } from "../utils/seed-random.js";
import { sleep } from "../utils/sleep.js";
import { User } from "./user.js";

const logger = new Logger("plot");

// Setup load test command
export const loadTestCommand = new Command("load-test");
loadTestCommand
  .description(
    "Run a load test on a website using a load profile extracted with the fetch tool"
  )
  .option("-c, --concurrency <number>", "Number of concurrent users", "1")
  .option("-u, --users <number>", "Number of users / total page visits", "1")
  .option(
    "-d, --duration <number>",
    "Maximum duration of the load test in minutes",
    "10"
  )
  .option("-m, --monitor", "Print monitoring data to stdout")
  .option("-b, --browser", "Run in browser mode (headless: false)")
  .option("-s, --seed <number>", "Seed for the random number generator")
  .option("-h, --host <url>", "Host to run the load test on")
  .action(
    async (options: {
      concurrency: number;
      users: number;
      duration: number;
      monitor: boolean;
      browser: boolean;
      seed: number;
      host: string;
    }) => {
      // Check inputs
      if (!options.duration) {
        logger.error(
          `No maximum duration was provided. Please try again with ${chalk.bold.white(
            "-d <duration>"
          )}`
        );
        return;
      }

      if (!options.host) {
        logger.error(
          `No host was provided. Please try again with ${chalk.bold.white(
            "-h <host>"
          )}`
        );
        return;
      }

      const seed = options.seed ?? process.env.SEED;
      if (!seed) {
        logger.error(
          `No seed was provided. Please try again with ${chalk.bold.white(
            "-s <seed>"
          )}, export it as an environment variable ${chalk.bold.white(
            "SEED"
          )} or create a .env file with the seed in it.`
        );
        return;
      }

      await loadTest(
        options.host,
        Number(options.concurrency),
        options.users,
        options.duration,
        seed,
        options.monitor,
        options.browser
      );

      Logger.stopLogging();
    }
  );

/**
 * Run a load test on a website using a load profile extracted with the fetch tool
 *
 * @param host Host to run the load test on
 * @param concurrency Number of concurrent users (puppeteer instances, default: 1)
 * @param users Number of users / total page visits
 * @param duration Maximum duration of the load test in minutes
 * @param monitor Print monitoring data to stdout (default: false)
 * @param browser Run in browser mode (default: false (headless))
 */
export async function loadTest(
  host: string,
  concurrency: number,
  users: number,
  duration: number,
  seed: number,
  monitor: boolean = false,
  browser: boolean = false
): Promise<void> {
  logger.info(
    chalk.magenta(
      "Starting load test with",
      chalk.bold(`${users} users`),
      `for maximum`,
      chalk.bold(`${duration} minutes (seed: ${seed})`),
      `on`,
      chalk.bold(host)
    )
  );
  const start = process.hrtime();
  const projectedEndTime = Date.now() + duration * 60 * 1000;
  User.projectedEnd = projectedEndTime;

  // Read page data
  const pages = await readPageCSV();
  await readTransitionsCSV(pages);
  User.setPages(pages);

  // Create load profiles
  const pageEntryWeights = pages.reduce(
    (weights, page) => [
      ...weights,
      (weights[weights.length - 1] || 0) + (page.transition?.entries ?? 0)
    ],
    [] as Array<number>
  );
  let lastPageEntryWeightIndex = pageEntryWeights.length - 1;
  while (isNaN(pageEntryWeights[lastPageEntryWeightIndex])) {
    lastPageEntryWeightIndex--;
  }

  // Create puppeteer cluster
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: concurrency,
    monitor: monitor,
    workerCreationDelay: 1000,
    timeout: 2 * duration * 60 * 1000,
    puppeteerOptions: {
      headless: browser ? false : "new",
      executablePath: process.env.CHROME ?? undefined
    }
  });

  let finishedUsers = 0;
  let skippedUsers = 0;

  // Setup error handling
  cluster.on("taskerror", (err: Error, user: User, willRetry: boolean) => {
    user.handleTaskError(err, willRetry);
    if (!willRetry) {
      if (err.message.startsWith("Timeout")) {
        finishedUsers++;
      } else {
        skippedUsers++;
      }
    }
  });

  // Define task
  await cluster.task(async ({ page, data }: { page: PPage; data: User }) => {
    // Check if load test is still running
    if (Date.now() > projectedEndTime) {
      skippedUsers++;
      await page.close();
      return;
    }

    // Setup request interception
    await page.setRequestInterception(true);
    page.on("request", (interceptedRequest) => {
      if (interceptedRequest.isInterceptResolutionHandled()) {
        return;
      }

      // Block tracking requests
      if (interceptedRequest.url().includes("matomo")) {
        interceptedRequest.abort();
        return;
      }

      interceptedRequest.continue();
    });

    // Simulate user behavior
    await data.simulateUserBehavior(page);

    // Close page
    await page.close();
    finishedUsers++;
  });

  // Queue users
  const randomNumber = mulberry32(seed);
  for (let i = 0; i < users; i++) {
    // Wait until cluster has capacity before queueing next user
    while (i - finishedUsers - skippedUsers > concurrency) {
      await sleep(100);
    }

    // Do not queue more users if load test is already running for too long
    if (Date.now() > projectedEndTime) {
      break;
    }

    // Select random starting page
    const random = randomNumber() * pageEntryWeights[lastPageEntryWeightIndex];
    const pageIndex = pageEntryWeights.findIndex((weight) => weight > random);

    if (pageIndex === -1) {
      logger.error(
        `Could not find page for random number ${random} and weights ${pageEntryWeights}`
      );
      i--;
      continue;
    }

    try {
      const user = new User(
        host,
        i + 1,
        pages[pageIndex],
        seed,
        concurrency,
        !monitor
      );
      await cluster.queue(user);
    } catch {
      i--;
    }
  }

  // Wait for cluster to idle and close it
  await cluster.idle();
  await cluster.close();

  // Log progress
  const end = process.hrtime(start);
  logger.info(
    chalk.magenta(
      "Finished load test after",
      chalk.bold(`${end[0]}.${Math.round(end[1] / 1000000)} s`),
      "with",
      chalk.bold(`${finishedUsers} users`),
      `(${skippedUsers} users skipped)\n`
    )
  );
}
