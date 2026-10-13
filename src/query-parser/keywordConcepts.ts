const ALIASES: Record<string, string[]> = {
  "性能": ["性能", "performance", "latency", "throughput", "benchmark", "optimization", "optimisation", "explain analyze", "速度", "提速"],
  "安全": ["安全", "security", "vulnerability", "漏洞"],
  "价格": ["价格", "pricing", "cost", "费用"],
  "迁移": ["迁移", "migration", "migrate"]
};

export function expandKeyword(keyword: string): string[] {
  return ALIASES[keyword] ?? [keyword];
}
