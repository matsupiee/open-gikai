import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

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
