import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";
import type { TomikaRecord } from "./list";

describe("fetchMeetingData", () => {
  it("テキスト会議録がないため常に null を返す", async () => {
    const record: TomikaRecord = {
      councilId: "62",
      scheduleId: "2",
      councilLabel: "令和7年12月定例会",
      scheduleLabel: "12月12日　一般質問、採決",
      heldOn: "2025-12-04",
      meetingType: "plenary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/tomika/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-001");

    expect(result).toBeNull();
  });

  it("heldOn が null でも null を返す（エラーにならない）", async () => {
    const record: TomikaRecord = {
      councilId: "59",
      scheduleId: "1",
      councilLabel: "令和7年5月臨時会",
      scheduleLabel: "5月10日",
      heldOn: null,
      meetingType: "extraordinary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/tomika/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-002");

    expect(result).toBeNull();
  });
});
