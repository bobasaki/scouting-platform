import {
  ALMEDIA_VERTICALS,
  type AlmediaChannelEnrichment,
  type AlmediaVertical,
} from "@scouting-platform/contracts";

/**
 * The controlled vertical vocabulary used across the Almedia workspace, ported
 * from the standalone tracker's `dashboard/src/performance/verticals.ts`.
 *
 * A creator is placed in the vocabulary by scoring the free text of their
 * channel enrichment against a keyword list per vertical. The alternative — the
 * booking's own hand-typed `vertical` — is inconsistent and often blank, so the
 * derived value wins wherever an enrichment exists.
 */

export const VERTICALS = ALMEDIA_VERTICALS;

export type Vertical = AlmediaVertical;

export function canonicalVertical(value: string | null | undefined): Vertical | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return VERTICALS.find((vertical) => vertical.toLowerCase() === normalized) ?? null;
}

const VERTICAL_KEYWORDS = {
  "Abandoned Places": [
    "abandoned places",
    "urban exploration",
    "urbex",
    "derelict buildings",
  ],
  Adventure: ["adventure", "expedition", "extreme experiences", "survival challenge"],
  Animals: ["animals", "wildlife", "animal welfare", "zoo", "farm animals"],
  Animations: ["animation", "animations", "animated", "animator"],
  Anime: ["anime", "manga", "otaku"],
  Art: ["art", "artist", "drawing", "illustration", "sculpture"],
  ASMR: ["asmr", "sleep aid", "relaxation roleplay", "satisfying content"],
  Astrology: ["astrology", "zodiac", "horoscope"],
  Aviation: ["aviation", "aircraft", "airline", "pilot", "flying"],
  Books: ["books", "book reviews", "literature", "author", "reading"],
  Budgeting: ["budgeting", "saving money", "frugal", "personal budget"],
  Cars: ["cars", "automotive", "vehicles", "car restoration", "motoring"],
  Chess: ["chess"],
  Commentary: [
    "commentary",
    "reaction videos",
    "reactions",
    "criticism",
    "video essays",
  ],
  Conspiracy: ["conspiracy", "conspiracy theories"],
  Construction: ["construction", "building projects", "contractor"],
  Cosplay: ["cosplay", "costume making"],
  Crimes: [
    "true crime",
    "crime",
    "criminal cases",
    "police investigation",
    "crónica negra",
  ],
  Cybersecurity: [
    "cybersecurity",
    "cyber security",
    "online privacy",
    "hacking",
    "infosec",
  ],
  Cycling: ["cycling", "bicycle", "bmx", "bike entertainment"],
  Dance: ["dance", "dancing", "choreography"],
  DIY: ["diy", "crafts", "maker projects", "do it yourself"],
  Documentary: [
    "documentary",
    "documentaries",
    "mini documentaries",
    "investigative storytelling",
  ],
  Editing: ["editing", "video editing", "post production", "editing software"],
  Education: [
    "education",
    "educational",
    "learning",
    "tutorial",
    "quiz",
    "quizzes",
    "geography",
    "trivia",
  ],
  Engineering: ["engineering", "engineer", "mechanical design"],
  Entertainment: ["entertainment", "challenges", "pranks", "sketches"],
  Environment: [
    "environment",
    "environmental",
    "climate",
    "sustainability",
    "conservation",
  ],
  Family: ["family", "family life", "family entertainment", "couple and family"],
  Fashion: ["fashion", "style", "clothing", "wardrobe"],
  Finance: ["finance", "investing", "investment", "financial education", "money"],
  Fishing: ["fishing", "angling"],
  Fitness: ["fitness", "workout", "training", "bodybuilding", "gym"],
  Food: ["food", "cooking", "restaurants", "recipes", "baking", "cake decorating"],
  Football: ["football", "soccer", "premier league", "serie a", "ac milan"],
  Gaming: [
    "gaming",
    "video games",
    "gameplay",
    "gamer",
    "esports",
    "geoguessr",
    "roblox",
  ],
  Guitars: ["guitar", "guitars", "guitarist"],
  Health: ["health", "medical", "medicine", "wellness"],
  History: ["history", "historical", "heritage"],
  "Home Decor": [
    "home decor",
    "interior design",
    "interior styling",
    "home organization",
  ],
  "Home Renovation": [
    "home renovation",
    "house renovation",
    "property restoration",
    "château restoration",
  ],
  Humor: ["humor", "comedy", "comedic", "satire", "funny"],
  Hunting: ["hunting", "hunter"],
  Infotainment: [
    "infotainment",
    "explainer",
    "facts",
    "educational entertainment",
  ],
  Interview: ["interview", "interviews", "guest conversations"],
  Journalism: [
    "journalism",
    "journalist",
    "investigative reporting",
    "street journalism",
  ],
  "Just Chatting": ["just chatting", "chat stream", "livestream conversation"],
  Kids: ["kids", "children", "toys for children", "youth entertainment"],
  Lego: ["lego", "brick building"],
  Lifestyle: ["lifestyle", "daily life", "personal updates"],
  Minecraft: ["minecraft"],
  Motivation: [
    "motivation",
    "motivational",
    "self improvement",
    "personal growth",
  ],
  Movies: ["movies", "film", "films", "cinema", "television", "tv criticism"],
  Music: ["music", "musician", "singing", "song", "piano"],
  Mystery: ["mystery", "paranormal", "unsolved", "horror storytelling"],
  News: ["news", "current affairs", "breaking news"],
  Outdoor: ["outdoor", "outdoors", "camping", "hiking", "bushcraft"],
  Painting: ["painting", "painter", "watercolor"],
  Parenting: ["parenting", "motherhood", "fatherhood", "baby products"],
  Pets: ["pets", "pet care", "dogs", "cats"],
  Photography: ["photography", "photographer", "camera gear", "videography"],
  Plants: ["plants", "gardening", "houseplants", "garden"],
  Podcast: ["podcast", "podcasts"],
  "Pokemon Cards": ["pokemon cards", "pokémon cards", "pokemon tcg"],
  Politics: ["politics", "political", "elections", "government"],
  "Pop Culture": [
    "pop culture",
    "celebrity",
    "internet culture",
    "fandom culture",
  ],
  Reviews: ["reviews", "review", "product testing", "cheap vs expensive"],
  Science: ["science", "scientific", "physics", "biology", "chemistry"],
  Society: ["society", "social issues", "social commentary", "culture"],
  Sport: ["sport", "sports", "baseball", "basketball", "athletics"],
  TCG: ["tcg", "trading cards", "trading card game", "collectible cards"],
  Tech: ["tech", "technology", "consumer tech", "ai tools", "software"],
  Travel: ["travel", "tourism", "destination guides", "hotels", "local culture"],
  Variety: ["variety", "mixed content", "variety creator"],
  Vlog: ["vlog", "vlogs", "vlogging"],
  Yoga: ["yoga"],
  Beauty: ["beauty", "makeup", "skincare", "haircare", "cosmetics", "salon"],
} satisfies Record<Vertical, readonly string[]>;

