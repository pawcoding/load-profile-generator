import chalk from "chalk";
import { writeFile } from "fs/promises";
import path from "path";
import { Page } from "../types/page.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("cett");

/**
 * Export page transition data as CSV file
 *
 * @param pages Data for pages with transitions
 */
export async function createTransitionsCSV(pages: Array<Page>): Promise<void> {
  logger.info(chalk.green("Exporting page transition data as CSV file"));

  const ids = pages.map((page) => page.id);

  let transitionsCsv = ",";
  transitionsCsv += ids.join(",");
  transitionsCsv += "\n";
  transitionsCsv += pages
    .map((page) => {
      let row = `${page.id},`;
      row += ids
        .map(
          (id) =>
            page.transition?.followingPages.find(
              (followingPage) => followingPage.id === id
            )?.navigations ?? 0
        )
        .join(",");
      return row;
    })
    .join("\n");

  await writeFile(
    path.join(process.cwd(), "lpg", "transitions.csv"),
    transitionsCsv
  );

  logger.info(
    chalk.green("Successfully created", chalk.bold("transitions.csv"), "file")
  );
}
