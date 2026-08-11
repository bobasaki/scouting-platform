/**
 * Normalization of creator/channel names into the join key that matches
 * Almedia campaign names. Ported from the standalone tracker's
 * `src/migration/cell-utils.ts` (only the two key helpers are needed here —
 * the workbook parsing that surrounded them is not part of this integration).
 */

const CHANNEL_KEY_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[łŁ]/gu, "l"],
  [/[øØ]/gu, "o"],
  [/[đĐ]/gu, "d"],
  [/ß/gu, "ss"],
];

const COMBINING_MARKS = /[\u0300-\u036F]/gu;

/**
 * Normalize a channel/influencer name into the join key used to match
 * Almedia campaign names: uppercase ASCII alphanumerics only.
 * "ASMR Fixy" -> "ASMRFIXY" (matches campaign base "ASMRFIXY" of
 * "ASMRFIXY_YT_R1").
 */
export function normalizeChannelKey(name: string): string {
  let result = name;

  for (const [pattern, replacement] of CHANNEL_KEY_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  return result
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/gu, "");
}

/**
 * Strip the `_PLATFORM_R#` suffix from an Almedia campaign name and
 * normalize the remainder: "ASMRFIXY_YT_R1" -> "ASMRFIXY".
 */
export function campaignBaseKey(campaignName: string): string {
  return normalizeChannelKey(
    campaignName.replace(/_[A-Z0-9]+_R\d+(?:_?[A-Z0-9]+)*$/iu, ""),
  );
}
