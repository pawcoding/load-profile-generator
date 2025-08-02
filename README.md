# Load Profile Generator

This tool automates load testing of a website by simulating user behavior based on real users. It combines two tools:

- A custom script downloading real user behavior data (no user data) from a Matomo instance
- A load tester simulating users using multiple puppeteer instances

## Installation

1. Clone this repository / sub-directory
2. Install dependencies using `pnpm install`
3. Register the program as command on your machine with `npm i -g .`
4. Check the installed version with `lgp --version`

## Usage

_Hint: You can always see the integrated docs with `lpg --help`._

### Fetch user data

Before using the load generator, you first need user data to create a user profile based on real data. LPG provides a own integrated command line utility to download user data from Matomo. The raw data will be pre-processed and then saved into two `.csv` files.

_Hint: You will need a Matomo API token with access to the websites data._

```bash
# Download user data
lpg fetch -m <matomoUrl> -s <siteId> -t <apiToken>
```

_Hint: You can also provide the `API_TOKEN` as environment variable or in a `.env` file in the projects root._

| Parameter      | Required | Description                   |
| -------------- | -------- | ----------------------------- |
| `-m, --matomo` | [x]      | URL of the Matomo instance    |
| `-s, --site`   | [x]      | ID of the site used in Matomo |
| `-t, --token`  | [ ]      | API token for Matomo          |

### Start load test

To run the load test you need two `.csv` files containing data about a users behavior on a page and data for transitions between pages. These can be generated with the integrated Matomo download tool or with any other script writing the following format:

`lpg/pages.csv`

```csv
id,label,avgTime,url,entries,exits,loops,navigations,interactionRate
0,/,33,https://website.test/,306,135,30,5,50.00
4,/team,53,https://website.test/team,8,24,4,4,25.00
...
```

_Hint: The number of `navigations` does not include the number of transitions. This is because Matomo only gives you the 5 pages with most navigations to._

`lpg/transitions.csv`

```csv
,0,4,<x>,...
0,0,55,<0-to-x>,...
4,39,0,<4-to-x>,...
<x>,<x-to-0>,<x-to-4>,0,...
...
```

To run the load test, just type:

```bash
# Run load test
lpg load-test -c <concurrentProcesses> -u <users> -d <maxDuration> -s <seed> -h <host>
```

_Hint: You can set more concurrent users than your machine has cores / threads._

| Parameter           | Default | Description                                     |
| ------------------- | ------- | ----------------------------------------------- |
| `-h, --host`        |         | Host to load test (including protocol and port) |
| `-c, --concurrency` | 1       | Number of concurrent processes / browsers       |
| `-u, --users`       | 1       | Total number of users to simulate               |
| `-d, --duration`    | 10      | Max duration for the simulation to run          |
| `-s, --seed`        |         | Seed to use for random numbers                  |
| `-m, --monitor`     |         | Display cluster stats to watch performance      |
| `-b, --browser`     |         | Disable puppeteer headless mode                 |
| `-v, --verbose`     |         | Enable verbose logging (only for development)   |

_Hint: I would not disable headless mode with many concurrent users._

_Hint: Only enable verbose logging with low number of (concurrent) users to check puppeteer behavior on the website. You can also just read the log file to check the behavior of every user._

If the website contains videos / audio files, that the load tester should play, you **must** provide the path to your Google Chrome executable as `CHROME` environment variable. The chromium instance bundled with puppeteer [cannot play back any licensed formats such as AAC or H.264](https://github.com/puppeteer/puppeteer/issues/7222#issuecomment-849481436).

#### How does it work?

![Load testing flow chart](./../diagrams/load_testing/load_testing.png)

The load tester first reads the `pages.csv` file to load the basic behavioral data with additional data like the label or the id. Then the `transitions.csv` file is loaded to enrich the basic data with information about the transitions between these pages.

After the behavioral data was loaded, the load test itself starts. First the starting pages for each user are randomly selected using the number of page entries as weight. These users are placed into a queue and will be handled when a concurrent process is available. Each user gets a separate (headless) browser window by the puppeteer cluster and does the following:

1. Open the users starting page
2. Play back video or podcast with given interaction rate
3. Simulate the user reading the page by waiting a randomly distributed time (average according to given data)
4. Do a random action (if simulation end is not reached)
   1. Leave the page (page exits)
   2. Reload the page (page loops)
   3. Navigate to a common following page (transitions, searching for `a[href="${nextLabel}"]` and clicking
   4. Navigate to a random other page (page navigations, only on same domain and not in common transitions)

After finishing the load test (max time is reached or all users are done and queue is empty) the tool waits for the cluster to idle and closes the browsers.

## Development

To build the tool after you added a new feature / changed something run `pnpm run build` to compile the TS code to JS.
You can also run `pnpm run dev` to run the TypeScript compiler in watch mode.

Please run `pnpm run prettier && pnpm run build` before committing your changes to the repository. This ensures a consistent code style and the latest build being uploaded.
