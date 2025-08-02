import chalk from "chalk";
import { Page as PPage } from "puppeteer";
import { Page } from "../types/page";
import { FollowingPage } from "../types/page-transition";
import { asyncFilter } from "../utils/async-filter.js";
import { Logger } from "../utils/logger.js";
import { randomBoxMuller } from "../utils/random-box-muller.js";
import { mulberry32 } from "../utils/seed-random.js";
import { sleep } from "../utils/sleep.js";

/**
 * A user is a single puppeteer instance that visits a website
 * and performs a series of actions simulating a real user.
 */
export class User {
  /**
   * Projected end time of the load test
   */
  public static projectedEnd?: number;

  /**
   * Array of all pages that can be visited by the user
   */
  private static _pages: Array<Page> = [];

  /**
   * Set the pages that can be visited by the user
   *
   * @param pages Array of pages
   */
  public static setPages(pages: Array<Page>): void {
    User._pages = pages;
  }

  /**
   * Logger instance for the user
   */
  private readonly _logger: Logger;

  /**
   * Random number generator for the user
   */
  private readonly _random: () => number;

  /**
   * Host to run the load test on
   */
  private readonly _host: string;

  /**
   * Current page of the user
   */
  private _page: Page;

  /**
   * Whether the user is done with the load test
   */
  private _done = false;

  /**
   * Read-only accessor for the current page of the user
   */
  public get page(): Page {
    return this._page;
  }

  /**
   * Read-only accessor for the current URL of the user
   */
  public get url(): string {
    return this._page.url;
  }

  /**
   * @param host Host to run the load test on
   * @param id Unique ID of the user
   * @param page Starting page of the user
   * @param seed Seed for the random number generator
   * @param maxConcurrentUsers Maximum number of concurrent users
   * @param console Whether to log to std.out (default: true)
   */
  public constructor(
    host: string,
    id: number,
    page: Page,
    seed: number,
    maxConcurrentUsers: number,
    console = true
  ) {
    if (!page.transition) {
      throw new Error(`Page ${page.label} has no transition`);
    }

    this._page = page;

    this._logger = new Logger("USER", id, console, maxConcurrentUsers);
    this._random = mulberry32(seed + id);
    this._host = host;
  }

  /**
   * Simulate this user visiting the site
   *
   * @param page Puppeteer page
   */
  public async simulateUserBehavior(page: PPage): Promise<void> {
    // Start site visit
    this._logger.info(chalk.magenta("Visiting", chalk.bold(this._page.label)));

    // Load entry page
    await page.goto(`${this._host}${this._page.label}`, {
      waitUntil: "domcontentloaded"
    });

    // Simulate user behavior on page in a loop to keep callstack small
    while (!this._done) {
      await this._visitPage(page);
    }
  }

  /**
   * Visit the current page
   *
   * @param page Puppeteer page
   * @param navigateTo Whether to navigate to the page
   */
  private async _visitPage(page: PPage): Promise<void> {
    // Check if load test should be aborted
    if (User.projectedEnd && Date.now() > User.projectedEnd) {
      this._logger.info(chalk.magenta("Aborting load test"));
      this._done = true;
      return;
    }

    // Simulate user interaction on page
    if (this._page.interactionRate && this._page.interactionRate > 0) {
      await this._simulateUserInteraction(page);
    }

    // Simulate user reading the page
    await this._waitOnPage();

    // Calculate next action
    await this._calculateNextAction(page);
  }

  /**
   * Simulate a user interacting with the page.
   * This includes playing videos or podcasts on the page if available.
   */
  private async _simulateUserInteraction(page: PPage): Promise<void> {
    if (this.url.includes("videos")) {
      // If the page has a video, play it with the given interaction rate
      const random = this._random();
      if (random > this._page.interactionRate!) {
        return;
      }

      // Wait short time before playing video
      await sleep(1000);

      try {
        // Play video
        await page.$eval("video", (videoElement) => videoElement?.play());
        this._logger.info(
          chalk.magenta("Playing video on page", chalk.bold(this._page.label))
        );
      } catch {
        this._logger.error(`Failed to play video on page ${this._page.label}`);
      }
    } else if (this.url.includes("podcasts")) {
      // Select all podcast episodes on the page
      const podcasts = await page.$$("audio");
      if (podcasts.length === 0) {
        this._logger.error(`No audio found on page ${this._page.label}`);
        return;
      }

      for (let i = 0; i < podcasts.length; i++) {
        // Play a podcast episode with the given interaction rate
        const random = this._random();
        if (random > this._page.interactionRate!) {
          continue;
        }

        // Wait short time before playing podcast episode
        await sleep(1000);

        try {
          // Play podcast episode
          await page.$$eval(
            "audio",
            (audioElements, index) => audioElements[index]?.play(),
            i
          );
          this._logger.info(
            chalk.magenta(
              `Playing episode ${i} from podcast on page`,
              chalk.bold(this._page.label)
            )
          );
        } catch {
          this._logger.error(
            `Failed to play podcast on page ${this._page.label}`
          );
        }
      }
    }
  }

  /**
   * Simulate a user reading the page content by waiting for a random amount of time
   * respecting the average time on the page
   */
  private async _waitOnPage(): Promise<void> {
    // Calculate random time on page based on average time on page
    const timeOnPage = Math.max(
      5,
      randomBoxMuller(
        this._page.avgTimeOnPage,
        this._page.avgTimeOnPage / 2,
        this._random
      )
    );

    this._logger.info(
      chalk.magenta(
        "Staying on page",
        chalk.bold(this._page.label),
        `for ${Math.round(timeOnPage)} s`
      )
    );

    // Wait for random time on page
    await sleep(timeOnPage * 1000);
  }

