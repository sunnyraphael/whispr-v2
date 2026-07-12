import { DEFAULT_BANNED_KEYWORDS } from "../constants";

export function filterContent(text, banned = DEFAULT_BANNED_KEYWORDS) {
  const lower = text.toLowerCase();
  for (const kw of banned) {
    if (lower.includes(kw)) return { blocked: true, keyword: kw };
  }
  return { blocked: false };
}
