import { describe, expect, it } from "vitest";
import { fetchMeetingList } from "./list";
import { BASE_PAGE_URL, MOCK_GIKAI_PAGE_URL } from "./shared";

describe("fetchMeetingList", () => {
  it("通常議会の会議録が未公開のため常に空配列を返す", async () => {
    const result = await fetchMeetingList(BASE_PAGE_URL, 2025);
    expect(result).toEqual([]);
  });

  it("模擬議会ページ URL を渡しても対象外のため空配列を返す", async () => {
    const result = await fetchMeetingList(MOCK_GIKAI_PAGE_URL, 2025);
    expect(result).toEqual([]);
  });
});
