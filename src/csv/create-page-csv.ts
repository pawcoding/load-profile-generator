import chalk from 'chalk'
import { writeFile } from 'fs/promises'
import path from 'path'

import { Page } from '../types/page.js'
import { Logger } from '../utils/logger.js'

const logger = new Logger('cept')

/**
 * Export basic page data as CSV file
 *
 * @param pages Data for pages
 */
export async function createPageCSV(pages: Page[]): Promise<void> {
  logger.info(chalk.yellow('Exporting page data as CSV file'))

  let pagesCsv = `id,label,avgTimeOnPage,url,entries,exits,loops,navigations,interactionRate\n`
  pagesCsv += pages
    .map(
      (page) =>
        `${page.id},${page.label},${page.avgTimeOnPage},${page.url},${
          page.transition?.entries ?? 0
        },${page.transition?.exits ?? 0},${page.transition?.loops ?? 0},${
          page.transition?.otherNavigations ?? 0
        },${((page.interactionRate ?? 0) * 100).toFixed(2)}`,
    )
    .join('\n')

  await writeFile(path.join(process.cwd(), 'lpg', 'pages.csv'), pagesCsv)

  logger.info(
    chalk.yellow('Successfully created', chalk.bold('pages.csv'), 'file'),
  )
}
