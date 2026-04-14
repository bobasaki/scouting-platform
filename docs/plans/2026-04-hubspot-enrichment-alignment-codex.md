# Codex Implementation Guide: HubSpot Push Alignment

- Status: Completed
- Date: 2026-04-14
- Owner: Ivan

---

## Context

An audit of the HubSpot integration revealed three problems:

1. **The HubSpot push is broken.** `buildHubspotContactProperties()` writes to 10 property names
   (`channel_id`, `youtube_channel_id`, `creator_title`, `creator_handle`, `subscriber_count`,
   `view_count`, `video_count`, `enrichment_summary`, `enrichment_topics`, `brand_fit_notes`)
   that do not exist in HubSpot. HubSpot silently ignores unknown properties in PATCH requests,
   so the push appears to succeed but writes nothing useful.

2. **Computed metrics are not pushed.** The platform already derives `youtubeAverageViews`,
   `youtubeEngagementRate`, and `youtubeFollowers` in `ChannelMetric`, but none of these reach
   HubSpot. HubSpot has matching numeric properties (`youtube_video_average_views`,
   `youtube_engagement_rate`, `youtube_followers`) waiting to be populated.

3. **Creator-level facts derivable from YouTube API are not extracted.** The YouTube channels
   API returns `defaultLanguage` in the snippet, but the platform does not parse or store it.
   HubSpot has a `language` enumeration with 40+ values that could be populated.

### Design decision: No LLM enrichment changes

The OpenAI enrichment (`summary`, `topics`, `brandFitNotes`, `confidence`) is doing the right
job — synthesizing channel data into a human-readable evaluation for the scout. It should NOT be
expanded to classify creators into HubSpot's dropdown taxonomies because:

- **Classification is already handled.** The HubSpot preparation workflow lets the user set
  `influencerVertical`, `influencerType`, `language`, and `countryRegion` as run-level defaults
  with per-row overrides. This happens with campaign context, which the LLM does not have.
- **LLM classification into rigid enums is unreliable.** A "PC builds and gaming" creator is
  Gaming for one campaign and Tech for another. The user knows; the LLM guesses.
- **Coupling enrichment to HubSpot's taxonomy creates maintenance debt.** If HubSpot's enum
  options change, the prompt constants break.

Instead, this plan derives what can be derived deterministically (size tier from subscriber count,
language from YouTube API, best-effort influencer verticals from existing enrichment + insight
signals) and leaves the rest to
the human classification step that already exists.

### HubSpot Properties (Reference)

**Enumeration dropdowns (searchable/filterable):**

- `influencer_vertical` — multi-select enumeration. In HubSpot API writes, multiple values are
  sent as a semicolon-delimited string of option labels. Current values include: Abandoned Places,
  Adventure, Animals, Animations, Anime,
  Art, ASMR, Astrology, Aviation, Beauty, Books, Budgeting, Cars, Chess, Commentary,
  Conspiracy, Construction, Cosplay, Crimes, Cybersecurity, Cycling, Dance, DIY, Documentary,
  Editing, Education, Engineering, Entertainment, Environment, Family, Fashion, Finance,
  Fishing, Fitness,
  Food, Football, Gaming, Guitars, Health, History, Home Decor, Home Renovation, Humor, Hunting,
  Infotainment, Interview, Journalism, Just Chatting, Kids, Lego, Lifestyle, Minecraft,
  Motivation, Movies, Music, Mystery, News, Outdoor, Painting, Parenting, Pets, Photography,
  Plants, Podcast, Pokemon Cards, Politics, Pop Culture, Reviews, Science, Society, Sport, TCG,
  Tech, Travel, Variety, Vlog, Yoga
- `influencer_type` — Male, Female, Couple, Family, Team, Animation, Kids, Faceless, Duo
- `influencer_size` — Nano (1K - 5K), Micro (5K - 20K), Mid-tier (20K - 100K),
  Macro (100K - 500K), Mega (500K - 1M), Macro-tier (1M+)
