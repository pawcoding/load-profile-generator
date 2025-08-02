import chalk from "chalk";
import { readFile } from "fs/promises";
import path from "path";
import { Page } from "../types/page";
import { Logger } from "../utils/logger.js";

const logger = new Logger("cipt");

/**
 * Import page data from CSV file
 */
export async function readPageCSV(): Promise<Array<Page>> {
  logger.info(chalk.yellow("Importing page data from CSV file"));

  const pagesCsv = await readFile(path.join(process.cwd(), "lpg", "pages.csv"));
  const pages = pagesCsv
    .toString()
    .split("\n")
    .slice(1)
    .map((row) => {
      const [
        id,
        label,
        avgTimeOnPage,
        url,
        entries,
        exits,
        loops,
        navigations,
        interactionRate
      ] = row.split(",");
      return {
        id: Number(id),
        label,
        avgTimeOnPage: Number(avgTimeOnPage),
        url,
        transition: {
          entries: Number(entries),
          exits: Number(exits),
          loops: Number(loops),
          otherNavigations: Number(navigations),
          followingPages: []
        },
        interactionRate: Number(interactionRate) / 100
      };
    });

  logger.info(
    chalk.yellow("Successfully imported", chalk.bold(`${pages.length} pages`))
  );
  return pages;
}
