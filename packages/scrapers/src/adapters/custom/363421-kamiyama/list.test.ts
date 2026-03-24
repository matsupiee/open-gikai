import { describe, expect, it } from "vitest";
import { fetchMeetingList } from "./list";

describe("fetchMeetingList", () => {
  it("会議録が公開されていないため常に空配列を返す", async () => {
    const result = await fetchMeetingList("https://www.town.kamiyama.lg.jp/soshiki/gikaijumukyoku/", 2024);
    expect(result).toEqual([]);
  });

  it("任意の年を指定しても空配列を返す", async () => {
    const result = await fetchMeetingList("https://www.town.kamiyama.lg.jp/soshiki/gikaijumukyoku/", 2020);
    expect(result).toEqual([]);
  });
});
