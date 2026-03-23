import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和7年第1回安芸太田町議会定例会会議録（2月21日）",
        heldOn: "2025-02-21",
        pdfUrl: "https://www.akiota.jp/uploaded/life/17650_39314_misc.pdf",
        meetingType: "plenary",
      },
      "municipality-id-123",
    );

    expect(result.municipalityId).toBe("municipality-id-123");
    expect(result.title).toBe(
      "令和7年第1回安芸太田町議会定例会会議録（2月21日）",
    );
    expect(result.meetingType).toBe("plenary");
    expect(result.heldOn).toBe("2025-02-21");
    expect(result.sourceUrl).toBe(
      "https://www.akiota.jp/uploaded/life/17650_39314_misc.pdf",
    );
    expect(result.externalId).toBe("akiota_2025-02-21");
    expect(result.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和7年第2回安芸太田町議会臨時会会議録（4月14日）",
        heldOn: "2025-04-14",
        pdfUrl: "https://www.akiota.jp/uploaded/life/17650_39320_misc.pdf",
        meetingType: "extraordinary",
      },
      "municipality-id-456",
    );

    expect(result.meetingType).toBe("extraordinary");
    expect(result.externalId).toBe("akiota_2025-04-14");
  });
});
