import { describe, expect, it } from "vitest";
import {
  parseFilename,
  parseMeetingHeading,
  parseDateText,
  parseListPage,
} from "./list";
import { detectMeetingType, toHalfWidth, reiwaToWestern } from "./shared";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和２年３月９日")).toBe("令和2年3月9日");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("reiwaToWestern", () => {
  it("令和7年を2025年に変換する", () => {
    expect(reiwaToWestern("7")).toBe(2025);
  });

  it("令和元年を2019年に変換する", () => {
    expect(reiwaToWestern("元")).toBe(2019);
  });

  it("令和4年を2022年に変換する", () => {
    expect(reiwaToWestern("4")).toBe(2022);
  });

  it("令和6年を2024年に変換する", () => {
    expect(reiwaToWestern("6")).toBe(2024);
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("臨時会")).toBe("extraordinary");
  });

  it("デフォルトはplenaryを返す", () => {
    expect(detectMeetingType("本会議")).toBe("plenary");
  });
});

describe("parseFilename", () => {
  it("新形式の定例会（日程あり）をパースする", () => {
    const result = parseFilename("R7.3tei1.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.sessionNum).toBe(3);
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.dayNum).toBe(1);
    expect(result!.month).toBeNull();
    expect(result!.day).toBeNull();
  });

  it("新形式の定例会（日程なし）をパースする", () => {
    const result = parseFilename("R6.4tei1.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.sessionNum).toBe(4);
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.dayNum).toBe(1);
  });

  it("新形式の臨時会をパースする", () => {
    const result = parseFilename("R7.5rin.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.sessionNum).toBe(5);
    expect(result!.meetingKind).toBe("臨時会");
    expect(result!.dayNum).toBeNull();
  });

  it("旧形式1の定例会をパースする（令和5年）", () => {
    const result = parseFilename("4tei.R05.12.12.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2023);
    expect(result!.sessionNum).toBe(4);
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.month).toBe(12);
    expect(result!.day).toBe(12);
  });

  it("旧形式2の定例会をパースする（令和4年）", () => {
    const result = parseFilename("kaigiroku4tei1R04.12.13.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2022);
    expect(result!.sessionNum).toBe(4);
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.dayNum).toBe(1);
    expect(result!.month).toBe(12);
    expect(result!.day).toBe(13);
  });

  it("不明なファイル名はnullを返す", () => {
    expect(parseFilename("unknown.pdf")).toBeNull();
    expect(parseFilename("document.pdf")).toBeNull();
  });
});

describe("parseMeetingHeading", () => {
  it("〇令和X年第Y回定例会をパースする", () => {
    const result = parseMeetingHeading("〇令和７年第３回定例会（12月2日・3日）");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.sessionNum).toBe(3);
    expect(result!.meetingKind).toBe("定例会");
  });

  it("〇令和X年第Y回臨時会をパースする", () => {
    const result = parseMeetingHeading("〇令和６年第５回臨時会（11月8日）");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.sessionNum).toBe(5);
    expect(result!.meetingKind).toBe("臨時会");
  });

  it("全角数字の見出しをパースする", () => {
    const result = parseMeetingHeading("〇令和７年第３回定例会");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.sessionNum).toBe(3);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseMeetingHeading("会議録一覧")).toBeNull();
    expect(parseMeetingHeading("令和7年度")).toBeNull();
  });
});

describe("parseDateText", () => {
  it("月日テキストをパースする", () => {
    const result = parseDateText("12月2日");
    expect(result).not.toBeNull();
    expect(result!.month).toBe(12);
    expect(result!.day).toBe(2);
  });

  it("全角数字の月日をパースする", () => {
    const result = parseDateText("３月１７日");
    expect(result).not.toBeNull();
    expect(result!.month).toBe(3);
    expect(result!.day).toBe(17);
  });

  it("月日情報がない場合はnullを返す", () => {
    expect(parseDateText("会議録")).toBeNull();
    expect(parseDateText("PDF")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("新形式PDFリンクを含む一覧ページをパースする", () => {
    const html = `
      <p>〇令和７年第３回定例会（12月2日・3日）</p>
      <a href="files/R7.3tei1.pdf">12月2日</a>
      <a href="files/R7.3tei2.pdf">12月3日</a>
    `;

    const result = parseListPage(html);
    expect(result.length).toBeGreaterThanOrEqual(2);

    const tei1 = result.find((r) => r.pdfUrl.includes("R7.3tei1.pdf"));
    expect(tei1).not.toBeUndefined();
    expect(tei1!.title).toBe("第3回定例会1日目");
    expect(tei1!.heldOn).toBe("2025-12-02");
    expect(tei1!.meetingType).toBe("plenary");
    expect(tei1!.pdfUrl).toBe(
      "https://www.town.yoichi.hokkaido.jp/gikai/kaigiroku/files/R7.3tei1.pdf"
    );
  });

  it("新形式臨時会PDFリンクをパースする", () => {
    const html = `
      <p>〇令和６年第５回臨時会（11月8日）</p>
      <a href="files/R6.5rin.pdf">11月8日</a>
    `;

    const result = parseListPage(html);
    const rin = result.find((r) => r.pdfUrl.includes("R6.5rin.pdf"));
    expect(rin).not.toBeUndefined();
    expect(rin!.title).toBe("第5回臨時会");
    expect(rin!.heldOn).toBe("2024-11-08");
    expect(rin!.meetingType).toBe("extraordinary");
  });

  it("旧形式1（令和5年）のPDFリンクをパースする", () => {
    const html = `
      <p>〇令和５年第４回定例会</p>
      <a href="files/4tei.R05.12.12.pdf">12月12日</a>
    `;

    const result = parseListPage(html);
    const item = result.find((r) => r.pdfUrl.includes("4tei.R05.12.12.pdf"));
    expect(item).not.toBeUndefined();
    expect(item!.title).toBe("第4回定例会");
    expect(item!.heldOn).toBe("2023-12-12");
    expect(item!.meetingType).toBe("plenary");
  });

  it("旧形式2（令和4年）のPDFリンクをパースする", () => {
    const html = `
      <p>〇令和４年第４回定例会</p>
      <a href="files/kaigiroku4tei1R04.12.13.pdf">12月13日</a>
    `;

    const result = parseListPage(html);
    const item = result.find((r) =>
      r.pdfUrl.includes("kaigiroku4tei1R04.12.13.pdf")
    );
    expect(item).not.toBeUndefined();
    expect(item!.title).toBe("第4回定例会1日目");
    expect(item!.heldOn).toBe("2022-12-13");
    expect(item!.meetingType).toBe("plenary");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("PDFではないリンクは除外する", () => {
    const html = `
      <a href="files/readme.txt">説明書</a>
      <a href="files/R7.3tei1.pdf">12月2日</a>
    `;

    const result = parseListPage(html);
    expect(result.every((r) => r.pdfUrl.endsWith(".pdf"))).toBe(true);
  });
});
