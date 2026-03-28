import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

const SNIPPET_LENGTH = 200;

export function buildSnippet(content: string, query: string): { text: string; truncated: boolean } {
  if (content.length <= SNIPPET_LENGTH) return { text: content, truncated: false };

  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    return { text: content.substring(0, SNIPPET_LENGTH) + "...", truncated: true };
  }

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(escaped.join("|"), "gi");
  const match = pattern.exec(content);

  if (!match || match.index < SNIPPET_LENGTH) {
    return { text: content.substring(0, SNIPPET_LENGTH) + "...", truncated: true };
  }

  const center = match.index;
  const half = Math.floor(SNIPPET_LENGTH / 2);
  const start = Math.max(0, center - half);
  const end = Math.min(content.length, start + SNIPPET_LENGTH);

  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return { text: prefix + content.substring(start, end) + suffix, truncated: true };
}

export function highlightText(text: string, query: string): ReactNode {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return text;

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);

  if (parts.length === 1) return text;

  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) => {
      const isMatch = tokens.some((t) => part.toLowerCase() === t.toLowerCase());
      return isMatch
        ? createElement("mark", { key: i, className: "bg-yellow-200 rounded-sm" }, part)
        : part;
    }),
  );
}

export const getKindLabel = (kind: string): string => {
  const kindMap: Record<string, string> = {
    question: "質問",
    answer: "答弁",
    remark: "発言",
    unknown: "不明",
  };
  return kindMap[kind] || "不明";
};

export const getKindColor = (kind: string): string => {
  const colorMap: Record<string, string> = {
    question: "bg-blue-100 text-blue-800",
    answer: "bg-green-100 text-green-800",
    remark: "bg-yellow-100 text-yellow-800",
    unknown: "bg-gray-100 text-gray-800",
  };
  return colorMap[kind] || "bg-gray-100 text-gray-800";
};
