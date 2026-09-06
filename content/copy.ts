/**
 * Every sentence the site says in its own voice, in one file.
 *
 * Kept out of the components so it can be read and rewritten as prose rather
 * than hunted through JSX. Anything marked DRAFT is written by me and is
 * waiting on Yossi to put it in his own words.
 */

export const HERO = {
  name: ["Yossi", "Abutbul"],
  /** DRAFT */
  line: "I write software that makes hardware testable. Most of it runs in an RF lab. Some of it just runs on a phone in my kitchen.",
};

export const WORK = {
  heading: "Selected work",
  /** DRAFT */
  line: "Six projects. Two are instruments talking to software, two are tools I needed and could not find, and two came out of coursework and stayed.",
};

export const ABOUT = {
  heading: "Who is typing this",
  /** DRAFT */
  teaser:
    "I integrate RF and electronics at Arad Technologies and study computer science at The Open University. The work I like best sits between the two: a measurement that used to take three days, running unattended in eight minutes.",
  /** DRAFT */
  body: [
    "I am an RF and electronics integrator at Arad Technologies and a BSc computer science student at The Open University. Day to day that means antennas, spectrum captures and power sensors on one side, and Python, FastAPI and React on the other. The part I actually enjoy is the seam: writing the thing that drives the instrument, collects what comes back, and turns it into something a person can read without asking me what it means.",
    "Before that I led operational RF projects in IDF Intelligence, Unit 81, where I did field integration and wrote the first Python tools I ever shipped, for spectrum analyser data collection.",
    "Outside work I build small things end to end, mostly because I want to use them. A family toast rota that syncs across phones. A browser game. A course planner I made in my first year and still use.",
  ],
  /** DRAFT. Yossi has not said what he is looking for; this is a placeholder. */
  looking:
    "I am looking for a software role where the thing on the other end of the code is real: instruments, embedded targets, or the tools an engineering team uses every day.",
  tools: {
    "Write most days": ["Python", "TypeScript", "React", "C"],
    "Reach for often": ["FastAPI", "Next.js", "Firestore", "Three.js"],
    "Point them at": ["Spectrum analysers", "Power sensors", "VNAs", "LoRa gateways"],
  },
};

export const CONTACT = {
  heading: "Get in touch",
  /** DRAFT */
  line: "For software roles, test automation work, or anything where the code has to talk to real hardware.",
  email: "abyossi22@gmail.com",
};

export const NOT_FOUND = {
  heading: "Nothing at this offset",
  /** Kept from the previous build. It has a voice and it stays. */
  body: "This URL compiled but never shipped. No route, no page, no carrier.",
};
