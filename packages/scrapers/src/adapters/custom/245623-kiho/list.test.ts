import { describe, expect, it } from "vitest";
import { fetchMeetingList } from "./list";

describe("fetchMeetingList", () => {
  it("テキスト会議録が存在しないため常に空配列を返す", async () => {
    const result = await fetchMeetingList(
      "https://kiho-town.stream.jfit.co.jp/",
      2024,
    );
    expect(result).toEqual([]);
  });

  it("異なる年・URL でも空配列を返す", async () => {
    const result = await fetchMeetingList(
      "https://kiho-town.stream.jfit.co.jp/",
      2021,
    );
    expect(result).toEqual([]);
  });
});