- `language` — English (US), English (UK), Spanish, French, German, Italian, Portuguese, Dutch,
  Swedish, Danish, Norwegian, Finnish, Polish, Czech, Slovak, Hungarian, Romanian, Bulgarian,
  Croatian, Serbian, Slovenian, Albanian, Greek, Ukrainian, Russian, Turkish, Arabic, Hebrew,
  Hindi, Bengali, Tamil, Telugu, Marathi, Urdu, Indonesian, Malay, Thai, Vietnamese, Filipino,
  Chinese, Japanese, Korean
- `platforms` — YouTube, Instagram, TikTok, Twitter, Twitch, Kick
- `contact_type` — Influencer, Agent, Client, Partner

**Numeric fields:**

- `youtube_followers`, `youtube_video_average_views`, `youtube_video_median_views`,
  `youtube_engagement_rate`, `youtube_shorts_average_views`, `youtube_shorts_median_views`

**Text fields:**

- `youtube_url`, `youtube_handle`, `influencer_url`

---

## Constraints

- ADR-002 precedence rules unchanged
- No OpenAI prompt or output schema changes
- No new queue families or worker processes
- No frontend changes
- Enrichment fields (`summary`, `topics`, `brandFitNotes`, `confidence`) untouched
- HubSpot preparation workflow (import batch path) untouched

---

## Delivery Shape

Four sessions, executed in order. Each is self-contained and testable.

| Session | Scope | Schema change? |
|---------|-------|----------------|
| 1 | Fix property mapping + push metrics | No |
| 2 | Influencer size tier utility | No |
| 3 | Extract language from YouTube API, store on channel, push | Yes — one column |
| 4 | Best-effort multi-vertical inference at push time | No |

---

## Session 1 — Fix HubSpot Property Mapping

**Scope:** Rewrite `buildHubspotContactProperties()` to push to property names that actually
exist in HubSpot. Push YouTube metrics already computed in `ChannelMetric`. No schema changes.

### 1A. Update the channel push select

File: `backend/packages/core/src/hubspot/index.ts`

Expand `channelPushSelect` to include the metric fields needed for the new mapping:

```typescript
const channelPushSelect = {
  id: true,
  youtubeChannelId: true,
  title: true,
  handle: true,
  youtubeUrl: true,
  contacts: {
    orderBy: {
      email: "asc",
    },
    select: {
      email: true,
    },
  },
  metrics: {
    select: {
      subscriberCount: true,
      viewCount: true,
      videoCount: true,
      youtubeAverageViews: true,
      youtubeEngagementRate: true,
      youtubeFollowers: true,
    },
  },
  enrichment: {
    select: {
      summary: true,
      topics: true,
      brandFitNotes: true,
    },
  },
} as const;
```

Changes vs current:
- Added `youtubeUrl: true` to channel select
- Added `youtubeAverageViews`, `youtubeEngagementRate`, `youtubeFollowers` to metrics select

### 1B. Rewrite `buildHubspotContactProperties`

File: `backend/packages/core/src/hubspot/index.ts`

Replace the current function body. The new function maps to property names that exist in HubSpot:

