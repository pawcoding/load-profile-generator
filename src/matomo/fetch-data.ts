import chalk from "chalk";
import { Command } from "commander";
import { mkdir } from "fs/promises";
import path from "path";
import { createPageCSV } from "../csv/create-page-csv.js";
import { createTransitionsCSV } from "../csv/create-transitions-csv.js";
import { Page } from "../types/page.js";
import { Logger } from "../utils/logger.js";
import { processPromisesBatch } from "../utils/process-batch.js";
import { getPageInteractions } from "./page-interaction.js";
import { getPagesWithTime } from "./page-time.js";
import { getPageTransition } from "./page-transitions.js";

const logger = new Logger("mfda");

// Setup fetch command
export const fetchDataCommand = new Command("fetch");
fetchDataCommand
  .description("Fetch page data from Matomo")
  .option("-m, --matomo <url>", "Url of the Matomo instance")
  .option("-s, --site <siteId>", "Id of the site used in Matomo")
  .option(
    "-t, --token [token]",
    "API token for Matomo (when not provided as environment variable API_TOKEN)"
  )
  .action(async (options: { matomo: string; site: number; token?: string }) => {
    // Check inputs
    if (!options.matomo) {
      logger.error(
        `No Matomo url was provided. Please try again with ${chalk.bold.white(
          "-m <url>"
        )}`
      );
      return;
    }
    if (!options.site) {
      logger.error(
        `No site id was provided. Please try again with ${chalk.bold.white(
          "-s <siteId>"
        )}`
      );
      return;
    }
    const token = options.token ?? process.env.API_TOKEN;
    if (!token) {
      logger.error(
        `No API token was provided. Please try again with ${chalk.bold.white(
          "-t <token>"
        )}, export your token as environment variable ${chalk.bold.white(
          "API_TOKEN"
        )} or create a .env file with your token.`
      );
      return;
    }

    await fetchData(options.matomo, options.site, token);

    Logger.stopLogging();
  });

/**
 * Fetch page data from Matomo
 *
 * @param matomo Url of the Matomo instance
 * @param site Id of the site used in Matomo
 * @param token API token for Matomo
 */
export async function fetchData(
  matomo: string,
  site: number,
  token: string
): Promise<void> {
  logger.info(
    chalk.green("Fetching page data from Matomo for site", chalk.bold(site))
  );
  const start = process.hrtime();

  // Fetch basic page data
  const pages = await getPagesWithTime(matomo, site, token);

  // Fetch interaction data
  const pagesWithInteractions = await getPageInteractions(
    pages,
    matomo,
    site,
    token
  );

  // Enrich basic page data with page transitions
  const pagesWithTransitions = await processPromisesBatch(
    pagesWithInteractions,
    10,
    (page: Page) => getPageTransition(page, matomo, site, token)
  );

  // Add missing ids to transition pages
  for (const page of pagesWithTransitions) {
    if (page.transition) {
      page.transition.followingPages = page.transition.followingPages.map(
        (followingPage) => ({
          ...followingPage,
          id: pages.find((p) => p.url.includes(followingPage.label))?.id ?? -1
        })
      );
    }
  }

  // Save data as CSV files
  await mkdir(path.join(process.cwd(), "lpg"), { recursive: true });
  await Promise.all([
    createPageCSV(pagesWithTransitions),
    createTransitionsCSV(pagesWithTransitions)
  ]);

  // Log progress
  const end = process.hrtime(start);
  logger.info(
    chalk.green(
      "Fetched and saved page data for site",
      chalk.bold(site),
      "in",
      chalk.bold(`${end[0]}.${Math.round(end[1] / 1000000)} s`),
      "\n"
    )
  );
}
