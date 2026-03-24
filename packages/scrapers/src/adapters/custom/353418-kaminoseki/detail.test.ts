import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";

describe("fetchMeetingData", () => {
  it("会議録ページが 404 のため null を返す", async () => {
    const result = await fetchMeetingData(
      {
        title: "上関町令和6年第4回定例会",
        heldOn: "2024-12-01",
        url: "https://www.town.kaminoseki.lg.jp/",
      },
      "municipality-id-123",
    );
    expect(result).toBeNull();
  });
});
