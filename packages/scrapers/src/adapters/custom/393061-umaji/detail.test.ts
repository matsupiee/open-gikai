import { describe, it, expect } from "vitest";
import {
  extractHeldOn,
  buildMeetingTitle,
  detectMeetingTypeFromEntry,
  buildExternalId,
  buildStatements,
  buildMeetingData,
} from "./detail";
import type { UmajiPdfEntry } from "./list";

describe("extractHeldOn", () => {
  it("ラベルから令和年月日を抽出する", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc.pdf",
      label: "第1回臨時会（令和7年1月20日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況（令和7年度）",
    };

    expect(extractHeldOn(entry)).toBe("2025-01-20");
  });

  it("ラベルから平成年月日を抽出する", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2013/06/abc.pdf",
      label: "第3回定例会（平成25年6月17日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/100/",
      postTitle: "議決の状況",
    };

    expect(extractHeldOn(entry)).toBe("2013-06-17");
  });

  it("ラベルに日付がない場合は投稿タイトルから抽出する", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/03/abc.pdf",
      label: "議決の状況",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "令和7年3月6日 第2回定例会",
    };

    expect(extractHeldOn(entry)).toBe("2025-03-06");
  });

  it("ラベルにも投稿タイトルにも日付がない場合は null を返す", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc.pdf",
      label: "議決の状況",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/560/",
      postTitle: "馬路村議会について",
    };

    expect(extractHeldOn(entry)).toBeNull();
  });
});

describe("buildMeetingTitle", () => {
  it("ラベルが定例会を含む場合はラベルをタイトルとして使用する", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/03/abc.pdf",
      label: "第2回定例会（令和7年3月6日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況（令和7年度）",
    };

    expect(buildMeetingTitle(entry)).toBe("第2回定例会（令和7年3月6日）");
  });

  it("ラベルが臨時会を含む場合はラベルをタイトルとして使用する", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc.pdf",
      label: "第1回臨時会（令和7年1月20日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況（令和7年度）",
    };

    expect(buildMeetingTitle(entry)).toBe("第1回臨時会（令和7年1月20日）");
  });

  it("ラベルが会議名でない場合は投稿タイトルとラベルを組み合わせる", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc.pdf",
      label: "令和7年度版",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3408/",
      postTitle: "議会の開催状況",
    };

    expect(buildMeetingTitle(entry)).toBe("議会の開催状況 令和7年度版");
  });

  it("ラベルが投稿タイトルと同じ場合は投稿タイトルのみ返す", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc.pdf",
      label: "議会の開催状況",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3408/",
      postTitle: "議会の開催状況",
    };

    expect(buildMeetingTitle(entry)).toBe("議会の開催状況");
  });
});

describe("detectMeetingTypeFromEntry", () => {
  it("ラベルに臨時を含む場合は extraordinary を返す", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc.pdf",
      label: "第1回臨時会（令和7年1月20日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況",
    };

    expect(detectMeetingTypeFromEntry(entry)).toBe("extraordinary");
  });

  it("投稿タイトルに臨時を含む場合は extraordinary を返す", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc.pdf",
      label: "令和7年度分",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "臨時会の状況",
    };

    expect(detectMeetingTypeFromEntry(entry)).toBe("extraordinary");
  });

  it("臨時を含まない場合は plenary を返す", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/03/abc.pdf",
      label: "第2回定例会（令和7年3月6日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況",
    };

    expect(detectMeetingTypeFromEntry(entry)).toBe("plenary");
  });
});

describe("buildExternalId", () => {
  it("PDF URL パスから外部 ID を生成する", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc123hash.pdf",
      label: "第1回臨時会（令和7年1月20日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況",
    };

    expect(buildExternalId(entry)).toBe("umaji_2025_01_abc123hash");
  });

  it("外部 ID は umaji_ プレフィックスを持つ", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/03/def456hash.pdf",
      label: "第2回定例会（令和7年3月6日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況",
    };

    const id = buildExternalId(entry);
    expect(id.startsWith("umaji_")).toBe(true);
  });
});

describe("buildStatements", () => {
  it("ラベルから単一の remark statement を生成する", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc.pdf",
      label: "第1回臨時会（令和7年1月20日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況",
    };

    const statements = buildStatements(entry);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBeNull();
    expect(statements[0]!.content).toBe("第1回臨時会（令和7年1月20日）");
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("第1回臨時会（令和7年1月20日）".length);
  });

  it("contentHash が付与される", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc.pdf",
      label: "第1回臨時会（令和7年1月20日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況",
    };

    const statements = buildStatements(entry);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ラベルが空の場合は投稿タイトルをコンテンツとして使用する", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc.pdf",
      label: "",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況（令和7年度）",
    };

    const statements = buildStatements(entry);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("議決の状況（令和7年度）");
  });
});

describe("buildMeetingData", () => {
  it("正常な PDF エントリから MeetingData を生成する", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc123.pdf",
      label: "第1回臨時会（令和7年1月20日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況（令和7年度）",
    };

    const result = buildMeetingData(entry, "municipality_id_001", 2025);

    expect(result).not.toBeNull();
    expect(result!.municipalityCode).toBe("municipality_id_001");
    expect(result!.title).toBe("第1回臨時会（令和7年1月20日）");
    expect(result!.meetingType).toBe("extraordinary");
    expect(result!.heldOn).toBe("2025-01-20");
    expect(result!.sourceUrl).toBe("https://vill.umaji.lg.jp/about/parliament/3360/");
    expect(result!.statements).toHaveLength(1);
  });

  it("対象年と異なる年のエントリは null を返す", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2024/03/abc123.pdf",
      label: "第2回定例会（令和6年3月8日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3200/",
      postTitle: "議決の状況（令和6年度）",
    };

    const result = buildMeetingData(entry, "municipality_id_001", 2025);
    expect(result).toBeNull();
  });

  it("開催日が取得できない場合は null を返す", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc.pdf",
      label: "議決の状況",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/560/",
      postTitle: "馬路村議会について",
    };

    const result = buildMeetingData(entry, "municipality_id_001", 2025);
    expect(result).toBeNull();
  });

  it("定例会エントリは meetingType が plenary になる", () => {
    const entry: UmajiPdfEntry = {
      pdfUrl: "https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/03/abc123.pdf",
      label: "第2回定例会（令和7年3月6日）",
      postUrl: "https://vill.umaji.lg.jp/about/parliament/3360/",
      postTitle: "議決の状況（令和7年度）",
    };

    const result = buildMeetingData(entry, "municipality_id_001", 2025);

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2025-03-06");
  });
});
