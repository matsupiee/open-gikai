import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和7年第4回定例会",
        heldOn: "2025-12-01",
        pdfUrl:
          "https://www.town.aizumi.lg.jp/_files/00654074/r7_4_kaigiroku.pdf",
        meetingType: "plenary",
        pdfPath: "/_files/00654074/r7_4_kaigiroku.pdf",
      },
      "municipality-id-123",
    );

    expect(result.municipalityId).toBe("municipality-id-123");
    expect(result.title).toBe("令和7年第4回定例会");
    expect(result.meetingType).toBe("plenary");
    expect(result.heldOn).toBe("2025-12-01");
    expect(result.sourceUrl).toBe(
      "https://www.town.aizumi.lg.jp/_files/00654074/r7_4_kaigiroku.pdf",
    );
    expect(result.externalId).toBe(
      "aizumi_/_files/00654074/r7_4_kaigiroku.pdf",
    );
    expect(result.statements).toEqual([]);
  });

  it("平成の定例会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "平成25年第4回定例会",
        heldOn: "2013-12-01",
        pdfUrl:
          "https://www.town.aizumi.lg.jp/_files/00041799/h25_4_kaigiroku.pdf",
        meetingType: "plenary",
        pdfPath: "/_files/00041799/h25_4_kaigiroku.pdf",
      },
      "municipality-id-456",
    );

    expect(result.title).toBe("平成25年第4回定例会");
    expect(result.heldOn).toBe("2013-12-01");
    expect(result.externalId).toBe(
      "aizumi_/_files/00041799/h25_4_kaigiroku.pdf",
    );
  });
});
