/* ============================================================
   2026-07-02-ai-pitchdecks.deck.js, Knowledge Transfer CC
   "AI Pitchdecks", wie das Customer-Care-Team mit Claude Code
   on-brand F2F-Pitchdecks für Charity-Kunden baut.
   ------------------------------------------------------------
   CONTENT ONLY. Markup lebt in template/render.js.
   Quelle & Begleitmaterial: support-cc/Pitchdecks/_kit/
   (Prompt-Library, Übung, Beispiel-Deck, Session-Plan).
   Speaker Notes = kompletter Sprechtext pro Folie (Taste P).
   ============================================================ */

export const deck = {
  meta: {
    title: "AI Pitchdecks, Knowledge Transfer CC",
    date: "02.07.2026",
    lang: "de",
    imagesBase: "./assets/img/2026-07-02-ai-pitchdecks/",
  },

  slides: [

    /* 01, Cover */
    {
      id: "cover",
      archetype: "cover",
      chrome: "blue",
      eyebrow: "KNOWLEDGE TRANSFER · CUSTOMER CARE",
      headline: "AI Pitchdecks.",
      sub: "Von der Brand-Analyse zum fertigen Street-Pitch, mit Claude Code",
      timing: 30,
      notes: "Willkommen! Heute lernt ihr, wie ihr komplette F2F-Pitchdecks mit Claude Code baut, von der Brand-Analyse bis zur fertigen Datei. Fun Fact zum Einstieg: Die Tablet-Version dieser Schulung ist selbst ein HTML-Deck ohne JavaScript, gebaut mit genau dem Workflow, den ihr gleich lernt.",
    },

    /* 02, Das Ziel */
    {
      id: "ziel",
      archetype: "overviewBullets",
      variant: "quiet",
      chrome: "muted",
      eyebrow: "DAS ZIEL",
      headline: "Ein Deck. Ein Ziel. Das Ja zur Dauerspende.",
      columns: [
        {
          title: "Die Situation",
          items: [
            "F2F-Pitch am Tablet, Straße oder Haustür",
            "60-90 Sekunden Aufmerksamkeit",
            "Jede Slide muss sofort wirken",
          ],
        },
        {
          title: "Der Auftrag",
          items: [
            "Monatliche Dauerspende als Ziel",
            "Der Ask ist der Höhepunkt",
            "Alles andere ist Mittel zum Zweck",
          ],
        },
      ],
      timing: 60,
      notes: "Bevor wir über Technik reden, der Rahmen: Das Deck ist ein Verkaufswerkzeug. Passant:innen bleiben 60 bis 90 Sekunden stehen. Alles, was wir heute bauen, dient genau einem Moment, der Frage nach der monatlichen Dauerspende. Wenn eine Slide diesem Moment nicht dient, fliegt sie raus.",
    },

    /* 03, Das Ergebnis (echtes Amref-Deck, finale Version) */
    {
      id: "ergebnis",
      archetype: "bentoBoard",
      eyebrow: "DAS BAUEN WIR",
      headline: "So sieht das Ergebnis aus",
      lead: "Amref Health Africa, das echte Deck. Gleich zeige ich es live im Browser.",
      tiles: [
        {
          span: 5, rowspan: 2, tone: "plain",
          media: {
            kind: "device", file: "beispiel-boarding.jpg", device: "phone",
            crop: "center", badge: { text: "DER ASK", tone: "success" },
            alt: "Amref-Deck, Boarding-Pass-Slide am Tablet",
          },
        },
        {
          span: 7, tone: "hero",
          eyebrow: "AMREF HEALTH AFRICA",
          title: "Von Claude Code gebaut",
          text: "HTML + CSS, offline, am Tablet. Der Boarding-Pass ist der Wow-Moment direkt vor dem Ask.",
        },
        { span: 3, tone: "plain", stat: { value: "11", label: "Slides" } },
        { span: 2, tone: "plain", stat: { value: "1", label: "Datei" } },
        { span: 2, tone: "plain", stat: { value: "0", label: "JavaScript" } },
      ],
      timing: 90,
      notes: "Das ist kein Mockup, das ist das echte Amref-Deck in der finalen Version vom Mai. Elf Slides, eine einzige HTML-Datei, null JavaScript. Groß seht ihr den Boarding-Pass, den Wow-Moment direkt vor dem Ask. Gleich zeige ich das Deck live im Browser: jeder Tap eine Slide, offline, sonnenlichttauglich.",
    },

    /* 04, Werkzeuge */
    {
      id: "werkzeuge",
      archetype: "overviewBullets",
      variant: "quiet",
      eyebrow: "01 · WERKZEUGE & SETUP",
      headline: "Claude Code + ein Ordner pro Kunde",
      columns: [
        {
          title: "Das Tool: Claude Code",
          items: [
            "Liest euer Material selbst, PDFs, Fotos, Logos",
            "Baut und prüft HTML direkt am Rechner",
            "Merkt sich Kundenregeln über CLAUDE.md",
          ],
        },
        {
          title: "Der Ordner pro Kunde",
          items: [
            "ressourcen/, Logo, CI-Guide, Fotos, Texte, Zahlen",
            "CLAUDE.md, die Brand-Regeln des Kunden",
            "decks/, alle Versionen, nichts überschreiben",
          ],
        },
      ],
      timing: 60,
      notes: "Ihr braucht genau ein Tool: Claude Code als Desktop-App. Kein Cursor mehr, kein Zwei-Tool-Workflow wie im alten Guide. Zweites Prinzip: ein Ordner pro Kunde. Claude Code liest die CLAUDE.md in diesem Ordner automatisch bei jedem Start, einmal Brand-Regeln hinterlegen, für immer nutzen. Das ist euer Designsystem pro Kunde. Die Vorlage liegt im Kit unter kunden-template.",
    },

    /* 05, Material */
    {
      id: "material",
      archetype: "overviewBullets",
      eyebrow: "01 · SETUP",
      headline: "Ohne Material kein Deck",
      bullets: [
        "Logo als Originaldatei, kein Screenshot",
        "CI-Guide oder Brand-Manual als PDF",
        "8-15 starke, emotionale Fotos",
        "Mission, Stories und Kampagnentexte",
        "Zahlen mit Quellen, nie geschätzt",
      ],
      aside: [
        "Stark: bestehendes Deck oder Flyer",
        "Gütesiegel (DZI, OSGS …)",
        "Spendenbeträge + konkrete Wirkung",
      ],
      timing: 60,
      notes: "Garbage in, garbage out: 15 Minuten Material sammeln spart zwei Stunden Iteration. Am wichtigsten sind Zahlen mit Quellen, nie geschätzt, nie gerundet. Und das Logo bitte immer als Originaldatei, nie als Screenshot. Was rechts steht, ist kein Muss, macht das Deck aber deutlich stärker, vor allem konkrete Spendenbeträge mit ihrer Wirkung, die braucht der Ask.",
    },

    /* 06, Die drei Regeln */
    {
      id: "regeln",
      archetype: "bentoBoard",
      eyebrow: "NICHT VERHANDELBAR",
      headline: "Die drei Regeln",
      lead: "Sie stehen fest in jeder CLAUDE.md, Claude Code hält sie automatisch ein.",
      tiles: [
        {
          span: 4, tone: "hero",
          eyebrow: "REGEL 01", title: "Nur HTML + CSS",
          text: "Niemals JavaScript. Läuft auf jedem Tablet, offline, ohne Setup.",
        },
        {
          span: 4, tone: "plain",
          eyebrow: "REGEL 02", title: "Base64 erst am Schluss",
          text: "Entwickeln mit normalen Bildpfaden. Verpackt wird ganz am Ende, in eine Datei.",
        },
        {
          span: 4, tone: "plain",
          eyebrow: "REGEL 03", title: "CI ist heilig",
          text: "Farben, Fonts, Logo exakt wie im Brand-Guide. Nichts erfinden, fragen.",
        },
      ],
      timing: 60,
      notes: "Drei Regeln, nicht verhandelbar. Erstens: kein JavaScript, deshalb laufen die Decks auf jedem Tablet, offline, ohne Installation. Zweitens: Während der Entwicklung arbeiten wir mit normalen Bildpfaden, erst ganz am Ende wird alles per Base64 in eine einzige Datei verpackt. Drittens: Das CI des Kunden ist heilig. Bei Lücken wird gefragt, nie geraten, Charity-Brand-Compliance ist ernst.",
    },

    /* 07, Der Workflow */
    {
      id: "workflow",
      archetype: "processDiagram",
      eyebrow: "02 · DER WORKFLOW",
      headline: "Fünf Schritte. Ein fertiges Deck.",
      lead: "Für jeden Schritt liegt ein fertiger Prompt in der Library, durchnummeriert.",
      steps: [
        { n: 1, label: "Material", sub: "Alles in ressourcen/", icon: "database" },
        { n: 2, label: "Brand-Analyse", sub: "Claude erstellt BRAND.md", icon: "scan-search" },
        { n: 3, label: "Konzept", sub: "Slide-Plan, noch kein Code", icon: "sparkles" },
        { n: 4, label: "Build", sub: "Das Deck entsteht", icon: "git-branch" },
        { n: 5, label: "Testen & Verpacken", sub: "Iterieren, dann eine Datei", icon: "globe" },
      ],
      footnote: "Prompts 00-05 in der Library, kopieren, einfügen, Enter.",
      timing: 60,
      notes: "Der ganze Workflow in fünf Schritten: Material sammeln, Brand-Analyse, Konzept, Build, Testen und Verpacken. Ihr müsst euch davon nichts merken, für jeden Schritt liegt ein fertiger Prompt in der Library, durchnummeriert von 00 bis 05. Die nächsten Folien gehen die entscheidenden Schritte durch.",
    },

    /* 08, Brand-Analyse */
    {
      id: "brand",
      archetype: "overviewBullets",
      eyebrow: "SCHRITT 2 · BRAND-ANALYSE",
      headline: "Erst analysieren, dann bauen",
      bullets: [
        "Claude liest ressourcen/ komplett, vor der ersten Zeile Code",
        "Ergebnis: BRAND.md, das Designsystem des Kunden",
        "Exakte Hex-Farben aus dem CI-Guide. Nichts erfinden",
        "Fehlt etwas, fragt Claude, ihr entscheidet",
        "Einmal erstellt, für jedes weitere Deck wiederverwendet",
      ],
      aside: [
        "Ein Workflow, jede Brand:",
        "WWF · Amnesty · Amref",
        "DRK · UNICEF · Greenpeace …",
      ],
      timing: 75,
      notes: "Der wichtigste Unterschied zu naivem Drauflos-Prompten: Wir lassen Claude ZUERST analysieren. Das Ergebnis ist die BRAND.md, das Designsystem des Kunden: exakte Hex-Farben aus dem CI-Guide, Logo-Regeln, Tonalität, alle Zahlen mit Quellen, ein Bild-Inventar. Einmal erstellt, gilt sie für jedes weitere Deck dieses Kunden. Jede Charity hat eine komplett eigene Welt, aber der Workflow bleibt immer derselbe.",
    },

    /* 09, Konzept / Spannungskurve */
    {
      id: "kurve",
      archetype: "processDiagram",
      eyebrow: "SCHRITT 3 · KONZEPT",
      headline: "Die Spannungskurve",
      lead: "Konzept lesen und freigeben, erst dann wird gebaut.",
      steps: [
        { n: 1, label: "Hook", sub: "Stoppt die Person" },
        { n: 2, label: "Problem", sub: "Konkret. Ein Kind, ein Ort" },
        { n: 3, label: "Hoffnung", sub: "Die Organisation als Held:in" },
        { n: 4, label: "Impact", sub: "Was 15 € im Monat bewirken" },
        { n: 5, label: "Ask", sub: "Der Höhepunkt. Eine echte Frage" },
      ],
      footnote: "KONZEPT.md ist reiner Text, ändern kostet Minuten, fertige Slides umbauen Stunden.",
      timing: 90,
      notes: "Schritt drei ist euer größter Hebel: das Konzept. Claude plant die Slides entlang dieser Spannungskurve, vom Hook, der die Person stoppt, über das konkrete Problem und die Hoffnung bis zum Ask als Höhepunkt, formuliert als echte Frage, die die Fundraiser:in stellen kann. Und ganz wichtig: Das Konzept ist reiner Text. Ihr lest es, diskutiert es, gebt es frei, erst dann wird gebaut. Text ändern kostet Minuten, ein fertiges Deck umbauen kostet Stunden.",
    },

    /* 10, Build */
    {
      id: "build",
      archetype: "overviewBullets",
      eyebrow: "SCHRITT 4 · BUILD",
      headline: "Ein Prompt. Ein Deck.",
      bullets: [
        "Prompt 03 enthält alle technischen Regeln, nichts weglassen",
        "Scroll-Snap: Jeder Wisch genau eine Slide",
        "Tap auf den Hintergrund blättert. Zeigen blättert nicht",
        "Gradient hinter Text: lesbar auch bei Sonnenlicht",
        "Kopieren, einfügen, Enter, Claude baut das komplette Deck",
      ],
      timing: 60,
      notes: "Der Build ist der einfachste Schritt, weil der Prompt die ganze Arbeit macht. Alle bewährten Techniken aus den WWF- und Amref-Decks stecken schon drin: Scroll-Snap für sauberes Blättern, Tap-to-advance, übrigens so gebaut, dass Zeigen auf Inhalte NICHT weiterblättert, nur der Hintergrund, und Kontrast-Regeln für Sonnenlicht. Ihr kopiert Prompt 03 komplett, drückt Enter, und schaut zu.",
    },

    /* 11, Iterieren */
    {
      id: "iterieren",
      archetype: "overviewBullets",
      eyebrow: "SCHRITT 5 · ITERIEREN",
      headline: "Feedback, das Claude versteht",
      bullets: [
        "Ein Problem pro Prompt, nicht fünf auf einmal",
        "Screenshot einfügen: Hier, das ist das Problem",
        "Vor großen Änderungen eine Backup-Kopie",
        "Auf echtem iPad testen, Portrait und Landscape",
        "Jede Zahl gegen die Quellen prüfen",
      ],
      timing: 75,
      notes: "Das erste Ergebnis ist gut, perfekt wird es durch Iteration. Die wichtigste Technik: Screenshots. Screenshot machen, in Claude Code einfügen, Problem in einem Satz beschreiben, Claude sieht dann genau, was ihr seht. Immer nur ein Problem pro Prompt. Und bitte auf dem echten Gerät testen, iOS Safari verhält sich anders als Chrome am Mac, Portrait UND Landscape. Für alles gibt es fertige Iterations-Prompts in Datei 04.",
    },

    /* 12, Verpacken */
    {
      id: "verpacken",
      archetype: "bentoBoard",
      eyebrow: "SCHRITT 5 · VERPACKEN",
      headline: "Eine Datei, die überall läuft",
      lead: "Der finale Test: Flugmodus an, Datei öffnen. Alles da? Ship it.",
      tiles: [
        {
          span: 4, tone: "hero",
          stat: { value: "1", label: "HTML-Datei, alles eingebettet" },
        },
        {
          span: 4, tone: "plain",
          stat: { value: "0", label: "externe Abhängigkeiten" },
        },
        {
          span: 4, tone: "plain",
          stat: { value: "100", unit: "%", label: "offline einsatzbereit" },
        },
      ],
      timing: 60,
      notes: "Ganz am Ende verpackt Prompt 05 alles: Bilder und Schriften werden als Base64 direkt in die HTML-Datei eingebettet. Übrig bleibt eine einzige Datei, kein Ordner daneben, kein Zip, kein WLAN nötig. Genau so ist auch das Amref-Deck gebaut, das ihr vorhin gesehen habt. Der finale Test ist simpel: Flugmodus an, Datei öffnen. Wenn alles da ist: ship it. Die komplette Go-Live-Checkliste steht in Datei 05.",
    },

    /* 13, Die Prompt-Library */
    {
      id: "library",
      archetype: "overviewBullets",
      eyebrow: "03 · DIE PROMPT-LIBRARY",
      headline: "Kopieren, einfügen, anpassen",
      bullets: [
        "00 · Setup & Material, Tool installieren, Kundenordner anlegen",
        "01 · Brand-Analyse, BRAND.md, das Designsystem des Kunden",
        "02 · Konzept, Slide-Plan mit Spannungskurve, zum Freigeben",
        "03 · Build, das Deck, alle Tech-Regeln eingebaut",
        "04 · Iteration, fertige Feedback-Prompts für jede Lage",
        "05 · Verpacken, Base64, Offline-Test, Go-Live-Checkliste",
      ],
      aside: [
        "Plus 06 · Troubleshooting",
        "support-cc/Pitchdecks/_kit/prompt-library/",
      ],
      timing: 60,
      notes: "Die komplette Library liegt im Kit unter support-cc, Pitchdecks, Unterordner kit. Sechs Workflow-Dateien plus Troubleshooting. Jede Datei erklärt kurz das Warum und enthält dann einen fertigen Prompt-Block zum Kopieren, ihr müsst nichts selbst formulieren, nur die Reihenfolge einhalten. Datei 06 löst die zwölf häufigsten Probleme mit fertigen Fix-Prompts. Da schaut ihr rein, bevor ihr mich fragt.",
    },

    /* 14, Die Übung (id "next-steps" → Raketen-Watermark) */
    {
      id: "next-steps",
      archetype: "nextSteps",
      eyebrow: "04 · DIE ÜBUNG",
      headline: "Jetzt ihr: Amref Health Africa",
      columns: [
        {
          title: "Live in der Session",
          tone: "active",
          items: [
            { t: "_kit/uebung/ in Claude Code öffnen", when: "jetzt" },
            { t: "Prompt 01, Brand-Analyse läuft live", when: "~5 min" },
            { t: "BRAND.md gemeinsam lesen, Farben? Zahlen?", when: "~10 min" },
            { t: "Prompt 02, Konzept, den Ask laut diskutieren", when: "~10 min" },
          ],
        },
        {
          title: "Danach, zu Hause",
          tone: "muted",
          items: [
            { t: "Prompt 03, Build starten" },
            { t: "Iterieren (04) und Verpacken (05)" },
            { t: "Ergebnis in Slack teilen" },
            { t: "Referenz: _kit/beispiel/, das fertige Amref-Deck" },
          ],
        },
      ],
      timing: 120,
      notes: "Jetzt seid ihr dran. Im Kit liegt der Ordner uebung, ein fertiger Amref-Kundenordner mit echtem Brandbook, Logo, acht Fotos und der Mission-Story samt Zahlen. Wir öffnen ihn zusammen in Claude Code und fahren die ersten Schritte live: Prompt 01 rein, die Brand-Analyse läuft ein paar Minuten, währenddessen schauen wir uns das Material an. Dann lesen wir die BRAND.md gemeinsam und prüfen stichprobenartig Farben und Quellen. Danach Prompt 02 und die spannendste Diskussion: Ist der Ask stark genug? Hausaufgabe: Build, Iteration, Verpacken, und das Ergebnis in Slack teilen.",
    },

    /* 15, Closing */
    {
      id: "closing",
      archetype: "closing",
      chrome: "blue",
      statement: "Kopiert das Template. Baut euer erstes Deck.",
      sub: "Fragen? Erst 06-troubleshooting.md, dann Samuel.",
      site: "formunauts.com",
      timing: 30,
      notes: "Das war's. Alles, was ihr braucht, liegt im Kit: Präsentation, Prompts, Kunden-Template, Übung und das fertige Beispiel. Kopiert das Template, baut euer erstes Deck, teilt das Ergebnis. Das Ziel ist, dass ihr das bald besser könnt als ich. Danke euch!",
    },

  ],
};
