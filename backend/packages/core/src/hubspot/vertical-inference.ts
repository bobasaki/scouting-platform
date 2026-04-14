import {
  channelAudienceInterestSchema,
  channelStructuredProfileSchema,
} from "@scouting-platform/contracts";

type VerticalSignalSource =
  | "nichePrimary"
  | "nicheSecondary"
  | "topic"
  | "audienceInterest";

type SignalValue = {
  source: VerticalSignalSource;
  raw: string;
  normalized: string;
};

type VerticalMapping = {
  vertical: string;
  aliases: readonly string[];
  suppresses?: readonly string[];
};

type VerticalCandidateState = {
  vertical: string;
  score: number;
  evidence: string[];
  matchedSignals: Set<string>;
  bestSourceRank: number;
};

const SIGNAL_WEIGHTS: Record<VerticalSignalSource, number> = {
  nichePrimary: 4,
  nicheSecondary: 2,
  topic: 3,
  audienceInterest: 1,
};

const MIN_VERTICAL_SCORE = 3;
const MAX_VERTICALS = 5;
const SOURCE_RANKS: Record<VerticalSignalSource, number> = {
  nichePrimary: 0,
  nicheSecondary: 1,
  topic: 2,
  audienceInterest: 3,
};

const VERTICAL_SIGNAL_MAP: readonly VerticalMapping[] = [
  { vertical: "Minecraft", aliases: ["minecraft"], suppresses: ["Gaming"] },
  { vertical: "Gaming", aliases: ["gaming", "games", "esports", "twitch", "fortnite", "valorant", "league of legends"] },
  { vertical: "Tech", aliases: ["tech", "technology", "gadgets", "software", "hardware", "programming", "coding", "pc build", "pc builds"] },
  { vertical: "Beauty", aliases: ["beauty", "makeup", "skincare", "cosmetics", "hair"] },
  { vertical: "Fashion", aliases: ["fashion", "style", "clothing", "outfits"] },
  { vertical: "Fitness", aliases: ["fitness", "gym", "workout", "exercise", "bodybuilding"] },
  { vertical: "Food", aliases: ["food", "cooking", "recipe", "baking", "cuisine", "restaurant"] },
  { vertical: "Travel", aliases: ["travel", "traveling", "destination", "backpacking", "tourism"] },
  { vertical: "Music", aliases: ["music", "musician", "producer", "beats", "guitar", "singing"] },
  { vertical: "Education", aliases: ["education", "learning", "tutorial", "study", "lecture"] },
  { vertical: "Science", aliases: ["science", "physics", "chemistry", "biology", "space", "astronomy"] },
  { vertical: "Humor", aliases: ["comedy", "humor", "funny", "sketch", "standup"] },
  { vertical: "News", aliases: ["news", "journalism", "current events", "breaking"] },
  { vertical: "Politics", aliases: ["politics", "political", "government", "election"] },
  { vertical: "Sport", aliases: ["sport", "sports", "athletics"] },
  { vertical: "Football", aliases: ["football", "soccer"], suppresses: ["Sport"] },
  { vertical: "Art", aliases: ["art", "drawing", "illustration", "digital art", "painting"] },
  { vertical: "Photography", aliases: ["photography", "photo", "camera", "lens"] },
  { vertical: "Movies", aliases: ["film", "cinema", "movie", "movies", "film review"] },
  { vertical: "Anime", aliases: ["anime", "manga", "otaku"] },
  { vertical: "DIY", aliases: ["diy", "craft", "crafts", "handmade", "maker"] },
  { vertical: "Pets", aliases: ["pets", "pet", "dog", "dogs", "cat", "cats", "animal", "animals"] },
  { vertical: "Vlog", aliases: ["vlog", "vlogging", "day in my life", "daily vlog"] },
  { vertical: "Podcast", aliases: ["podcast", "podcasting"] },
  { vertical: "Interview", aliases: ["interview", "interviews"] },
  { vertical: "Finance", aliases: ["finance", "investing", "stocks", "crypto", "money", "trading"] },
  { vertical: "Health", aliases: ["health", "wellness", "mental health", "nutrition", "diet"] },
  { vertical: "Lifestyle", aliases: ["lifestyle"] },
  { vertical: "History", aliases: ["history", "historical", "ancient"] },
  { vertical: "Cars", aliases: ["cars", "car", "automotive", "vehicle", "vehicles"] },
  { vertical: "ASMR", aliases: ["asmr"] },
  { vertical: "Outdoor", aliases: ["outdoor", "hiking", "camping", "nature", "wilderness"] },
  { vertical: "Mystery", aliases: ["mystery", "true crime", "crime", "unsolved"] },
  { vertical: "Kids", aliases: ["kids", "children", "family friendly"] },
  { vertical: "Commentary", aliases: ["commentary", "opinion", "reaction", "rant"] },
  { vertical: "Reviews", aliases: ["reviews", "review", "unboxing", "product review"] },
  { vertical: "Entertainment", aliases: ["entertainment"] },
  { vertical: "Motivation", aliases: ["motivation", "self improvement", "mindset", "productivity"] },
  { vertical: "Fishing", aliases: ["fishing"] },
  { vertical: "Hunting", aliases: ["hunting"] },
  { vertical: "Yoga", aliases: ["yoga", "meditation"] },
  { vertical: "Lego", aliases: ["lego", "legos"] },
  { vertical: "Chess", aliases: ["chess"] },
  { vertical: "Cycling", aliases: ["cycling", "bike", "biking"] },
  { vertical: "Dance", aliases: ["dance", "dancing", "choreography"] },
  { vertical: "Documentary", aliases: ["documentary"] },
  { vertical: "Engineering", aliases: ["engineering", "engineer"] },
  { vertical: "Construction", aliases: ["construction", "building"] },
  { vertical: "Guitars", aliases: ["guitars", "guitar", "bass guitar"] },
  { vertical: "Plants", aliases: ["plants", "gardening", "garden"] },
  { vertical: "Parenting", aliases: ["parenting", "parent", "mom", "dad"] },
  { vertical: "Cosplay", aliases: ["cosplay"] },
  { vertical: "Astrology", aliases: ["astrology", "horoscope", "zodiac"] },
  { vertical: "Conspiracy", aliases: ["conspiracy", "conspiracies"] },
] as const;

