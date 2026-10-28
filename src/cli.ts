#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseCliArgs } from "./cliArgs.js";
import { runCommunitySignalAnalysis, runLiveCommunitySignalAnalysis } from "./index.js";
import { recordHistory } from "./history.js";
import { applyClaimReviews, loadClaimReviews, loadSavedBrief } from "./verification.js";
import { collectXReplies } from "./adapters/xReplies.js";
import { cutoffFor } from "./adapters/live.js";
import { appendXReplySample } from "./report/generateLiveBrief.js";
import { loadProfile, pathKey } from "./profile/store.js";
import { checkReport, writeReport } from "./profile/output.js";

const { query, demo, json, profilePath, outputPath, historyPath, verificationPath, savedBriefPath, replyBriefPath } = parseCliArgs(process.argv.slice(2));
const configured = profilePath ? loadProfile(profilePath) : undefined;
const profile = configured?.profile;
if(configured && outputPath && Object.values(configured.paths).map(pathKey).includes(pathKey(checkReport(outputPath))))throw new Error("报告不能占用 profile/scope/state 路径");
if (profile && outputPath && existsSync(resolve(outputPath))) throw new Error("输出目标已存在；profile 研究不覆盖旧报告");
if(profile && outputPath)checkReport(outputPath);
// Validate before making any potentially billable collection request.
const reviews = verificationPath ? loadClaimReviews(verificationPath) : undefined;
let brief = savedBriefPath || replyBriefPath ? loadSavedBrief((savedBriefPath || replyBriefPath)!) : demo ? runCommunitySignalAnalysis(query, profile) : await runLiveCommunitySignalAnalysis(query, profile);
if (reviews) brief = applyClaimReviews(brief, reviews);
if (replyBriefPath) {
  const result = await collectXReplies(brief.parsedQuery, brief.selectedItems, cutoffFor(brief.parsedQuery.timeRange));
  const limitations = process.env.X_REPLIES_ENABLED === "true" ? result.limitations : [brief.parsedQuery.language === "en" ? "X_REPLIES_ENABLED=true is required for the extra paid reply read; no request was made." : "额外付费回复读取需 X_REPLIES_ENABLED=true；本次未请求回复。"];
  brief = appendXReplySample(brief, result.items, limitations);
}
if (historyPath) recordHistory(brief, historyPath);
const content = json ? JSON.stringify(brief, null, 2) : brief.markdown;
process.stdout.write(`${content}\n`);
if (outputPath) {
  const resolved = resolve(outputPath);
  if(profile)writeReport(resolved,content);else {mkdirSync(dirname(resolved), { recursive: true });writeFileSync(resolved, content, "utf8");}
  process.stderr.write(`Saved brief to ${resolved}\n`);
}
