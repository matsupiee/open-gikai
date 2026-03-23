import { describe, expect, it } from "vitest";
import { buildMeetingData, estimateHeldOn } from "./detail";

describe("estimateHeldOn", () => {
  it("第1回定例会は3月と推定する", () => {
    expect(estimateHeldOn("令和6年第1回定例会会議録", 2024)).toBe("2024-03-01");
  });

  it("第2回定例会は6月と推定する", () => {
    expect(estimateHeldOn("令和6年第2回定例会会議録", 2024)).toBe("2024-06-01");
  });

  it("第3回定例会は9月と推定する", () => {
    expect(estimateHeldOn("令和6年第3回定例会会議録", 2024)).toBe("2024-09-01");
  });

  it("第4回定例会は12月と推定する", () => {
    expect(estimateHeldOn("令和6年第4回定例会会議録", 2024)).toBe("2024-12-01");
  });

  it("回次がマッピング外の場合は1月1日にフォールバックする", () => {
    expect(estimateHeldOn("令和6年第5回臨時会会議録", 2024)).toBe("2024-01-01");
  });

  it("回次がない場合は1月1日にフォールバックする", () => {
    expect(estimateHeldOn("令和6年議会会議録", 2024)).toBe("2024-01-01");
  });
});

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第2回定例会会議録",
        pdfUrl:
          "https://www.town.ashikita.lg.jp/resource.php?e=56437ba5be12b4df37e12db8e87273f8",
        meetingType: "plenary",
        year: 2024,
        yearSlug: "r6",
      },
      "municipality-id-123",
    );

    expect(result.municipalityId).toBe("municipality-id-123");
    expect(result.title).toBe("令和6年第2回定例会会議録");
    expect(result.meetingType).toBe("plenary");
    expect(result.heldOn).toBe("2024-06-01");
    expect(result.sourceUrl).toBe(
      "https://www.town.ashikita.lg.jp/resource.php?e=56437ba5be12b4df37e12db8e87273f8",
    );
    expect(result.externalId).toBe("ashikita_r6_令和6年第2回定例会会議録");
    expect(result.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "平成22年第2回臨時会会議録",
        pdfUrl:
          "https://www.town.ashikita.lg.jp/resource.php?e=abcdef1234567890",
        meetingType: "extraordinary",
        year: 2010,
        yearSlug: "h22",
      },
      "municipality-id-456",
    );

    expect(result.meetingType).toBe("extraordinary");
    expect(result.externalId).toBe("ashikita_h22_平成22年第2回臨時会会議録");
    expect(result.heldOn).toBe("2010-06-01");
  });
});