```typescript
export function buildHubspotContactProperties(channel: PushChannelRecord): Record<string, string> {
  const subscriberCount = channel.metrics?.subscriberCount;

  return {
    email: channel.contacts[0]?.email ?? "",
    contact_type: "Influencer",
    platforms: "YouTube",
    youtube_url: channel.youtubeUrl
      ?? `https://www.youtube.com/channel/${channel.youtubeChannelId}`,
    youtube_handle: channel.handle ?? "",
    influencer_url: channel.youtubeUrl
      ?? `https://www.youtube.com/channel/${channel.youtubeChannelId}`,
    youtube_followers: channel.metrics?.youtubeFollowers?.toString()
      ?? subscriberCount?.toString()
      ?? "",
    youtube_video_average_views: channel.metrics?.youtubeAverageViews?.toString() ?? "",
    youtube_engagement_rate: channel.metrics?.youtubeEngagementRate?.toString() ?? "",
    influencer_size: computeInfluencerSizeTier(subscriberCount),
  };
}
```

For Session 1, add `computeInfluencerSizeTier` as an inline function above
`buildHubspotContactProperties`:

```typescript
function computeInfluencerSizeTier(subscriberCount: bigint | null | undefined): string {
  if (subscriberCount === null || subscriberCount === undefined) return "";
  const count = Number(subscriberCount);
  if (count >= 1_000_000) return "Macro-tier (1M+)";
  if (count >= 500_000) return "Mega (500K - 1M)";
  if (count >= 100_000) return "Macro (100K - 500K)";
  if (count >= 20_000) return "Mid-tier (20K - 100K)";
  if (count >= 5_000) return "Micro (5K - 20K)";
  if (count >= 1_000) return "Nano (1K - 5K)";
  return "";
}
```

The tier labels **must** exactly match the HubSpot `influencer_size` enum values listed above.

### 1C. Tests

File: `backend/packages/core/src/hubspot/index.test.ts` (create if it does not exist)

Test `buildHubspotContactProperties`:

1. **Maps YouTube metrics to correct HubSpot property names**
   Input: channel with `youtubeUrl: "https://youtube.com/@test"`, `handle: "@test"`,
   `youtubeFollowers: 150000n`, `youtubeAverageViews: 25000n`, `youtubeEngagementRate: 3.5`.
   Assert: output contains `youtube_url`, `youtube_handle`, `youtube_followers: "150000"`,
   `youtube_video_average_views: "25000"`, `youtube_engagement_rate: "3.5"`.

2. **Sets contact_type and platforms**
   Assert: `contact_type === "Influencer"`, `platforms === "YouTube"`.

3. **Falls back to channel ID URL when youtubeUrl is null**
   Input: `youtubeUrl: null`, `youtubeChannelId: "UCxyz"`.
   Assert: `youtube_url` and `influencer_url` both equal
   `"https://www.youtube.com/channel/UCxyz"`.

4. **Returns empty strings for missing metrics**
   Input: `metrics: null`.
   Assert: `youtube_followers`, `youtube_video_average_views`, `youtube_engagement_rate` are
   all `""`.

5. **Computes influencer_size tier correctly**
   Test each boundary: 500 → `""`, 1000 → `"Nano (1K - 5K)"`, 5000 → `"Micro (5K - 20K)"`,
   20000 → `"Mid-tier (20K - 100K)"`, 100000 → `"Macro (100K - 500K)"`,
   500000 → `"Mega (500K - 1M)"`, 1000000 → `"Macro-tier (1M+)"`.

6. **Does NOT include old property names**
   Assert: output does not have keys `channel_id`, `youtube_channel_id`, `creator_title`,
   `creator_handle`, `subscriber_count`, `view_count`, `video_count`, `enrichment_summary`,
   `enrichment_topics`, or `brand_fit_notes`.

### Session 1 verification

```bash
pnpm --filter @scouting-platform/core typecheck
pnpm --filter @scouting-platform/core exec vitest run src/hubspot
```

---

## Session 2 — Influencer Size Tier as Shared Utility

**Scope:** Extract `computeInfluencerSizeTier` into its own file for independent testing and
reuse.

### 2A. Create the utility

File: `backend/packages/core/src/hubspot/influencer-size.ts` (new file)

```typescript
const INFLUENCER_SIZE_TIERS = [
  { min: 1_000_000, label: "Macro-tier (1M+)" },
  { min: 500_000, label: "Mega (500K - 1M)" },
  { min: 100_000, label: "Macro (100K - 500K)" },
  { min: 20_000, label: "Mid-tier (20K - 100K)" },
  { min: 5_000, label: "Micro (5K - 20K)" },
  { min: 1_000, label: "Nano (1K - 5K)" },
] as const;

export type InfluencerSizeTier = (typeof INFLUENCER_SIZE_TIERS)[number]["label"];

