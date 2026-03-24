import { describe, expect, it } from "vitest";
import { fetchMeetingList } from "./list";

describe("fetchMeetingList", () => {
  it("会議録ページが 404 のため空配列を返す", async () => {
    const result = await fetchMeetingList(2024);
    expect(result).toEqual([]);
  });

  it("年を変えても空配列を返す", async () => {
    const result = await fetchMeetingList(2023);
    expect(result).toEqual([]);
  });
});
