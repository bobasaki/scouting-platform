/**
 * The controlled vertical vocabulary used across the Almedia workspace, ported
 * from the standalone tracker's `dashboard/src/performance/verticals.ts`.
 *
 * Only the vocabulary and its canonicalizer are ported for Phase 1. The
 * keyword-scoring `deriveVerticals()` reads channel-enrichment text, which is
 * not integrated yet, so it lands with channel enrichment in Phase 2; until
 * then a deal's verticals come from its booking's own `vertical` field.
 */

export const VERTICALS = [
  "Abandoned Places",
  "Adventure",
  "Animals",
  "Animations",
  "Anime",
  "Art",
  "ASMR",
  "Astrology",
  "Aviation",
  "Books",
  "Budgeting",
  "Cars",
  "Chess",
  "Commentary",
  "Conspiracy",
  "Construction",
  "Cosplay",
  "Crimes",
  "Cybersecurity",
  "Cycling",
  "Dance",
  "DIY",
  "Documentary",
  "Editing",
  "Education",
  "Engineering",
  "Entertainment",
  "Environment",
  "Family",
  "Fashion",
  "Finance",
  "Fishing",
  "Fitness",
  "Food",
  "Football",
  "Gaming",
  "Guitars",
  "Health",
  "History",
  "Home Decor",
  "Home Renovation",
  "Humor",
  "Hunting",
  "Infotainment",
  "Interview",
  "Journalism",
  "Just Chatting",
  "Kids",
  "Lego",
  "Lifestyle",
  "Minecraft",
  "Motivation",
  "Movies",
  "Music",
  "Mystery",
  "News",
  "Outdoor",
  "Painting",
  "Parenting",
  "Pets",
  "Photography",
  "Plants",
  "Podcast",
  "Pokemon Cards",
  "Politics",
  "Pop Culture",
  "Reviews",
  "Science",
  "Society",
  "Sport",
  "TCG",
  "Tech",
  "Travel",
  "Variety",
  "Vlog",
  "Yoga",
  "Beauty",
] as const;

export type Vertical = (typeof VERTICALS)[number];

export function canonicalVertical(value: string | null | undefined): Vertical | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return VERTICALS.find((vertical) => vertical.toLowerCase() === normalized) ?? null;
}
