import chalk from "chalk";
import { MatomoContentPiece } from "../types/matomo/content-piece.matomo";
import { Page } from "../types/page";
import { Logger } from "../utils/logger.js";

const logger = new Logger("mfin");

/**
 * Get page content interaction data from Matomo and enrich the page object.
 *
 * @param pages Page objects to enrich with interaction data
 * @param matomo Url of the Matomo instance
 * @param siteId Id of the site used in Matomo
 * @param token API token for Matomo
 */
export async function getPageInteractions(
  pages: Array<Page>,
  matomo: string,
  siteId: number,
  token: string
): Promise<Array<Page>> {
  logger.info(
    chalk.green(
      "Getting page interactions from Matomo for site",
      chalk.bold(siteId),
      "since September 2023"
    )
  );
  const start = process.hrtime();

  // Fetch interaction data from Matomo
  const today = new Date();
  const url = `https://${matomo}/index.php?module=API&format=JSON&idSite=${siteId}&period=range&date=2023-09-01,${today.getFullYear()}-${
    today.getMonth() + 1
  }-${today.getDate()}&method=Contents.getContentPieces&expanded=1&token_auth=${token}&filter_limit=-1`;
  const response = await fetch(url);
  const data = (await response.json()) as Array<MatomoContentPiece>;

  // Extract the data we need
  for (const page of pages) {
    const interactionData = data.find((interactionData) =>
      page.label.endsWith(interactionData.label)
    );

    if (!interactionData) {
      continue;
    }

    page.interactionRate =
      interactionData.nb_interactions / interactionData.nb_impressions;
  }

  // Log progress
  const end = process.hrtime(start);
  logger.info(
    chalk.green(
      "Got interaction data for",
      chalk.bold(`${data.length} pages`),
      "in",
      chalk.bold(`${end[0]}.${Math.round(end[1] / 1000000)} s`),
      "\n"
    )
  );

  return pages;
}
