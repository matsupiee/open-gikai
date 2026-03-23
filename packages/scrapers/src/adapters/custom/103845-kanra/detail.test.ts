import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("正常な detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "第４回定例会（令和６年１２月） 第1号",
        heldOn: "2024-12-06",
        pdfUrl:
          "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/202412061gou.pdf",
        meetingType: "plenary",
        detailPageUrl:
          "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/20250411134013.html",
        sessionIndex: 0,
      },
      "103845",
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityId).toBe("103845");
    expect(result!.title).toBe("第４回定例会（令和６年１２月） 第1号");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-12-06");
    expect(result!.sourceUrl).toBe(
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/202412061gou.pdf",
    );
    expect(result!.externalId).toBe("kanra_20250411134013_0");
    expect(result!.statements).toEqual([]);
  });

  it("臨時会タイトルから meetingType が extraordinary になる", () => {
    const result = buildMeetingData(
      {
        title: "第１回臨時会（令和６年１月） 第1号",
        heldOn: "2024-01-15",
        pdfUrl:
          "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/202401151gou.pdf",
        meetingType: "extraordinary",
        detailPageUrl:
          "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/20240226100105.html",
        sessionIndex: 0,
      },
      "103845",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("sessionIndex が 1 の場合 externalId に 1 が含まれる", () => {
    const result = buildMeetingData(
      {
        title: "第４回定例会（令和６年１２月） 第2号",
        heldOn: "2024-12-12",
        pdfUrl:
          "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/202412122gou.pdf",
        meetingType: "plenary",
        detailPageUrl:
          "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/20250411134013.html",
        sessionIndex: 1,
      },
      "103845",
    );

    expect(result).not.toBeNull();
    expect(result!.externalId).toBe("kanra_20250411134013_1");
  });

  it("heldOn が null の場合は null を返す", () => {
    const result = buildMeetingData(
      {
        title: "第３回定例会（令和６年９月） 第1号",
        heldOn: null,
        pdfUrl:
          "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/20240906.1gou.pdf",
        meetingType: "plenary",
        detailPageUrl:
          "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/20241224115111.html",
        sessionIndex: 0,
      },
      "103845",
    );

    expect(result).toBeNull();
  });
});
