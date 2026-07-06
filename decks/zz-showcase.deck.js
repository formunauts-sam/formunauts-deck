/* ============================================================
   zz-showcase.deck.js — the WAVE-5 ARCHETYPE SHOWCASE.
   ------------------------------------------------------------
   NOT in decks/manifest.js on purpose: this is the integrator's
   reference deck, one cohesive Formunauts story that exercises
   every new archetype at least once (bigStat, kpiDashboard,
   comparison, agenda, sectionDivider, timeline, pullQuote,
   logoWall, imageFullBleed, map) plus the cover/closing bookend.

   Content is realistic F2F-fundraising material. imagesBase reuses
   the 2026-07-01 asset folder so every framed image resolves to a
   real, registered file (CLS-free). No em-dashes, no emoji, at most
   one red stopper (the early-cancellation KPI on the app-health board).
   ============================================================ */
export const deck = {
  meta: {
    id: "zz-showcase",
    title: "Archetype Showcase",
    date: "06.07.2026",
    lang: "en",
    imagesBase: "./assets/img/2026-07-01/",
    occasion: "Platform",
    owner: "marketing",
    status: "draft",
  },
  slides: [
    /* 01 · COVER ------------------------------------------------ */
    {
      id: "cover", archetype: "cover",
      eyebrow: "FORMUNAUTS PRESENT",
      headline: "The field, the tool, the numbers",
      sub: "Wave 5 archetype showcase · 06.07.2026",
      notes: "This deck is the reference for the new slide archetypes. One Formunauts story, every new layout used once. Walk it top to bottom.",
    },

    /* 02 · AGENDA (pairs by number with the section dividers) --- */
    {
      id: "agenda", archetype: "agenda",
      eyebrow: "What we will walk through",
      headline: "Four sections, one arc",
      lead: "From the doorstep conversation to the platform that carries it, and where we go next.",
      items: [
        { n: 1, title: "Face to face this quarter", note: "Standrooms, dialogue, sign-ups" },
        { n: 2, title: "One tool, the whole operation", note: "The app that runs the field" },
        { n: 3, title: "Why NGOs move to us", note: "Paper clipboard vs the app" },
        { n: 4, title: "Where we go next", note: "Roadmap and the Swiss market" },
      ],
      notes: "Set the map. Each line lands later as its own section divider (watch the numeral fly across).",
    },

    /* 03 · SECTION DIVIDER 1 ------------------------------------ */
    {
      id: "section-1", archetype: "sectionDivider",
      number: 1,
      title: "Face to face this quarter",
      sub: "Where every donor relationship starts: a real conversation at the stand.",
      notes: "Land into section 1. The number just flew in from the agenda; the ring redraws.",
    },

    /* 04 · BIG STAT — the money number -------------------------- */
    {
      id: "donations-ytd", archetype: "bigStat",
      eyebrow: "FORMUNAUTS APP · 2026 to date",
      headline: "Donations enabled through the app",
      lead: "Every sign-up captured in the field, verified, and handed to the NGO clean.",
      value: 4820000,
      unit: "EUR",
      label: "in recurring annual donation value signed this year",
      context: "Across 41 campaigns in AT, DE and CH, from a single field workflow.",
      sub: { value: 128, label: "active fundraisers on the app" },
      spark: [12, 18, 24, 31, 38, 44, 52, 61, 73, 88],
      notes: "This is the headline number. Let it land, then move to how the app produces it.",
    },

    /* 05 · IMAGE FULL BLEED — the human moment ------------------ */
    {
      id: "doorstep-moment", archetype: "imageFullBleed",
      src: "reinhard-intro-1.png",
      focal: "center",
      title: "The conversation still happens at the door",
      caption: "A Formunauts fundraiser signing a monthly donor, spring 2026.",
      credit: "Photo (c) Formunauts GmbH",
      alt: "Formunauts fundraiser talking with a donor",
      notes: "One breath of atmosphere. The photo does the talking; keep the words short.",
    },

    /* 06 · SECTION DIVIDER 2 ------------------------------------ */
    {
      id: "section-2", archetype: "sectionDivider",
      number: 2,
      title: "One tool, the whole operation",
      sub: "Sign-up, verification and payout, measured across every active campaign.",
      notes: "Into section 2. Now we show the platform that turns those conversations into clean data.",
    },

    /* 07 · KPI DASHBOARD — the tool, quantified ----------------- */
    {
      id: "app-health", archetype: "kpiDashboard",
      eyebrow: "FORMUNAUTS APP · live platform metrics",
      headline: "The field operation, in six numbers",
      lead: "Sign-up quality, verification and payout, measured across every active campaign.",
      metrics: [
        { value: 94, unit: "%", label: "photo-verified sign-ups", meter: 0.94 },
        { value: 12800, label: "donations processed this quarter", meter: 0.72 },
        { value: 2.1, unit: "%", label: "early cancellation rate", meter: 0.21 },
        { value: 41, label: "campaigns running on the app", meter: 0.55 },
        { value: 3.4, unit: "min", label: "median time per sign-up", ring: 0.68 },
        { value: 99, unit: "%", label: "payouts reconciled automatically", meter: 0.99 },
      ],
      notes: "The accent cell (early cancellation rate) is the one number we watch, so it carries the red.",
    },

    /* 08 · TIMELINE — how a sign-up flows ----------------------- */
    {
      id: "signup-flow", archetype: "timeline",
      eyebrow: "From conversation to committed donor",
      headline: "What happens after a yes",
      lead: "The line the app draws: captured, verified, delivered, confirmed.",
      orientation: "horizontal",
      milestones: [
        { when: "Minute 0", title: "Sign-up captured", note: "Details and mandate on the phone", state: "done" },
        { when: "Minute 3", title: "Photo verification", note: "Identity confirmed in the field", state: "done" },
        { when: "Same day", title: "Handed to the NGO", note: "Clean record, no re-keying", state: "active" },
        { when: "Day 2", title: "Welcome contact", note: "Donor hears from the cause", state: "next" },
      ],
      notes: "Walk the spine as it draws. Four beats, one arc, no paper anywhere.",
    },

    /* 09 · PULL QUOTE — the human proof ------------------------- */
    {
      id: "donor-voice", archetype: "pullQuote",
      eyebrow: "Why it works",
      quote: "I had walked past a hundred stands. This one asked me a real question, and I have been giving ever since.",
      cite: "Barbara K.",
      role: "Monthly donor since 2024, signed up in Vienna",
      portrait: { kind: "device", file: "reinhard-intro-1.png", device: "phone", crop: "center", alt: "Donor portrait" },
      notes: "Let the sentence land phrase by phrase. This is the human proof behind the funnel numbers.",
    },

    /* 10 · SECTION DIVIDER 3 ------------------------------------ */
    {
      id: "section-3", archetype: "sectionDivider",
      number: 3,
      title: "Why NGOs move to us",
      sub: "Same fundraiser, same street. The tool decides how much reaches the cause.",
      notes: "Into section 3. Set up the comparison: the status quo we are replacing.",
    },

    /* 11 · COMPARISON — paper vs the app ------------------------ */
    {
      id: "app-vs-paper", archetype: "comparison",
      eyebrow: "Why NGOs move to the app",
      headline: "Paper clipboard vs Formunauts App",
      lead: "Same fundraiser, same street. The tool decides how much reaches the cause.",
      a: {
        title: "Paper clipboard",
        items: [
          { label: "Sign-up quality (verified)", score: 0.42, value: "42%" },
          { label: "Time to reach the NGO", score: 0.30, value: "9 days" },
          { label: "Early cancellations", score: 0.68, value: "high" },
          { label: "Data entry errors", score: 0.55 },
        ],
      },
      b: {
        title: "Formunauts App",
        items: [
          { label: "Sign-up quality (verified)", score: 0.94, value: "94%" },
          { label: "Time to reach the NGO", score: 0.95, value: "same day" },
          { label: "Early cancellations", score: 0.21, value: "low" },
          { label: "Data entry errors", score: 0.05 },
        ],
      },
      notes: "Left column is the status quo. Right column is where the value goes when the tool is right.",
    },

    /* 12 · LOGO WALL — who we raise for ------------------------- */
    {
      id: "partners-charities", archetype: "logoWall",
      eyebrow: "Who we raise for",
      headline: "The causes our fundraisers represent",
      lead: "The organisations our teams carry to the doorstep across AT and CH.",
      logos: [
        { src: "formunauts-post-1.png", alt: "Partner one", url: "Rotes Kreuz" },
        { src: "formunauts-post-2.png", alt: "Partner two", url: "SOS Kinderdorf" },
        { src: "formunauts-post-3.png", alt: "Partner three", url: "WWF Osterreich" },
        { src: "formunauts-post-4.png", alt: "Partner four", url: "Arzte ohne Grenzen" },
        { src: "formunauts-post-5.png", alt: "Partner five", url: "Caritas" },
        { src: "barbara-card-proof.png", alt: "Partner six", url: "Greenpeace" },
      ],
      notes: "The proof of range. Hover any mark to spotlight it; the rest dim back.",
    },

    /* 13 · SECTION DIVIDER 4 ------------------------------------ */
    {
      id: "section-4", archetype: "sectionDivider",
      number: 4,
      title: "Where we go next",
      sub: "The near-term moves and the market we open this quarter.",
      notes: "Into section 4. Close the loop: roadmap plus geography.",
    },

    /* 14 · MAP — the expansion --------------------------------- */
    {
      id: "expansion-ch", archetype: "map",
      chrome: "blue",
      eyebrow: "Where the teams stand",
      headline: "From Vienna to the Swiss market",
      lead: "Established Austrian hubs feeding the new Zurich launch this quarter.",
      region: "eu",
      pins: [
        { x: 46, y: 52, label: "Wien" },
        { x: 38, y: 58, label: "Graz" },
        { x: 30, y: 48, label: "Linz" },
        { x: 22, y: 62, label: "Zurich", tone: "accent" },
      ],
      routes: [
        { from: 0, to: 3 },
        { from: 2, to: 3 },
      ],
      caption: "Stylised outline, not to geographic scale.",
      notes: "The red pin is the new market. The routes draw from the established hubs into it.",
    },

    /* 15 · CLOSING (bookend of the cover) ---------------------- */
    {
      id: "closing", archetype: "closing",
      statement: "The field, the tool, the numbers",
      sub: "Every archetype, one Formunauts story.",
      site: "formunauts.com",
      notes: "Land the rocket. Same line as the cover, now proven across the deck.",
    },
  ],
};
