/* ============================================================
   2026-07-01.deck.js — THE ONLY FILE A NON-DEV EDITS.
   ------------------------------------------------------------
   CONTENT ONLY. One object per slide, incl. speaker `notes`.
   To make the next demo:
     1. cp this file → decks/YYYY-MM-DD.deck.js
     2. swap strings + notes below
     3. drop new PNGs into assets/img/YYYY-MM-DD/ (filenames only)
     4. point meta.imagesBase at the new folder
     5. repoint the import in index.html (or use ?deck=YYYY-MM-DD)
   Image filenames are ASCII-safe (no spaces/#). The renderer
   wraps each in an aspect-correct frame → squishing is impossible.
   ============================================================ */
export const deck = {
  meta: {
    title: "Marketing Update",
    date: "01.07.2026",
    lang: "en",
    imagesBase: "./assets/img/2026-07-01/",
  },
  slides: [
    /* 01 ---------------------------------------------------- */
    {
      id: "cover", archetype: "cover",
      eyebrow: "MARKETING · UPDATE",
      headline: "The last 3 weeks — and what's next",
      sub: "01.07.2026 · Marketing",
      notes: "Hey altogether! Quick marketing update — what we did the last weeks, what's ongoing, and what's coming up. I'll keep it tight, mostly show you the work, and we can dig into anything you want at the end. Let's go.",
    },

    /* 02 ---------------------------------------------------- */
    {
      id: "overview-recap", archetype: "overviewBullets",
      eyebrow: "MARKETING · RECAP", headline: "Last 3 weeks — at a glance",
      bullets: [
        "Switzerland charity outreach — full funnel analysed, reviewing with Max today",
        "Ambassador postings live — Reinhard on LinkedIn",
        "Italy F2F founder campaign — learnings pulled",
        "Company & social content — series kept running",
        "Ad Quality Assurance — new review routine",
      ],
      aside: [
        "UK inhouse page started", "APP NPS newsletter sent", "Q2→Q3 OKRs",
        "SSOT + Klausur kicked off", "asset cleanup",
      ],
      notes: "So the last weeks were pretty packed. The big one is the Switzerland charity outreach — full analysis done, and I'm sitting down with Max on next steps today. On top of that: Reinhard's ambassador postings are live, we pulled the Italy learnings, kept the company content going, and I set up a new ad quality-assurance routine. And a bunch of internal things on the right — UK page, the APP NPS newsletter, the whole Q2-to-Q3 OKR round, and we kicked off SSOT and the Klausur. I'll show you the highlights on the next few slides. And much more behind the scenes.",
    },

    /* 03 ---------------------------------------------------- */
    {
      id: "switzerland-funnel", archetype: "campaignAnalysis",
      eyebrow: "SWITZERLAND · CHARITY OUTREACH", headline: "The funnel",
      lead: "428 charities in, 53 real replies out — reviewing next steps with Max today.",
      funnel: [
        { label: "Targeted", value: 428 },
        { label: "Invited", value: 365 },
        { label: "Accepted", value: 98, note: "26.8%" },
        { label: "Replied", value: 53 },
      ],
      pills: [
        { label: "real conversations", value: "~25" },
        { label: "hot", value: 7, tone: "accent" },
        { label: "warm", value: 8 },
        { label: "referrals", value: 10 },
      ],
      notes: "Ok so the Switzerland charity outreach — the full funnel. We targeted 428 charities, invited 365, 98 accepted — about 27 percent — and 53 replied. Out of that around 25 real conversations, 7 of them properly hot, plus some warm ones and referrals. Sitting down with Max this afternoon for next steps. imho a really solid base to build the follow-up on. Any questions on this?",
    },

    /* 04 ---------------------------------------------------- */
    {
      id: "ambassador-reinhard", archetype: "projectVisual", layout: "hero",
      eyebrow: "AMBASSADOR · LINKEDIN", headline: "Reinhard is live",
      lead: "Intro post out, profile optimised, new post every Tuesday 09:30.",
      hero: { src: "reinhard-intro-1.png", tag: "LIVE", tone: "success" },
      thumbs: [
        { src: "reinhard-planned-2.png", tag: "PLANNED" },
        { src: "reinhard-planned-3.png", tag: "PLANNED" },
        { src: "reinhard-planned-4.png", tag: "PLANNED" },
      ],
      band: { src: "reinhard-linkedin-banner.png" },
      notes: "Ok nice — the ambassador postings are live. Reinhard's intro post is out, that's the big one on the left, and the engagement is really good so far. We optimised his whole LinkedIn profile for the ambassador content — you can see the banner along the bottom. And from now there's a new post every Tuesday at half nine; on the right are the next ones already prepared. Any questions on this?",
    },

    /* 05 ---------------------------------------------------- */
    {
      id: "italy-learnings", archetype: "projectVisual", layout: "single", backdrop: "muted",
      eyebrow: "ITALY · F2F FOUNDER CAMPAIGN", headline: "What we learned",
      bullets: [
        { t: "LinkedIn wasn't the right environment for founder recruiting", tone: "accent" },
        { t: "Barbara business cards produced", arrow: true },
        { t: "Indeed Smart CV set up", arrow: true },
        { t: "Facebook group postings", arrow: true },
        { t: "Collab check: Melandri & Zanella", arrow: true },
      ],
      notes: "The Italy F2F founder campaign — honestly not a big success, and I want to be straight about that. LinkedIn just wasn't the right environment for this kind of founder recruiting. But we didn't waste the time: we set up Barbara's business cards, the Indeed Smart CV, some Facebook group postings, and we're now checking collabs with Melandri and Zanella to reach the right people directly. Let's see what we can do with that.",
    },

    /* 06 ---------------------------------------------------- */
    {
      id: "barbara-cards", archetype: "projectVisual", layout: "single", backdrop: "muted",
      eyebrow: "ITALY · PRINT", headline: "Barbara's business cards",
      lead: "Front + back, print-ready.",
      showcase: { src: "barbara-card-proof.png" },
      notes: "And of course — here are Barbara's business cards for Italy, front and back. Turned out really clean, I'm happy with these. Print-ready and off to her.",
    },

    /* 07 ---------------------------------------------------- */
    {
      id: "ad-qa", archetype: "processDiagram",
      eyebrow: "PERFORMANCE · NEW ROUTINE", headline: "Ad Quality Assurance",
      lead: "One analysis over all running ads — big picture plus optimisation tips.",
      steps: [
        { n: 1, label: "Pull all running ads", sub: "every platform, one place", icon: "database" },
        { n: 2, label: "One holistic analysis", sub: "not dashboard-by-dashboard", icon: "scan-search" },
        { n: 3, label: "Optimisation tips", sub: "concrete & prioritised", icon: "sparkles" },
      ],
      footnote: "first step toward automating ad reviews.",
      notes: "One new thing I'm quite happy about — ad quality assurance. Instead of manually sweeping through every dashboard ad by ad, I now pull everything into one analysis: insights over all the running ads plus concrete optimisation tips. It helps me manage performance more holistically and catch things I'd otherwise miss — and imho it's the first real step toward automating our ad reviews. Any questions on this?",
    },

    /* 08 ---------------------------------------------------- */
    {
      id: "company-content", archetype: "projectVisual", layout: "masonry",
      eyebrow: "CONTENT · SOCIAL", headline: "Keeping the channel alive",
      lead: "Company posts, the donor-feedback series, the congress tour.",
      gallery: [
        "formunauts-post-1.png", "formunauts-post-2.png", "formunauts-post-3.png",
        "formunauts-post-4.png", "formunauts-post-5.png",
      ],
      notes: "Here are some more of our postings — company content, the donor-feedback series continuing, the congress tour, and a few more initiatives. Nothing revolutionary on its own, but this is the consistent drumbeat that keeps the channel alive and the brand present. And much more where that came from.",
    },

    /* 09 ---------------------------------------------------- */
    {
      id: "strategy-internal", archetype: "overviewBullets", variant: "quiet", chrome: "dark",
      eyebrow: "INTERNAL · CONTEXT", headline: "Behind the scenes",
      columns: [
        {
          title: "Strategy & web",
          items: [
            "Q2→Q3 OKRs done", "UK inhouse page started",
            "Key Value page in progress → website focus this sprint",
            "job-posting target groups set",
          ],
        },
        {
          title: "Data & ops",
          items: [
            "SSOT first steps with Elias (customer-first)",
            "Klausur kickoff done", "APP NPS newsletter sent", "asset cleanup underway",
          ],
        },
      ],
      notes: "Then the internal stuff, quickly. On strategy and web: I closed out the Q2 OKRs and built the Q3 ones, started the UK inhouse page, and the Key Value page is in progress — so that's the website focus this sprint. I also set the target groups for our job postings. On data and ops: first steps on the SSOT tool with Elias — really thinking about what we need first, customer-focused — the Klausur kickoff is done, the APP NPS newsletter went out, and asset cleanup is underway. I won't go deep here, but shout if you want detail on any of it.",
    },

    /* 10 ---------------------------------------------------- */
    {
      id: "next-steps", archetype: "nextSteps",
      eyebrow: "LOOK AHEAD · NEXT WEEKS", headline: "Next weeks & ongoing",
      columns: [
        {
          title: "Web · campaigns · content", tone: "active",
          items: [
            "UK webpage live", "Key Value page online", "adapt CH + Italy learnings",
            "ambassador content + boost postings",
            "CH email campaign (non-LinkedIn leads) + final outreach strategy",
          ],
        },
        {
          title: "Data · ops (ongoing, Q3)", tone: "muted",
          items: [
            "SSOT concept — map where data lives (whole Q3)", "asset cleanup",
            "new camera in WEBB (~2 wks)", "ONE NPS newsletter",
            "pitchdeck knowledge transfer with CC", "more automation — ad reviews & A/B tests",
          ],
        },
      ],
      notes: "Ok — what's next. On web, campaigns and content: the new UK webpage, the Key Value page online, adapting the Switzerland and Italy learnings, the next ambassador content plus boosting the postings, and a Switzerland email campaign for all the leads that didn't connect on LinkedIn — with a final strategy for new outreach. On data and ops: the single-source-of-truth concept — mapping which data sits where, that's a whole-Q3 thing, not one sprint — more asset cleanup, the new camera arriving in WEBB, the ONE NPS newsletter, a pitchdeck knowledge transfer with CC, and more automation like ad reviews and A/B testing. Let's see what we can do.",
    },

    /* 11 ---------------------------------------------------- */
    {
      id: "closing", archetype: "closing",
      statement: "From many channels to one data-driven engine.",
      sub: "Thank you", site: "formunauts.com",
      notes: "The direction behind all of this: slowly getting to integrated, multi-platform marketing on clean data processes — so we can scale marketing data-driven. That's the bigger picture. Ok then — thank you! Any last questions?",
    },
  ],
};
