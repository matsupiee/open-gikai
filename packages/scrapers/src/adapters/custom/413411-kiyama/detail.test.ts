import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "会議録（令和6年第4回定例会） 12月3日 会期日程・提案理由説明等",
        heldOn: "2024-12-03",
        pdfUrl:
          "https://www.town.kiyama.lg.jp/gikai/kiji0036218/3_6218_31650_up_44nde6ix.pdf",
        meetingType: "plenary",
        detailPageUrl:
          "https://www.town.kiyama.lg.jp/gikai/kiji0036218/index.html",
      },
      "municipality-id-413411"
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityId).toBe("municipality-id-413411");
    expect(result!.title).toBe("会議録（令和6年第4回定例会） 12月3日 会期日程・提案理由説明等");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-12-03");
    expect(result!.sourceUrl).toBe(
      "https://www.town.kiyama.lg.jp/gikai/kiji0036218/3_6218_31650_up_44nde6ix.pdf"
    );
    expect(result!.externalId).toMatch(/^kiyama_2024-12-03_/);
    expect(result!.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "会議録（令和6年第1回臨時会） 1月16日 会期決定・議案審議等",
        heldOn: "2024-01-16",
        pdfUrl:
          "https://www.town.kiyama.lg.jp/gikai/kiji0035442/3_5442_25471_up_r2bdvode.pdf",
        meetingType: "extraordinary",
        detailPageUrl:
          "https://www.town.kiyama.lg.jp/gikai/kiji0035442/index.html",
      },
      "municipality-id-413411"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
    expect(result!.externalId).toMatch(/^kiyama_2024-01-16_/);
  });

  it("externalId がユニークになるようなパターンを含む", () => {
    const result1 = buildMeetingData(
      {
        title: "会議録（令和6年第4回定例会） 12月3日 会期日程・提案理由説明等",
        heldOn: "2024-12-03",
        pdfUrl:
          "https://www.town.kiyama.lg.jp/gikai/kiji0036218/3_6218_31650_up_44nde6ix.pdf",
        meetingType: "plenary",
        detailPageUrl:
          "https://www.town.kiyama.lg.jp/gikai/kiji0036218/index.html",
      },
      "municipality-id-413411"
    );

    const result2 = buildMeetingData(
      {
        title: "会議録（令和6年第4回定例会） 12月4日 一般質問",
        heldOn: "2024-12-04",
        pdfUrl:
          "https://www.town.kiyama.lg.jp/gikai/kiji0036218/3_6218_31651_up_hh1dz1pu.pdf",
        meetingType: "plenary",
        detailPageUrl:
          "https://www.town.kiyama.lg.jp/gikai/kiji0036218/index.html",
      },
      "municipality-id-413411"
    );

    expect(result1!.externalId).not.toBe(result2!.externalId);
  });
});
