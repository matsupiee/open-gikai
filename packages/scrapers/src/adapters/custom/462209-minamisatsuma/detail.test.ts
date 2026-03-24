import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";
import type { MinamisatsumaRecord } from "./list";

describe("fetchMeetingData", () => {
  it("テキスト会議録がないため常に null を返す", async () => {
    const record: MinamisatsumaRecord = {
      councilId: "38",
      scheduleId: "2",
      councilLabel: "令和7年第2回定例会",
      scheduleLabel: "2月20日　一般質問",
      heldOn: "2025-02-20",
      meetingType: "plenary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/minamisatsuma/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-001");

    expect(result).toBeNull();
  });

  it("heldOn が null でも null を返す（エラーにならない）", async () => {
    const record: MinamisatsumaRecord = {
      councilId: "10",
      scheduleId: "1",
      councilLabel: "令和6年第3回定例会",
      scheduleLabel: "6月10日",
      heldOn: null,
      meetingType: "plenary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/minamisatsuma/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-002");

    expect(result).toBeNull();
  });
});
