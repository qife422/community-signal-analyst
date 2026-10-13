import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { RawMockItem } from "./types.js";

export function loadMockHackerNewsItems(): RawMockItem[] {
  return loadJson("../../mock-data/hacker-news.mock.json");
}

function loadJson(relativePath: string): RawMockItem[] {
  const path = fileURLToPath(new URL(relativePath, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as RawMockItem[];
}
