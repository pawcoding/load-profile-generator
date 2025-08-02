import chalk from 'chalk'

import { Page } from '../types/page'
import { Logger } from '../utils/logger.js'

const logger = new Logger('mpti')

/**
 * Get basic page date
 *
 * @param matomo Url of the Matomo instance
 * @param siteId Id of the site used in Matomo
 * @param token API token for Matomo
 */
export async function getPagesWithTime(
  matomo: string,
  siteId: number,
  token: string,
): Promise<Page[]> {
  logger.info(
    chalk.green(
      'Getting page visits from Matomo for site',
      chalk.bold(siteId),
      'since September 2023',
    ),
  )
  const start = process.hrtime()

  // Fetch page data from Matomo
  const today = new Date()
  const url = `https://${matomo}/index.php?module=API&format=JSON&idSite=${siteId}&period=range&date=2023-09-01,${today.getFullYear()}-${
    today.getMonth() + 1
  }-${today.getDate()}&method=Actions.getPageUrls&flat=1&token_auth=${token}&filter_limit=-1`
  const response = await fetch(url)
  const data = await response.json()

  // Extract the data we need
  const pages: Page[] = data
    .map((page: any, index: number) => ({
      id: index,
      label: page.label,
      avgTimeOnPage: page.avg_time_on_page,
      url: page.url,
    }))
    .filter((page: Page) => page.avgTimeOnPage > 1)
    .sort((a: Page, b: Page) => a.label.length - b.label.length)

  // Log progress
  const end = process.hrtime(start)
  logger.info(
    chalk.green(
      'Got data for',
      chalk.bold(`${pages.length} pages`),
      'in',
      chalk.bold(`${end[0]}.${Math.round(end[1] / 1000000)} s`),
      '\n',
    ),
  )

  return pages
}