  /**
   * Calculate the next action of the user
   *
   * @param page Puppeteer page
   */
  private async _calculateNextAction(page: PPage): Promise<void> {
    // Leave page if load test should be aborted
    if (User.projectedEnd && Date.now() > User.projectedEnd) {
      this._leavePage();
      return;
    }

    // Leaves page if no transitions are defined
    if (!this._page.transition) {
      this._logger.error(`Page ${this._page.label} has no transition`);
      this._done = true;
      return;
    }

    // Calculate total number of actions on page
    let totalActions =
      this._page.transition.exits +
      this._page.transition.loops +
      this._page.transition.otherNavigations;
    for (const followingPage of this._page.transition.followingPages) {
      totalActions += followingPage.navigations;
    }

    // Calculate random action on page
    let random = this._random() * totalActions;

    // Leave page
    random -= this._page.transition.exits;
    if (random < 0) {
      this._leavePage();
      return;
    }

    // Loop on page
    random -= this._page.transition.loops;
    if (random < 0) {
      await this._loopOnPage(page);
      return;
    }

    // Navigate to common following page
    for (const followingPage of this._page.transition.followingPages) {
      random -= followingPage.navigations;
      if (random < 0) {
        try {
          await this._navigateToCommonFollowingPage(page, followingPage);
          return;
        } catch {
          // No-op
        }
      }
    }

    try {
      // Navigate to random other page
      await this._navigateToRandomOtherPage(page);
    } catch {
      this._done = true;
    }
  }

  /**
   * Leave the current page
   */
  private _leavePage(): void {
    this._logger.info(
      chalk.magenta("Leaving page", chalk.bold(this._page.label))
    );
    this._done = true;
  }

  /**
   * Loop on the current page by reloading it
   *
   * @param page Puppeteer page
   */
  private async _loopOnPage(page: PPage): Promise<void> {
    this._logger.info(
      chalk.magenta("Reloading page", chalk.bold(this._page.label))
    );

    await page.reload({ waitUntil: "domcontentloaded" });
  }

  /**
   * Navigate to a following page
   *
   * @param page Puppeteer page
   * @param followingPage Following page to navigate to
   */
  private async _navigateToCommonFollowingPage(
    page: PPage,
    followingPage: FollowingPage
  ): Promise<void> {
    // Find page object for following page
    const nextPage = User._pages.find((page) => page.id === followingPage.id);
    if (!nextPage) {
      throw new Error(`Page ${followingPage.label} not found`);
    }

    // Find <a> with href to following page
    const link = await page.$(`a[href="${nextPage.label}"]`);
    if (!link) {
      throw new Error(
        `Link to ${nextPage.label} not found on ${this._page.label}`
      );
    }

    // Navigate to following page
    this._logger.info(
      chalk.magenta(
        "Navigating from",
        chalk.bold(this._page.label),
        "to",
        chalk.bold(nextPage.label)
      )
    );
    await Promise.all([
      page.waitForNavigation(),
      // Use $eval instead of click because click does not work on some links
      page.$eval(`a[href="${nextPage.label}"]`, (el) => el.click())
    ]);
    this._page = nextPage;
  }

  /**
   * Search a random link on the current page and navigate to it
   *
   * @param page Puppeteer page
   */
  private async _navigateToRandomOtherPage(page: PPage): Promise<void> {
    // Find all links on page
    const links = await page.$$("a");

    // Filter links to only include links to other pages than the common following pages
    const followingPageLinks = this._page.transition?.followingPages.map(
      (followingPage) => followingPage.label
    );
    const otherLinks = await asyncFilter(links, async (link) => {
      if (!link) {
        return false;
      }

      const href = (await link.getProperty("href"))
        ?.toString()
        .replace("JSHandle:", "");

      if (!href?.startsWith(this._host)) {
        return false;
      }

      const label = href.replace(this._host, "");

      return label !== this._page.label && !followingPageLinks?.includes(label);
    });

    if (otherLinks.length === 0) {
      throw new Error(`No links to other pages found on ${this._page.label}`);
    }

    // Select random link
    const random = Math.floor(this._random() * otherLinks.length);
    const link = otherLinks[random];

    // Find page object for following page
    const label = (await link.getProperty("href"))
      ?.toString()
      .replace(`JSHandle:${this._host}`, "");
    const nextPage = User._pages.find((page) => page.label === label);
    if (!nextPage) {
      throw new Error(`Page ${label} not found`);
    }

    // Navigate to following page
    this._logger.info(
      chalk.magenta(
        "Navigating random from",
        chalk.bold(this._page.label),
        "to",
        chalk.bold(nextPage.label)
      )
    );
    await Promise.all([
      page.waitForNavigation(),
      // Use $eval instead of click because click does not work on some links
      page.$eval(`a[href="${nextPage.label}"]`, (el) => el.click())
    ]);
    this._page = nextPage;
  }

  /**
   * Handle errors that occur while visiting a page
   *
   * @param error Error that occurred
   * @param willRetry Whether the task will be retried
   */
  public handleTaskError(error: Error, willRetry: boolean): void {
    if (willRetry) {
      this._logger.info(
        `Encountered an error while visiting ${chalk.bold(
          `${this._page.label}`
        )} and will retry`
      );
    } else {
      if (!error.message.startsWith("Timeout")) {
        this._logger.error(
          `Failed to visit ${chalk.bold(`${this._page.label}`)}: ${
            error.message
          }`
        );
      }
    }
  }
}
