import { describe, expect, it } from "vitest";
import { fetchMeetingList } from "./list";
import { BASE_PAGE_URL, SEARCH_PAGE_URL, SITEMAP_URL } from "./shared";

describe("fetchMeetingList", () => {
  it("通常議会の会議録が未公開のため常に空配列を返す", async () => {
    const result = await fetchMeetingList(BASE_PAGE_URL, 2025);
    expect(result).toEqual([]);
  });

  it("サイトマップ URL を渡しても対象データがないため空配列を返す", async () => {
    const result = await fetchMeetingList(SITEMAP_URL, 2025);
    expect(result).toEqual([]);
  });

  it("議会で検索した URL を渡しても対象データがないため空配列を返す", async () => {
    const result = await fetchMeetingList(SEARCH_PAGE_URL, 2025);
    expect(result).toEqual([]);
  });
});