export function computeInfluencerSizeTier(
  subscriberCount: bigint | number | null | undefined,
): string {
  if (subscriberCount === null || subscriberCount === undefined) return "";
  const count = Number(subscriberCount);
  if (!Number.isFinite(count) || count < 0) return "";
  for (const tier of INFLUENCER_SIZE_TIERS) {
    if (count >= tier.min) return tier.label;
  }
  return "";
}
```

### 2B. Wire into HubSpot push

File: `backend/packages/core/src/hubspot/index.ts`

- Add `import { computeInfluencerSizeTier } from "./influencer-size";`
- Remove the inline `computeInfluencerSizeTier` added in Session 1

### 2C. Tests

File: `backend/packages/core/src/hubspot/influencer-size.test.ts` (new file)

1. **Returns empty for null/undefined** — both return `""`
2. **Returns empty for sub-1K** — `999` returns `""`
3. **Correct tier at each boundary** — 1000, 4999, 5000, 19999, 20000, 99999, 100000, 499999,
   500000, 999999, 1000000, 5000000
4. **Handles bigint** — `BigInt(250000)` returns `"Macro (100K - 500K)"`
5. **Returns empty for negative/NaN/Infinity** — all return `""`

### Session 2 verification

```bash
pnpm --filter @scouting-platform/core typecheck
pnpm --filter @scouting-platform/core exec vitest run src/hubspot
```

---

## Session 3 — Extract Content Language from YouTube API

**Scope:** Parse `defaultLanguage` from the YouTube channels API response (already fetched but
not extracted), store it on the `Channel` record, and push to HubSpot's `language` property.

### 3A. Expand YouTube channel response parsing

File: `backend/packages/integrations/src/youtube/context.ts`

In `channelResponseSchema`, add `defaultLanguage` to the channel snippet:

```typescript
snippet: z.object({
  title: z.string(),
  description: z.string().optional(),
  customUrl: z.string().optional(),
  publishedAt: z.string().optional(),
  defaultLanguage: z.string().optional(),   // ← add this line
  thumbnails: z
    // ... rest unchanged
```

### 3B. Add defaultLanguage to YoutubeChannelContext

File: `backend/packages/integrations/src/youtube/context.ts`

Add to `youtubeChannelContextSchema`:

```typescript
defaultLanguage: z.string().trim().nullable(),
```

Add to `YoutubeChannelContextDraft` type:

```typescript
defaultLanguage: string | null;
```

In `fetchYoutubeChannelContext`, where the channel snippet is mapped to the context draft, add:

```typescript
defaultLanguage: channelSnippet.defaultLanguage?.trim() ?? null,
```

### 3C. BCP-47 to HubSpot language mapping

File: `backend/packages/core/src/hubspot/language-mapping.ts` (new file)

Create a static map from BCP-47 language codes to HubSpot `language` enum values:

```typescript
const BCP47_TO_HUBSPOT_LANGUAGE: Record<string, string> = {
  en: "English (US)",
  "en-us": "English (US)",
  "en-gb": "English (UK)",
  "en-au": "English (UK)",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  nb: "Norwegian",
  nn: "Norwegian",
  fi: "Finnish",
  pl: "Polish",
  cs: "Czech",
  sk: "Slovak",
  hu: "Hungarian",
  ro: "Romanian",
  bg: "Bulgarian",
  hr: "Croatian",
  sr: "Serbian",
  sl: "Slovenian",
  sq: "Albanian",
  el: "Greek",
  uk: "Ukrainian",
  ru: "Russian",
  tr: "Turkish",
  ar: "Arabic",
  he: "Hebrew",
  iw: "Hebrew",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  ur: "Urdu",
  id: "Indonesian",
  ms: "Malay",
  th: "Thai",
  vi: "Vietnamese",
  fil: "Filipino",
  tl: "Filipino",
  zh: "Chinese",
  "zh-cn": "Chinese",
  "zh-tw": "Chinese",
  ja: "Japanese",
  ko: "Korean",
};

export function mapYoutubeLanguageToHubspot(
  bcp47: string | null | undefined,
): string {
  if (!bcp47?.trim()) return "";
  const normalized = bcp47.trim().toLowerCase();
  return BCP47_TO_HUBSPOT_LANGUAGE[normalized]
    ?? BCP47_TO_HUBSPOT_LANGUAGE[normalized.split("-")[0]]
    ?? "";
}
```

### 3D. Prisma schema change

File: `backend/packages/db/prisma/schema.prisma`

Add to the `Channel` model, after `thumbnailUrl`:

```prisma
contentLanguage  String?  @map("content_language")
```

### 3E. Migration file

Create directory and file:
`backend/packages/db/prisma/migrations/20260414120000_channel_content_language/migration.sql`

```sql
ALTER TABLE "channels" ADD COLUMN "content_language" TEXT;
```

### 3F. Write language during enrichment execution

File: `backend/packages/core/src/enrichment/index.ts`

Import the mapping:
```typescript
import { mapYoutubeLanguageToHubspot } from "../hubspot/language-mapping";
```

In `executeChannelLlmEnrichment`, inside the final transaction where the `channel` record is
updated (the `tx.channel.update` call that writes `handle`, `youtubeUrl`, `description`,
`thumbnailUrl`), add:

```typescript
contentLanguage: mapYoutubeLanguageToHubspot(youtubeContext.defaultLanguage),
```

If the mapped value is empty string, write `null` instead:

```typescript
contentLanguage: mapYoutubeLanguageToHubspot(youtubeContext.defaultLanguage) || null,
```

### 3G. Push language to HubSpot

File: `backend/packages/core/src/hubspot/index.ts`

Add `contentLanguage: true` to `channelPushSelect`:

```typescript
const channelPushSelect = {
  // ... existing fields ...
  contentLanguage: true,
  // ...
};
```

Add to `buildHubspotContactProperties` return object:

```typescript
language: channel.contentLanguage ?? "",
```

### 3H. Tests

File: `backend/packages/core/src/hubspot/language-mapping.test.ts` (new file)

1. **Maps common BCP-47 codes** — `"en"` → `"English (US)"`, `"de"` → `"German"`,
   `"hr"` → `"Croatian"`, `"ja"` → `"Japanese"`
2. **Maps regional variants** — `"en-GB"` → `"English (UK)"`, `"zh-TW"` → `"Chinese"`,
   `"pt-BR"` → `"Portuguese"`
3. **Case insensitive** — `"EN"`, `"En"`, `"en"` all return `"English (US)"`
4. **Returns empty for null/undefined/empty** — all return `""`
5. **Returns empty for unknown codes** — `"xx"`, `"klingon"` return `""`
6. **Falls back to base code** — `"fr-CA"` → `"French"` (not in map, but `"fr"` is)

File: `backend/packages/db/src/migrations.test.ts`

Add a test case for `20260414120000_channel_content_language`:
- Assert migration SQL contains `ADD COLUMN "content_language"`

File: `backend/packages/core/src/hubspot/index.test.ts`

Add test case:
- **Pushes content language** — channel with `contentLanguage: "German"` → output has
  `language: "German"`
- **Empty when contentLanguage is null** — output has `language: ""`

### Session 3 verification

```bash
pnpm db:migrate:test
pnpm --filter @scouting-platform/db typecheck
pnpm --filter @scouting-platform/db exec vitest run src/migrations.test.ts
pnpm --filter @scouting-platform/integrations typecheck
pnpm --filter @scouting-platform/core typecheck
pnpm --filter @scouting-platform/core exec vitest run src/hubspot
```

---

## Session 4 — Best-Effort Multi-Vertical Inference

**Scope:** Infer zero-to-many HubSpot `influencer_vertical` values at push time using existing
stored signals. Do not store inferred verticals in the database. Do not change the OpenAI prompt
or schema. Do not redesign the HubSpot preparation workflow in this session. This remains
best-effort: it should reduce manual tagging work for common creator niches, but the final
campaign-specific choice still belongs in HubSpot preparation.

Because `influencer_vertical` is a multi-select HubSpot property, the push should emit multiple
values when there is strong evidence for more than one vertical. The push payload should serialize
them as a semicolon-delimited string, for example `"Gaming;Tech"`.

### 4A. Expand the push-time source data

File: `backend/packages/core/src/hubspot/index.ts`

Expand `channelPushSelect` to include richer stored signals that already exist on the channel:

```typescript
const channelPushSelect = {
  id: true,
  youtubeChannelId: true,
  title: true,
  handle: true,
  youtubeUrl: true,
  contacts: {
    orderBy: {
      email: "asc",
    },
    select: {
      email: true,
    },
  },
  metrics: {
    select: {
      subscriberCount: true,
      viewCount: true,
      videoCount: true,
      youtubeAverageViews: true,
      youtubeEngagementRate: true,
      youtubeFollowers: true,
    },
  },
  enrichment: {
    select: {
      summary: true,
      topics: true,
      brandFitNotes: true,
      structuredProfile: true,
    },
  },
  insights: {
    select: {
      audienceInterests: true,
    },
  },
} as const;
```

Rationale:
- `structuredProfile.niche.primary` is a stronger vertical signal than raw topic tags
- `structuredProfile.niche.secondary` captures legitimate secondary verticals
- `topics` are still useful as supporting evidence
- HypeAuditor `audienceInterests` can reinforce a borderline match without adding LLM coupling

### 4B. Create a signal-based multi-label inference utility

File: `backend/packages/core/src/hubspot/vertical-inference.ts` (new file)

Create a utility that scores candidate HubSpot verticals from multiple sources instead of picking
the first topic match.

```typescript
type VerticalSignalSource =
  | "nichePrimary"
  | "nicheSecondary"
  | "topic"
  | "audienceInterest";

type VerticalCandidate = {
  vertical: string;
  score: number;
  evidence: string[];
};

const SIGNAL_WEIGHTS: Record<VerticalSignalSource, number> = {
  nichePrimary: 4,
  nicheSecondary: 2,
  topic: 2,
  audienceInterest: 1,
};

const MIN_VERTICAL_SCORE = 3;
const MAX_VERTICALS = 5;

const VERTICAL_SIGNAL_MAP: ReadonlyArray<{
  vertical: string;
  aliases: readonly string[];
  suppresses?: readonly string[];
}> = [
  { vertical: "Minecraft", aliases: ["minecraft"], suppresses: ["Gaming"] },
  { vertical: "Gaming", aliases: ["gaming", "games", "game", "esports", "twitch", "fortnite", "valorant", "league of legends"] },
  { vertical: "Tech", aliases: ["tech", "technology", "gadgets", "software", "hardware", "programming", "coding", "pc builds"] },
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
  { vertical: "Sport", aliases: ["sports", "sport", "athletics"] },
  { vertical: "Football", aliases: ["football", "soccer"], suppresses: ["Sport"] },
  { vertical: "Podcast", aliases: ["podcast", "podcasting"] },
  { vertical: "Interview", aliases: ["interview"] },
  { vertical: "Reviews", aliases: ["reviews", "review", "unboxing", "product review"] },
  { vertical: "Commentary", aliases: ["commentary", "opinion", "reaction", "rant"] },
  { vertical: "Lifestyle", aliases: ["lifestyle"] },
];

export function inferVerticalsForHubspot(input: {
  structuredProfile: unknown;
  topics: unknown;
  audienceInterests: unknown;
}): string[] {
  // 1. Normalize niche primary / secondary, topics, and audience-interest labels to lowercase.
  // 2. Add weighted evidence for every matching alias.
  // 3. Allow multiple verticals to survive if each clears MIN_VERTICAL_SCORE.
  // 4. Apply suppression rules so specific values like Minecraft beat broad parents like Gaming
  //    when the only evidence is the child niche itself.
  // 5. Sort by score desc, then alphabetically for determinism.
  // 6. Return at most MAX_VERTICALS values.
}

export function serializeHubspotMultiSelect(values: readonly string[]): string {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].join(";");
}
```

Rules:
1. **No first-match-wins behavior.** A creator can legitimately map to multiple verticals.
2. **Only emit valid HubSpot option labels.** The mapping file is the allow-list.
3. **Prefer stronger signals.** `niche.primary` should outweigh `topics`; `topics` should outweigh
   `audienceInterests`.
4. **Suppress parent labels when a child label is the only evidence.** `["minecraft"]` should
   produce `["Minecraft"]`, not `["Minecraft", "Gaming"]`.
5. **Keep the output small and deterministic.** Cap at 5 verticals and sort stably.

### 4C. Wire the inferred verticals into the push payload

File: `backend/packages/core/src/hubspot/index.ts`

Import the new utility:

```typescript
import {
  inferVerticalsForHubspot,
  serializeHubspotMultiSelect,
} from "./vertical-inference";
```

Build the property from the richer signals:

```typescript
const inferredVerticals = inferVerticalsForHubspot({
  structuredProfile: channel.enrichment?.structuredProfile,
  topics: channel.enrichment?.topics,
  audienceInterests: channel.insights?.audienceInterests,
});

return {
  // ...
  influencer_vertical: serializeHubspotMultiSelect(inferredVerticals),
};
```

If no candidate clears the threshold, `influencer_vertical` must be `""`.

### 4D. Tests

File: `backend/packages/core/src/hubspot/vertical-inference.test.ts` (new file)

1. **Returns multiple independent verticals** —
   `niche.primary = "gaming"`, `niche.secondary = ["tech"]`, `topics = ["pc builds"]`
   → `["Gaming", "Tech"]`
2. **Uses stronger signals first** —
   `niche.primary = "beauty"`, `topics = ["fashion"]`
   → includes `"Beauty"` even if `"Fashion"` is also present
3. **Uses audience interests as supporting evidence** —
   weak `topics = ["reviews"]` plus `audienceInterests = [{ label: "Tech", score: 0.88 }]`
   → includes `"Tech"`
4. **Suppresses broad parents when only the child is supported** —
   `topics = ["minecraft"]` → `["Minecraft"]`, not `["Gaming", "Minecraft"]`
5. **Case insensitive and partial matching** —
   `["GAMING", "pc gaming"]` → includes `"Gaming"`
6. **Returns empty for null/empty/unmatched input** —
   `null`, `[]`, `"not an array"`, or `["obscure niche"]` → `[]`
7. **Serializes for HubSpot correctly** —
   `["Gaming", "Tech", "Gaming"]` → `"Gaming;Tech"`

File: `backend/packages/core/src/hubspot/index.test.ts`

Add push-focused cases:
- **Pushes multi-select influencer verticals** —
  `structuredProfile.niche.primary = "gaming"`, `secondary = ["tech"]`
  → output has `influencer_vertical: "Gaming;Tech"`
- **Pushes empty string when nothing is confident enough** —
  no matching niche/topics/interests → `influencer_vertical: ""`
- **Keeps specific child vertical without redundant parent** —
  `topics = ["minecraft"]` → `influencer_vertical: "Minecraft"`

### Session 4 verification

```bash
pnpm --filter @scouting-platform/core typecheck
pnpm --filter @scouting-platform/core exec vitest run src/hubspot
```

---

## Post-Implementation Verification

After all four sessions are complete:

1. Full backend type check:
   ```bash
   pnpm --filter @scouting-platform/core typecheck
   pnpm --filter @scouting-platform/integrations typecheck
   pnpm --filter @scouting-platform/db typecheck
   ```

2. All affected test suites:
   ```bash
   pnpm --filter @scouting-platform/core exec vitest run src/hubspot
   pnpm --filter @scouting-platform/db exec vitest run src/migrations.test.ts
   ```

3. Database migration:
   ```bash
   pnpm db:migrate:test
   ```

---

## What This Plan Does NOT Cover

Explicitly out of scope:

- **LLM enrichment changes** — No prompt, schema, or output changes to the OpenAI integration.
  The enrichment is doing the right job as a human evaluation tool.
- **HubSpot `influencer_type` auto-classification** — Requires visual/content analysis the LLM
  cannot reliably do from text. Set manually during HubSpot preparation.
- **HubSpot preparation/import multi-select support** — The preparation defaults, row overrides,
  shared contracts, and CSV import path still model `influencerVertical` as a single string.
  This session does not redesign those flows; it only improves direct HubSpot push inference.
- **Platform dropdown taxonomy sync** — The platform's `influencerVertical` (5 values) and
  HubSpot's (70+) serve different purposes. Platform dropdowns are for the preparation workflow.
  HubSpot properties are populated by the push. No alignment needed now.
- **Frontend changes** — No UI changes for language or vertical display.
- **Audience demographics push** — HypeAuditor audience data is not pushed in this plan.
- **Campaign-aware enrichment** — A future direction where the LLM evaluates a creator
  specifically for a campaign brief (fit score, talking points, concerns). This would live on
  `RunResult` as a per-channel-per-campaign assessment, not on the channel enrichment.

## What Should Change Next (After This Plan)

The highest-value follow-on is **campaign-aware enrichment**: instead of the generic "tell me
about this creator" enrichment, evaluate creators against a specific campaign brief. Input is
channel context + campaign brief (client, product, audience, requirements). Output is a fit
score and specific reasons. This is where the LLM adds genuine value beyond what deterministic
derivation can do. It would live on `RunResult` (per-channel-per-run) rather than
`ChannelEnrichment` (per-channel).
