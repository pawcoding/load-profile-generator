import chalk from 'chalk'
import { readFile } from 'fs/promises'
import path from 'path'
import { Page } from '../types/page'
import { Logger } from '../utils/logger.js'

const logger = new Logger('citt')

/**
 * Import page transition data from CSV file
 */
export async function readTransitionsCSV(pages: Page[]): Promise<void> {
  logger.info(chalk.yellow('Importing page transition data from CSV file'))

  // Read transitions.csv
  const transitionsCsv = await readFile(
    path.join(process.cwd(), 'lpg', 'transitions.csv'),
  )

  // Parse transitions.csv
  const rawRows = transitionsCsv.toString().split('\n').slice(1)
  const rows = new Map<number, Array<number>>()
  for (const rawRow of rawRows) {
    const row = rawRow.split(',').map(Number)
    rows.set(row[0], row.slice(1))
  }

  // Add following page navigations to all pages
  for (const page of pages) {
    // Skip pages without transitions object (only for type safety)
    if (!page.transition) {
      continue
    }

    const followingPages: Array<{
      id?: number
      label: string
      navigations: number
    }> = []

    // Add following page navigations to page
    const navigations = rows.get(page.id) ?? []
    for (let i = 0; i < navigations.length; i++) {
      // Only add following pages with at least one navigation to them
      if (navigations[i] > 0 && pages[i]) {
        followingPages.push({
          id: pages[i].id,
          label: pages[i].label,
          navigations: navigations[i],
        })
      }
    }

    page.transition.followingPages = followingPages
  }

  logger.info(
    chalk.yellow(
      'Successfully imported',
      chalk.bold(`${pages.length} page transitions`),
    ),
  )
}
