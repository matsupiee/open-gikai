import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("定例会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和７年１２月定例会 第１日",
        heldOn: "2025-12-01",
        pdfUrl: "https://www.town.ugo.lg.jp/uploads/user/gikaijimu/File/2025議会/令和７年１２月定例会会議録（第１日）.pdf",
        meetingType: "plenary",
        yearPageUrl: "https://www.town.ugo.lg.jp/administration/detail.html?id=1247&category_id=51",
        pdfLabel: "第１日",
        meetingName: "令和７年１２月定例会",
      },
      "municipality-id-123"
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityId).toBe("municipality-id-123");
    expect(result!.title).toBe("令和７年１２月定例会 第１日");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2025-12-01");
    expect(result!.sourceUrl).toBe("https://www.town.ugo.lg.jp/uploads/user/gikaijimu/File/2025議会/令和７年１２月定例会会議録（第１日）.pdf");
    expect(result!.externalId).toContain("ugo_");
    expect(result!.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和７年１２月臨時会 第１日",
        heldOn: "2025-12-01",
        pdfUrl: "https://www.town.ugo.lg.jp/uploads/user/gikaijimu/File/2025議会/令和７年１２月臨時会会議録（第１日）.pdf",
        meetingType: "extraordinary",
        yearPageUrl: "https://www.town.ugo.lg.jp/administration/detail.html?id=1247&category_id=51",
        pdfLabel: "第１日",
        meetingName: "令和７年１２月臨時会",
      },
      "municipality-id-456"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
    expect(result!.heldOn).toBe("2025-12-01");
  });

  it("委員会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和７年３月予算特別委員会 第１日",
        heldOn: "2025-03-01",
        pdfUrl: "https://www.town.ugo.lg.jp/uploads/user/gikaijimu/File/2025議会/committee.pdf",
        meetingType: "committee",
        yearPageUrl: "https://www.town.ugo.lg.jp/administration/detail.html?id=1247&category_id=51",
        pdfLabel: "第１日",
        meetingName: "令和７年３月予算特別委員会",
      },
      "municipality-id-789"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("committee");
  });

  it("heldOn が null の場合は null を返す", () => {
    const result = buildMeetingData(
      {
        title: "羽後町議会会議録 第１日",
        heldOn: null,
        pdfUrl: "https://www.town.ugo.lg.jp/uploads/user/gikaijimu/File/2025議会/foo.pdf",
        meetingType: "plenary",
        yearPageUrl: "https://www.town.ugo.lg.jp/administration/detail.html?id=1247&category_id=51",
        pdfLabel: "第１日",
        meetingName: "羽後町議会会議録",
      },
      "municipality-id-123"
    );

    expect(result).toBeNull();
  });

  it("externalId に ugo_ プレフィックスが含まれる", () => {
    const result = buildMeetingData(
      {
        title: "令和７年１２月定例会 第１日",
        heldOn: "2025-12-01",
        pdfUrl: "https://www.town.ugo.lg.jp/uploads/user/gikaijimu/File/2025議会/foo.pdf",
        meetingType: "plenary",
        yearPageUrl: "https://www.town.ugo.lg.jp/administration/detail.html?id=1247&category_id=51",
        pdfLabel: "第１日",
        meetingName: "令和７年１２月定例会",
      },
      "municipality-id-123"
    );

    expect(result!.externalId).toMatch(/^ugo_/);
  });

  it("statements が空配列", () => {
    const result = buildMeetingData(
      {
        title: "令和７年１２月定例会 第１日",
        heldOn: "2025-12-01",
        pdfUrl: "https://www.town.ugo.lg.jp/uploads/user/gikaijimu/File/2025議会/foo.pdf",
        meetingType: "plenary",
        yearPageUrl: "https://www.town.ugo.lg.jp/administration/detail.html?id=1247&category_id=51",
        pdfLabel: "第１日",
        meetingName: "令和７年１２月定例会",
      },
      "municipality-id-123"
    );

    expect(result!.statements).toEqual([]);
  });
});
