#! /usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { config } from "dotenv";
import figlet from "figlet";
import { fetchDataCommand } from "./matomo/fetch-data.js";
import { loadTestCommand } from "./puppeteer/load-test.js";
import { Logger } from "./utils/logger.js";

// Setup CLI
config();
console.clear();
const logger = new Logger("main");
console.log(chalk.blue(figlet.textSync("Load Profile Generator")));

// Create program
const program = new Command();
program
  .version("0.5.6")
  .description("Generate load profiles of a site tracked with Matomo.")
  .option("-v, --verbose", "enable verbose logging")
  // Setup data fetching
  .addCommand(fetchDataCommand)
  // Setup load testing
  .addCommand(loadTestCommand)
  .parse(process.argv);

if (program.opts().verbose) {
  logger.info("Verbose logging enabled");
  process.env.LOGGING = "verbose";
}

// Handle unhandled rejections
process.on("unhandledRejection", (err: Error) => {
  if (process.env.LOGGING === "verbose") {
    logger.error(`${err.stack}\n`);
  }

  logger.error(err.message);

  Logger.stopLogging();

  program.error("", { exitCode: 1 });
});
