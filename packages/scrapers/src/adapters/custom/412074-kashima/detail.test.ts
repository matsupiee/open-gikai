import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年12月定例会 11月29日（開会日）",
        heldOn: "2024-11-29",
        pdfUrl:
          "https://www.city.saga-kashima.lg.jp/site_files/file/gikai/kaigiroku/2024/20241129%E3%80%80%E9%B9%BF%E5%B3%B6%E5%B8%82%EF%BC%88%E9%96%8B%E4%BC%9A%EF%BC%89.pdf",
        meetingType: "plenary",
        yearPagePath: "/main/35934.html",
      },
      "municipality-id-412074"
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityId).toBe("municipality-id-412074");
    expect(result!.title).toBe("令和6年12月定例会 11月29日（開会日）");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-11-29");
    expect(result!.sourceUrl).toBe(
      "https://www.city.saga-kashima.lg.jp/site_files/file/gikai/kaigiroku/2024/20241129%E3%80%80%E9%B9%BF%E5%B3%B6%E5%B8%82%EF%BC%88%E9%96%8B%E4%BC%9A%EF%BC%89.pdf"
    );
    expect(result!.externalId).toMatch(/^kashima_2024-11-29_/);
    expect(result!.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年5月臨時会 5月1日（開会日）",
        heldOn: "2024-05-01",
        pdfUrl:
          "https://www.city.saga-kashima.lg.jp/site_files/file/gikai/kaigiroku/2024/R06.5.1%E3%80%80%E9%B9%BF%E5%B3%B6%E5%B8%82%EF%BC%88%E9%96%8B%E4%BC%9A%EF%BC%89.pdf",
        meetingType: "extraordinary",
        yearPagePath: "/main/35934.html",
      },
      "municipality-id-412074"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
    expect(result!.externalId).toMatch(/^kashima_2024-05-01_/);
  });

  it("externalId がユニークになるようなパターンを含む", () => {
    const result1 = buildMeetingData(
      {
        title: "令和6年12月定例会 11月29日（開会日）",
        heldOn: "2024-11-29",
        pdfUrl:
          "https://www.city.saga-kashima.lg.jp/site_files/file/gikai/kaigiroku/2024/20241129_kaigi.pdf",
        meetingType: "plenary",
        yearPagePath: "/main/35934.html",
      },
      "municipality-id-412074"
    );

    const result2 = buildMeetingData(
      {
        title: "令和6年12月定例会 12月5日（議案審議）",
        heldOn: "2024-12-05",
        pdfUrl:
          "https://www.city.saga-kashima.lg.jp/site_files/file/gikai/kaigiroku/2024/20241205_gian.pdf",
        meetingType: "plenary",
        yearPagePath: "/main/35934.html",
      },
      "municipality-id-412074"
    );

    expect(result1!.externalId).not.toBe(result2!.externalId);
  });
});
