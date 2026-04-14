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
  if (!bcp47?.trim()) {
    return "";
  }

  const normalized = bcp47.trim().toLowerCase();

  return (
    BCP47_TO_HUBSPOT_LANGUAGE[normalized]
    ?? BCP47_TO_HUBSPOT_LANGUAGE[normalized.split("-")[0] ?? ""]
    ?? ""
  );
}
