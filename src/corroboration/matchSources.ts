import type { SourceItem } from "../types/communitySignal.js";

export type MatchReason = "shared_reference" | "title_overlap";
export type SourceMatch = { reason: MatchReason; reference?: string };

function canonicalReference(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const segments = url.pathname.split("/").filter(Boolean);
    if (!segments.length) return undefined;
    if (host === "github.com" && segments.length >= 2 && !["topics", "search", "features", "orgs", "settings"].includes(segments[0].toLowerCase())) {
      if (["issues", "pull", "discussions"].includes(segments[2]?.toLowerCase() ?? "") && segments[3]) {
        return `https://github.com/${segments[0].toLowerCase()}/${segments[1].toLowerCase()}/${segments[2].toLowerCase()}/${segments[3]}`;
      }
      return `https://github.com/${segments[0].toLowerCase()}/${segments[1].replace(/\.git$/i, "").toLowerCase()}`;
    }
    if (host === "producthunt.com" && segments[0] === "posts" && segments[1]) {
      return `https://www.producthunt.com/posts/${segments[1].toLowerCase()}`;
    }
    const filtered = [...url.searchParams.entries()].filter(([key]) => !/^utm_|^(?:fbclid|gclid|ref)$/i.test(key)).sort(([a], [b]) => a.localeCompare(b));
    const query = new URLSearchParams(filtered).toString();
    return `https://${host}${url.pathname.replace(/\/+$/, "")}${query ? `?${query}` : ""}`;
  } catch { return undefined; }
}

function references(item: SourceItem): string[] {
  return [...new Set([...(item.whopContext?.linkGranularity === "channel" ? [] : [item.url]), ...(item.citedUrls ?? [])].map(canonicalReference).filter((value): value is string => Boolean(value)))];
}

function titleOverlap(a: string, b: string): boolean {
  const generic = new Set(["the", "for", "and", "with", "show", "news", "about", "from", "using", "open", "source", "project", "tool", "tools", "app", "software", "developer", "developers", "code", "coding", "agent", "agents", "workflow", "review", "production", "research", "study", "benchmark"]);
  const tokens = (text: string) => text.split("/").at(-1)!.toLowerCase().replace(/show hn:?/g, "").match(/[a-z0-9]+/g)?.filter((part) => part.length > 2 && !generic.has(part)) ?? [];
  const left = tokens(a);
  const right = tokens(b);
  const shorter = left.length <= right.length ? left : right;
  const longer = new Set(left.length <= right.length ? right : left);
  return shorter.length >= 2 && shorter.filter((token) => longer.has(token)).length / shorter.length >= 0.9;
}

/** A shared link identifies a common subject, not independent verification of a claim. */
export function matchSources(a: SourceItem, b: SourceItem): SourceMatch | undefined {
  if (a.platform === b.platform && a.id === b.id) return undefined;
  const right = new Set(references(b));
  const reference = references(a).find((key) => right.has(key));
  if (reference) return { reason: "shared_reference", reference };
  return titleOverlap(a.title, b.title) ? { reason: "title_overlap" } : undefined;
}
