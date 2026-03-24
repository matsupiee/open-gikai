import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("定例会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "【令和６年３月定例会】 第１日目",
        heldOn: "2024-02-26",
        pdfUrl: "https://www.city.odate.lg.jp/uploads/public/pages_0000012038_00/令和06年03月定例会01日目.pdf",
        meetingType: "plenary",
        sessionGroupTitle: "【令和６年３月定例会】",
        dayLabel: "第１日目",
      },
      "municipality-id-123"
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityId).toBe("municipality-id-123");
    expect(result!.title).toBe("【令和６年３月定例会】 第１日目");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-02-26");
    expect(result!.sourceUrl).toBe(
      "https://www.city.odate.lg.jp/uploads/public/pages_0000012038_00/令和06年03月定例会01日目.pdf"
    );
    expect(result!.externalId).toMatch(/^odate_/);
    expect(result!.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "【令和元年第１回臨時会】 第１日目",
        heldOn: "2019-05-20",
        pdfUrl: "https://www.city.odate.lg.jp/uploads/public/pages_0000000776_00/005_010501.pdf",
        meetingType: "extraordinary",
        sessionGroupTitle: "【令和元年第１回臨時会】",
        dayLabel: "第１日目",
      },
      "municipality-id-456"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
    expect(result!.heldOn).toBe("2019-05-20");
  });

  it("heldOn が null の場合は null を返す", () => {
    const result = buildMeetingData(
      {
        title: "【令和６年３月定例会】 第１日目",
        heldOn: null,
        pdfUrl: "https://www.city.odate.lg.jp/uploads/public/pages_0000012038_00/test.pdf",
        meetingType: "plenary",
        sessionGroupTitle: "【令和６年３月定例会】",
        dayLabel: "第１日目",
      },
      "municipality-id-789"
    );

    expect(result).toBeNull();
  });

  it("externalId に odate_ プレフィックスが付く", () => {
    const result = buildMeetingData(
      {
        title: "【令和６年３月定例会】 第１日目",
        heldOn: "2024-02-26",
        pdfUrl: "https://www.city.odate.lg.jp/uploads/public/pages_0000012038_00/令和06年03月定例会01日目.pdf",
        meetingType: "plenary",
        sessionGroupTitle: "【令和６年３月定例会】",
        dayLabel: "第１日目",
      },
      "municipality-id-123"
    );

    expect(result!.externalId).toMatch(/^odate_/);
  });

  it("statements が空配列", () => {
    const result = buildMeetingData(
      {
        title: "【令和６年６月定例会】 第２日目",
        heldOn: "2024-06-03",
        pdfUrl: "https://www.city.odate.lg.jp/uploads/public/pages_0000012038_00/令和06年06月定例会02日目.pdf",
        meetingType: "plenary",
        sessionGroupTitle: "【令和６年６月定例会】",
        dayLabel: "第２日目",
      },
      "municipality-id-123"
    );

    expect(result!.statements).toEqual([]);
  });

  it("異なる PDF URL の externalId は異なる", () => {
    const result1 = buildMeetingData(
      {
        title: "【令和６年３月定例会】 第１日目",
        heldOn: "2024-02-26",
        pdfUrl: "https://www.city.odate.lg.jp/uploads/public/pages_0000012038_00/令和06年03月定例会01日目.pdf",
        meetingType: "plenary",
        sessionGroupTitle: "【令和６年３月定例会】",
        dayLabel: "第１日目",
      },
      "municipality-id-123"
    );
    const result2 = buildMeetingData(
      {
        title: "【令和６年３月定例会】 第２日目",
        heldOn: "2024-03-04",
        pdfUrl: "https://www.city.odate.lg.jp/uploads/public/pages_0000012038_00/令和06年03月定例会02日目.pdf",
        meetingType: "plenary",
        sessionGroupTitle: "【令和６年３月定例会】",
        dayLabel: "第２日目",
      },
      "municipality-id-123"
    );

    expect(result1!.externalId).not.toBe(result2!.externalId);
  });
});
