import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年12月定例会 1日目",
        heldOn: "2024-12-01",
        pdfUrl: "https://www.town.tara.lg.jp/var/rev0/0012/8535/12541415489.pdf",
        meetingType: "plenary",
        yearPageUrl:
          "https://www.town.tara.lg.jp/chosei/_1010/_1414/_6753.html",
      },
      "municipality-id-414417"
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityCode).toBe("municipality-id-414417");
    expect(result!.title).toBe("令和6年12月定例会 1日目");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-12-01");
    expect(result!.sourceUrl).toBe(
      "https://www.town.tara.lg.jp/var/rev0/0012/8535/12541415489.pdf"
    );
    expect(result!.externalId).toMatch(/^tara_2024-12-01_/);
    expect(result!.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年5月臨時会 1日目",
        heldOn: "2024-05-01",
        pdfUrl: "https://www.town.tara.lg.jp/var/rev0/0019/9930/126219191234.pdf",
        meetingType: "extraordinary",
        yearPageUrl:
          "https://www.town.tara.lg.jp/chosei/_1010/_1414/_6753.html",
      },
      "municipality-id-414417"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
    expect(result!.externalId).toMatch(/^tara_2024-05-01_/);
  });

  it("委員会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年度決算審査特別委員会 1日目",
        heldOn: "2024-09-01",
        pdfUrl: "https://www.town.tara.lg.jp/var/rev0/0019/9940/file1.pdf",
        meetingType: "committee",
        yearPageUrl:
          "https://www.town.tara.lg.jp/chosei/_1010/_1414/_1454.html",
      },
      "municipality-id-414417"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("committee");
  });

  it("externalId がユニークになるようなパターンを含む", () => {
    const result1 = buildMeetingData(
      {
        title: "令和6年12月定例会 1日目",
        heldOn: "2024-12-01",
        pdfUrl: "https://www.town.tara.lg.jp/var/rev0/0012/8535/file1.pdf",
        meetingType: "plenary",
        yearPageUrl:
          "https://www.town.tara.lg.jp/chosei/_1010/_1414/_6753.html",
      },
      "municipality-id-414417"
    );

    const result2 = buildMeetingData(
      {
        title: "令和6年12月定例会 2日目",
        heldOn: "2024-12-02",
        pdfUrl: "https://www.town.tara.lg.jp/var/rev0/0012/8536/file2.pdf",
        meetingType: "plenary",
        yearPageUrl:
          "https://www.town.tara.lg.jp/chosei/_1010/_1414/_6753.html",
      },
      "municipality-id-414417"
    );

    expect(result1!.externalId).not.toBe(result2!.externalId);
  });
});
