/**
 * DRAFT case-study copy.
 *
 * Every line in this file was written by me, not by Yossi, and is inferred
 * from what the project descriptions already say. It is kept separate from
 * projects.ts precisely so it is easy to find and replace with his own words.
 * Nothing here invents a number: the only figures are the ones already
 * claimed elsewhere on the site.
 */

export interface CaseCopy {
  /** Two sentences on what the problem was. */
  problem: string;
  /** What came of it. */
  outcome: string;
}

export const CASE_COPY: Record<string, CaseCopy> = {
  "report-generator": {
    problem:
      "Every TRP measurement ended with someone copying numbers out of a spreadsheet into a report template by hand. That part took longer than the test itself.",
    outcome:
      "Reporting time dropped by more than half. The 3D radiation surfaces turned out to be the part people actually open in review.",
  },
  "lora-viz": {
    problem:
      "Gateway logs are plain text and thousands of lines long. Answering something as simple as whether a node ever joined meant reading them by eye.",
    outcome:
      "Everything is parsed in the browser, so a log never leaves the machine it was captured on. Still in progress.",
  },
  oplanner: {
    problem:
      "The Open University publishes each course as a calendar file and nothing else. Working out what was actually due across four courses meant four calendars and a lot of arithmetic.",
    outcome: "I built it in my first year and still use it every semester.",
  },
  "toast-turn": {
    problem:
      "Whose turn it is to make toast is a question my family asked every morning and never agreed on. Any answer had to be readable from across the kitchen, without anyone logging in.",
    outcome:
      "It runs on every phone in the house. The toaster lever is the part people pull for no reason.",
  },
  haparlamentor: {
    problem:
      "Quoting the show is close to a national sport and nobody can ever find the episode. There is no searchable transcript anywhere.",
    outcome:
      "Type a line and it gives you the episode and the timestamp, deep-linked. Still in progress.",
  },
  "pipeline-cpu": {
    problem:
      "Pipeline hazards get taught with static diagrams on a slide, which is the one thing a pipeline is not. You cannot see a stall in a picture.",
    outcome:
      "You can step a program one cycle at a time and watch the stall happen. I wrote it while taking the course.",
  },
};
