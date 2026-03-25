import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和7年第1回定例会 1日目会議録",
        heldOn: "2025-02-28",
        pdfUrl: "https://www.city.ureshino.lg.jp/var/rev0/0047/2592/1258610641.pdf",
        meetingType: "plenary",
        sessionPagePath: "/gikai/hokoku/394/_32067/_32074.html",
      },
      "municipality-id-412091"
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityCode).toBe("municipality-id-412091");
    expect(result!.title).toBe("令和7年第1回定例会 1日目会議録");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2025-02-28");
    expect(result!.sourceUrl).toBe(
      "https://www.city.ureshino.lg.jp/var/rev0/0047/2592/1258610641.pdf"
    );
    expect(result!.externalId).toMatch(/^ureshino_2025-02-28_/);
    expect(result!.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和7第1回臨時会 会議録",
        heldOn: "2025-04-01",
        pdfUrl: "https://www.city.ureshino.lg.jp/var/rev0/0047/9999/1234567890.pdf",
        meetingType: "extraordinary",
        sessionPagePath: "/gikai/hokoku/394/_32067/_32243.html",
      },
      "municipality-id-412091"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
    expect(result!.externalId).toMatch(/^ureshino_2025-04-01_/);
  });

  it("externalId がユニークになるパターンを含む", () => {
    const result1 = buildMeetingData(
      {
        title: "令和7年第1回定例会 1日目会議録",
        heldOn: "2025-02-28",
        pdfUrl: "https://www.city.ureshino.lg.jp/var/rev0/0047/2592/1258610641.pdf",
        meetingType: "plenary",
        sessionPagePath: "/gikai/hokoku/394/_32067/_32074.html",
      },
      "municipality-id-412091"
    );

    const result2 = buildMeetingData(
      {
        title: "令和7年第1回定例会 2日目会議録",
        heldOn: "2025-03-10",
        pdfUrl: "https://www.city.ureshino.lg.jp/var/rev0/0047/2593/1258610735.pdf",
        meetingType: "plenary",
        sessionPagePath: "/gikai/hokoku/394/_32067/_32074.html",
      },
      "municipality-id-412091"
    );

    expect(result1!.externalId).not.toBe(result2!.externalId);
  });

  it("externalId に PDF パスが含まれる", () => {
    const result = buildMeetingData(
      {
        title: "令和7年第1回定例会 1日目会議録",
        heldOn: "2025-02-28",
        pdfUrl: "https://www.city.ureshino.lg.jp/var/rev0/0047/2592/1258610641.pdf",
        meetingType: "plenary",
        sessionPagePath: "/gikai/hokoku/394/_32067/_32074.html",
      },
      "municipality-id-412091"
    );

    expect(result!.externalId).toContain("rev0_0047_2592_1258610641");
  });
});