/**
 * Catch-all verticals almost every creator matches on. Discounted so a specific
 * label ("Crimes") outranks the generic one ("Entertainment") it sits inside.
 */
const GENERIC_VERTICAL_MULTIPLIER: Partial<Record<Vertical, number>> = {
  Commentary: 0.82,
  Entertainment: 0.58,
  Infotainment: 0.72,
  Lifestyle: 0.68,
  Society: 0.78,
  Variety: 0.55,
  Vlog: 0.72,
};

/** Strip accents and punctuation so phrase matching is whitespace-delimited. */
function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

/** Whole-word containment, so "art" does not match inside "start". */
function includesPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

/** Below this a match is coincidence rather than a signal. */
const MIN_VERTICAL_SCORE = 6;

/**
 * Score a creator's enrichment text against the vertical vocabulary and return
 * the best (at most two) matches.
 *
 * Sources are weighted by how deliberate they are: the classifier's own niche
 * counts most, the channel description least. Multi-word phrases and exact
 * whole-field matches count for more than an incidental keyword hit.
 */
export function deriveVerticals(
  enrichment: AlmediaChannelEnrichment | null | undefined,
  maximum = 2,
): Vertical[] {
  if (!enrichment || maximum <= 0) {
    return [];
  }

  const { channel, classification, summary } = enrichment;
  const sources = [
    { text: classification.niche, weight: 9 },
    ...classification.topics.map((text) => ({ text, weight: 6 })),
    ...classification.brandFit.categories.map((text) => ({ text, weight: 3 })),
    ...channel.topics.map((text) => ({ text, weight: 3 })),
    ...channel.keywords.map((text) => ({ text, weight: 2 })),
    { text: classification.audiencePositioning, weight: 3 },
    { text: summary, weight: 2 },
    { text: channel.description, weight: 1 },
  ].map((source) => ({ ...source, text: normalize(source.text) }));

  const scores = VERTICALS.map((vertical, index) => {
    const phrases = [
      ...new Set([vertical, ...VERTICAL_KEYWORDS[vertical]].map(normalize)),
    ];
    let score = 0;

    for (const source of sources) {
      if (!source.text) continue;

      for (const phrase of phrases) {
        if (!phrase || !includesPhrase(source.text, phrase)) continue;

        const phraseWeight = phrase.includes(" ") ? 2.4 : 1;
        const exactWeight = source.text === phrase ? 1.5 : 1;

        score += source.weight * phraseWeight * exactWeight;
      }
    }

    return {
      vertical,
      index,
      score: score * (GENERIC_VERTICAL_MULTIPLIER[vertical] ?? 1),
    };
  })
    .filter((item) => item.score >= MIN_VERTICAL_SCORE)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const topScore = scores[0]?.score ?? 0;

  // The runner-up only earns a slot if it is within reach of the winner;
  // otherwise a single weak keyword hit would read as a second vertical.
  return scores
    .filter(
      (item, index) =>
        index === 0 || item.score >= Math.max(MIN_VERTICAL_SCORE, topScore * 0.15),
    )
    .slice(0, Math.min(2, maximum))
    .map((item) => item.vertical);
}
