export function parseCliArgs(args: string[]): { query: string; demo: boolean; json: boolean; profilePath?: string; outputPath?: string; historyPath?: string; verificationPath?: string; savedBriefPath?: string; replyBriefPath?: string } {
  let demo = false;
  let json = false;
  const paths: Record<string, string> = {};
  const queryParts: string[] = [];
  const pathFlags = ["--out", "--history", "--verification", "--verify-brief", "--reply-brief", "--profile"];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--demo") demo = true;
    else if (arg === "--json") json = true;
    else if (pathFlags.includes(arg)) {
      if (paths[arg]) throw new Error(`${arg} 不能重复`);
      const path = args[++i];
      if (!path || path.startsWith("--")) throw new Error(`${arg} 需要文件路径`);
      paths[arg] = path;
    } else if (arg.startsWith("--")) throw new Error(`未知参数：${arg}`);
    else queryParts.push(arg);
  }
  if (demo && (paths["--history"] || paths["--verification"] || paths["--verify-brief"] || paths["--reply-brief"])) throw new Error("历史、回复和原文核验只用于真实模式");
  if (paths["--verify-brief"] && (!paths["--verification"] || paths["--history"] || queryParts.length)) throw new Error("--verify-brief 需要 --verification，不能与查询或 --history 同用");
  if (paths["--reply-brief"] && (paths["--verify-brief"] || paths["--history"] || queryParts.length)) throw new Error("--reply-brief 不能与 --verify-brief、新查询或 --history 同用");
  if (paths["--profile"] && (paths["--verify-brief"] || paths["--reply-brief"] || paths["--history"])) throw new Error("profile 研究与既有历史/补充核验入口分开；使用 preview 重筛已有样本");
  const query = queryParts.join(" ").trim() || (paths["--profile"] ? "" : "帮我找最近 AI coding 工具比较火的内容");
  return { query, demo, json, ...(paths["--profile"] ? { profilePath: paths["--profile"] } : {}), outputPath: paths["--out"], historyPath: paths["--history"], verificationPath: paths["--verification"], savedBriefPath: paths["--verify-brief"], replyBriefPath: paths["--reply-brief"] };
}
