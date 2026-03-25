import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";
import type { OokiRecord } from "./list";

describe("fetchMeetingData", () => {
  it("テキスト会議録がないため常に null を返す", async () => {
    const record: OokiRecord = {
      councilId: "5",
      scheduleId: "1",
      councilLabel: "令和7年6月定例会",
      scheduleLabel: "6月4日",
      heldOn: "2025-06-03",
      meetingType: "plenary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/ooki/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-001");

    expect(result).toBeNull();
  });

  it("heldOn が null でも null を返す（エラーにならない）", async () => {
    const record: OokiRecord = {
      councilId: "4",
      scheduleId: "1",
      councilLabel: "令和7年5月臨時会",
      scheduleLabel: "5月20日",
      heldOn: null,
      meetingType: "extraordinary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/ooki/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-002");

    expect(result).toBeNull();
  });
});