function normalizeSignal(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function matchesAlias(signal: string, alias: string): boolean {
  if (signal === alias) {
    return true;
  }

  return new RegExp(`(^|\\s)${escapeRegex(alias)}(\\s|$)`, "u").test(signal);
}

function pushSignal(
  collection: SignalValue[],
  source: VerticalSignalSource,
  value: string | null | undefined,
): void {
  if (!value?.trim()) {
    return;
  }

  collection.push({
    source,
    raw: value.trim(),
    normalized: normalizeSignal(value),
  });
}

function collectSignals(input: {
  structuredProfile: unknown;
  topics: unknown;
  audienceInterests: unknown;
}): SignalValue[] {
  const signals: SignalValue[] = [];
  const structuredProfile = channelStructuredProfileSchema.safeParse(input.structuredProfile);

  if (structuredProfile.success) {
    pushSignal(signals, "nichePrimary", structuredProfile.data.primaryNiche);

    for (const value of structuredProfile.data.secondaryNiches) {
      pushSignal(signals, "nicheSecondary", value);
    }
  }

  if (Array.isArray(input.topics)) {
    for (const topic of input.topics) {
      if (typeof topic === "string") {
        pushSignal(signals, "topic", topic);
      }
    }
  }

  const audienceInterests = channelAudienceInterestSchema.array().safeParse(input.audienceInterests);

  if (audienceInterests.success) {
    for (const interest of audienceInterests.data) {
      if (interest.score !== null && interest.score < 0.5) {
        continue;
      }

      pushSignal(signals, "audienceInterest", interest.label);
    }
  }

  return signals;
}

function scoreVerticals(signals: readonly SignalValue[]): Map<string, VerticalCandidateState> {
  const candidates = new Map<string, VerticalCandidateState>();

  for (const signal of signals) {
    const signalKey = `${signal.source}:${signal.normalized}`;

    for (const mapping of VERTICAL_SIGNAL_MAP) {
      const matched = mapping.aliases.some((alias) =>
        matchesAlias(signal.normalized, normalizeSignal(alias)));

      if (!matched) {
        continue;
      }

      const candidate = candidates.get(mapping.vertical) ?? {
        vertical: mapping.vertical,
        score: 0,
        evidence: [],
        matchedSignals: new Set<string>(),
        bestSourceRank: SOURCE_RANKS[signal.source],
      };

      if (!candidate.matchedSignals.has(signalKey)) {
        candidate.score += SIGNAL_WEIGHTS[signal.source];
        candidate.matchedSignals.add(signalKey);
      }

      candidate.bestSourceRank = Math.min(candidate.bestSourceRank, SOURCE_RANKS[signal.source]);

      const evidenceLabel = `${signal.source}:${signal.raw}`;

      if (!candidate.evidence.includes(evidenceLabel)) {
        candidate.evidence.push(evidenceLabel);
      }

      candidates.set(mapping.vertical, candidate);
    }
  }

  return candidates;
}

function applySuppressionRules(
  candidates: Map<string, VerticalCandidateState>,
): Map<string, VerticalCandidateState> {
  const filtered = new Map(candidates);

  for (const mapping of VERTICAL_SIGNAL_MAP) {
    if (!mapping.suppresses?.length) {
      continue;
    }

    const child = filtered.get(mapping.vertical);

    if (!child) {
      continue;
    }

    for (const suppressedVertical of mapping.suppresses) {
      const parent = filtered.get(suppressedVertical);

      if (!parent || child.score < parent.score) {
        continue;
      }

      const parentSignalsCovered = [...parent.matchedSignals].every((signal) =>
        child.matchedSignals.has(signal));

      if (parentSignalsCovered) {
        filtered.delete(suppressedVertical);
      }
    }
  }

  return filtered;
}

export function inferVerticalsForHubspot(input: {
  structuredProfile: unknown;
  topics: unknown;
  audienceInterests: unknown;
}): string[] {
  const signals = collectSignals(input);

  if (signals.length === 0) {
    return [];
  }

  const scored = scoreVerticals(signals);
  const aboveThreshold = new Map(
    [...scored.entries()].filter(([, candidate]) => candidate.score >= MIN_VERTICAL_SCORE),
  );

  if (aboveThreshold.size === 0) {
    return [];
  }

  return [...applySuppressionRules(aboveThreshold).values()]
    .sort((left, right) =>
      left.bestSourceRank - right.bestSourceRank
      || right.score - left.score
      || left.vertical.localeCompare(right.vertical))
    .slice(0, MAX_VERTICALS)
    .map((candidate) => candidate.vertical);
}

export function serializeHubspotMultiSelect(values: readonly string[]): string {
  const unique = Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  );

  return unique.join(";");
}
