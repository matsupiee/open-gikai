import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和７年第８回安平町議会定例会会議録（令和７年１２月１７日）",
        heldOn: "2025-12-17",
        pdfUrl: "https://www.town.abira.lg.jp/webopen/content/123/R0712-01.pdf",
        meetingType: "plenary",
        pageId: "1925",
      },
      "municipality-id-123",
    );

    expect(result.municipalityId).toBe("municipality-id-123");
    expect(result.title).toBe(
      "令和７年第８回安平町議会定例会会議録（令和７年１２月１７日）"
    );
    expect(result.meetingType).toBe("plenary");
    expect(result.heldOn).toBe("2025-12-17");
    expect(result.sourceUrl).toBe(
      "https://www.town.abira.lg.jp/webopen/content/123/R0712-01.pdf"
    );
    expect(result.externalId).toBe("abira_1925_2025-12-17");
    expect(result.statements).toEqual([]);
  });

  it("委員会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "総務常任委員会会議録",
        heldOn: "2025-06-15",
        pdfUrl: "https://www.town.abira.lg.jp/webopen/content/456/R0706.pdf",
        meetingType: "committee",
        pageId: "1800",
      },
      "municipality-id-456",
    );

    expect(result.meetingType).toBe("committee");
    expect(result.externalId).toBe("abira_1800_2025-06-15");
  });
});
