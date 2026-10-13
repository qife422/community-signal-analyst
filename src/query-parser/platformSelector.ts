import type { ParsedQuery, Platform } from "../types/communitySignal.js";

export function selectPlatforms(parsed?: Pick<ParsedQuery, "analysisMode" | "keywords" | "originalQuery">): Platform[] {
  const query = parsed?.originalQuery ?? "";
  const sixPlatformScope = /六平台|六个平台|\ball six platforms\b/i.test(query);
  const excludeReddit = sixPlatformScope || /(?:不含|不包含|排除|跳过|不查询|不读取|不要查询)\s*reddit\b|(?:除|除了)\s*reddit\s*(?:外|以外|之外)|\b(?:except|excluding|exclude|without|skip)\s+reddit\b|\breddit\s+(?:excluded|除外)/i.test(query);
  const excluded=new Set<Platform>(excludeReddit?["reddit"]:[]);
  // Negative clauses only consume platform-name lists, never arbitrary topic text.
  const names="(?:reddit|discord|whop)",list=`${names}(?:\\s*(?:,|，|、|and|和|及|&)\\s*${names})*`;
  const clauses=[new RegExp(`(?:不含|不包含|排除|跳过|不查询|不读取|不要查询|暂缓|暂停|except|excluding|exclude|without|skip)\\s*(${list})`,"ig"),
    new RegExp(`(?:除|除了)\\s*(${list})\\s*(?:外|以外|之外)`,"ig")];
  for(const pattern of clauses)for(const m of query.matchAll(pattern))for(const n of m[1].match(/reddit|discord|whop/ig)??[])excluded.add(n.toLowerCase() as Platform);
  if(/\bdiscord\s+(?:excluded|除外)/i.test(query))excluded.add("discord");
  if(/\bwhop\s+(?:excluded|除外)/i.test(query))excluded.add("whop");
  const applyExclusion = (platforms:Platform[]) => platforms.filter(platform=>!excluded.has(platform));
  if (sixPlatformScope || /全平台|所有平台|全部平台|\ball platforms\b|\ball seven platforms\b/i.test(query)) return applyExclusion(["hacker_news", "github", "devto", "reddit", "product_hunt", "x", "discord", ...(/\bwhop\b/i.test(query) ? ["whop" as const] : [])]);
  const requested = [
    /hacker\s*news|\bhn\b/i.test(query) && "hacker_news",
    /github/i.test(query) && "github",
    /dev\.to|\bforem\b/i.test(query) && "devto",
    /reddit/i.test(query) && "reddit",
    /product\s*hunt/i.test(query) && "product_hunt",
    /(?:^|\W)(?:twitter|x\.com|x\/twitter|x)(?:$|\W)/i.test(query) && "x",
    /discord/i.test(query) && "discord",
    /\bwhop\b/i.test(query) && "whop"
  ].filter(Boolean) as Platform[];
  if (requested.length) return applyExclusion(requested);
  return applyExclusion(parsed?.analysisMode === "investment_research" ? ["hacker_news", "devto"] : ["hacker_news", "github", "devto"]);
}
