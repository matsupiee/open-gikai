import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和7年12月定例会 第1日（開会・議案説明）",
        heldOn: "2025-12-01",
        pdfUrl: "https://www.city.arida.lg.jp/_res/projects/default_project/_page_/001/005/452/1_r07_12_giansetsumei.pdf",
        meetingType: "plenary",
        meetingId: "1005452",
      },
      "municipality-id-123",
    );

    expect(result.municipalityId).toBe("municipality-id-123");
    expect(result.title).toBe("令和7年12月定例会 第1日（開会・議案説明）");
    expect(result.meetingType).toBe("plenary");
    expect(result.heldOn).toBe("2025-12-01");
    expect(result.sourceUrl).toBe(
      "https://www.city.arida.lg.jp/_res/projects/default_project/_page_/001/005/452/1_r07_12_giansetsumei.pdf",
    );
    expect(result.externalId).toBe("arida_1005452_2025-12-01");
    expect(result.statements).toEqual([]);
  });

  it("異なる会議の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年9月定例会 第2日（一般質問・議案質疑）",
        heldOn: "2024-09-15",
        pdfUrl: "https://www.city.arida.lg.jp/_res/projects/default_project/_page_/001/005/026/2_r06_09_ippansitsumon.pdf",
        meetingType: "plenary",
        meetingId: "1005026",
      },
      "municipality-id-456",
    );

    expect(result.municipalityId).toBe("municipality-id-456");
    expect(result.externalId).toBe("arida_1005026_2024-09-15");
    expect(result.statements).toEqual([]);
  });
});
