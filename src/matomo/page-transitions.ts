import chalk from "chalk";
import { Page } from "../types/page";
import { Logger } from "../utils/logger.js";

const logger = new Logger("mptr");

/**
 * Get page transition data from Matomo and enrich the page object.
 *
 * @param page Page object to enrich
 * @param matomo Url of the Matomo instance
 * @param siteId Id of the site used in Matomo
 * @param token API token for Matomo
 */
export async function getPageTransition(
  page: Page,
  matomo: string,
  siteId: number,
  token: string
): Promise<Page> {
  const start = process.hrtime();

  // Fetch page transition data from Matomo
  const today = new Date();
  const url = `https://${matomo}/index.php?module=API&method=Transitions.getTransitionsForAction&actionType=url&actionName=${encodeURIComponent(
    page.url
  )}&idSite=${siteId}&period=range&date=2023-09-01,${today.getFullYear()}-${
    today.getMonth() + 1
  }-${today.getDate()}&format=JSON&token_auth=${token}&force_api_session=1`;
  const response = await fetch(url);
  const data = (await response.json()) as {
    pageMetrics: { entries: number; exits: number; loops: number };
    followingPages: Array<{ label: string; referrals: number }>;
  };

  // Extract the data we need
  page.transition = {
    entries: data.pageMetrics.entries,
    exits: data.pageMetrics.exits,
    loops: data.pageMetrics.loops,
    otherNavigations:
      data.followingPages.find(
        (followingPage) => followingPage.label === "Others"
      )?.referrals ?? 0,
    followingPages: data.followingPages.map((followingPage) => ({
      label: followingPage.label,
      navigations: followingPage.referrals
    }))
  };

  // Log progress
  const end = process.hrtime(start);
  logger.info(
    chalk.green(
      "Got transition data for page",
      chalk.bold(
        `"${page.label.substring(0, 40)}${
          page.label.length >= 40 ? "..." : ""
        }"`
      ),
      "in",
      chalk.bold(`${end[0]}.${Math.round(end[1] / 1000000)} s`)
    )
  );

  return page;
}
