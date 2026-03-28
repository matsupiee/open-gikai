import { describe, expect, it } from "vitest";
import { fetchMeetingList } from "./list";

describe("fetchMeetingList", () => {
  it("会議録提供がないため常に空配列を返す", async () => {
    const result = await fetchMeetingList(
      "https://www.vill.higashiyoshino.lg.jp/",
      2024,
    );
    expect(result).toEqual([]);
  });

  it("異なる年・URL でも空配列を返す", async () => {
    const result = await fetchMeetingList(
      "https://example.com/gikai/",
      2021,
    );
    expect(result).toEqual([]);
  });
});
