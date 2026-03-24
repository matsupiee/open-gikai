import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";
import type { NozawaonsenRecord } from "./list";

describe("fetchMeetingData", () => {
  it("テキスト会議録がないため常に null を返す", async () => {
    const record: NozawaonsenRecord = {
      councilId: "12",
      scheduleId: "1",
      councilLabel: "令和6年3月定例会",
      scheduleLabel: "03月11日　本会議",
      heldOn: "2024-03-11",
      meetingType: "plenary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/nozawaonsen/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-001");

    expect(result).toBeNull();
  });

  it("heldOn が null でも null を返す（エラーにならない）", async () => {
    const record: NozawaonsenRecord = {
      councilId: "10",
      scheduleId: "1",
      councilLabel: "令和5年9月定例会",
      scheduleLabel: "09月10日",
      heldOn: null,
      meetingType: "plenary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/nozawaonsen/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-002");

    expect(result).toBeNull();
  });
});
