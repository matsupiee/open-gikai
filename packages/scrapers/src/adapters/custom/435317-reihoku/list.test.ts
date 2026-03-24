import { describe, expect, it } from "vitest";
import { parsePdfLinks } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年第2回定例会")).toBe(2024);
    expect(parseWarekiYear("令和元年第1回定例会")).toBe(2019);
    expect(parseWarekiYear("令和8年第1回臨時会")).toBe(2026);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成25年第1回定例会")).toBe(2013);
    expect(parseWarekiYear("平成30年第4回定例会")).toBe(2018);
    expect(parseWarekiYear("平成元年第1回定例会")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("議会会議録")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和6年第1回定例会")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和6年第1回臨時会")).toBe("extraordinary");
  });
});

describe("parsePdfLinks", () => {
  it("PDFリンクを抽出する", () => {
    const html = `
      <div>
        <a href="3_676_3438_up_h6vpiiko.pdf" target="_blank">
          <img src="pdf_icon.png" />
          令和8年第1回臨時会（PDF：432.2キロバイト）
          <img src="newwindow_icon.png" />
        </a>
        <a href="3_676_3437_up_gusv3uc3.pdf" target="_blank">
          <img src="pdf_icon.png" />
          令和7年第5回定例会（PDF：1,234.5キロバイト）
          <img src="newwindow_icon.png" />
        </a>
        <a href="3_676_1_R5_1_rinjikai.pdf" target="_blank">
          <img src="pdf_icon.png" />
          令和5年第1回臨時会（PDF：345.6キロバイト）
          <img src="newwindow_icon.png" />
        </a>
      </div>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和8年第1回臨時会",
      pdfUrl: "https://reihoku-kumamoto.jp/kiji003676/3_676_3438_up_h6vpiiko.pdf",
      meetingType: "extraordinary",
      year: 2026,
    });
    expect(result[1]).toEqual({
      title: "令和7年第5回定例会",
      pdfUrl: "https://reihoku-kumamoto.jp/kiji003676/3_676_3437_up_gusv3uc3.pdf",
      meetingType: "plenary",
      year: 2025,
    });
    expect(result[2]!.title).toBe("令和5年第1回臨時会");
    expect(result[2]!.meetingType).toBe("extraordinary");
    expect(result[2]!.year).toBe(2023);
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません。</p>";
    expect(parsePdfLinks(html)).toEqual([]);
  });

  it("会議録パターンに合致しないリンクはスキップする", () => {
    const html = `
      <a href="other.pdf" target="_blank">その他資料（PDF：100キロバイト）</a>
      <a href="3_676_3438_up_h6vpiiko.pdf" target="_blank">
        令和6年第2回定例会（PDF：500キロバイト）
      </a>
    `;

    const result = parsePdfLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年第2回定例会");
  });

  it("重複するURLは除外する", () => {
    const html = `
      <a href="3_676_3438_up_h6vpiiko.pdf" target="_blank">
        令和6年第2回定例会（PDF：500キロバイト）
      </a>
      <a href="3_676_3438_up_h6vpiiko.pdf" target="_blank">
        令和6年第2回定例会（PDF：500キロバイト）
      </a>
    `;

    const result = parsePdfLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクテキストからファイルサイズ情報を除去する", () => {
    const html = `
      <a href="3_676_3438_up_abc.pdf" target="_blank">
        令和6年第1回定例会（PDF：432.2キロバイト）
      </a>
    `;

    const result = parsePdfLinks(html);
    expect(result[0]!.title).toBe("令和6年第1回定例会");
  });

  it("旧形式のファイル名も処理できる", () => {
    const html = `
      <a href="3_676_32_7b7cd6248fe70ef38ba59ee98e3a7fb4.pdf" target="_blank">
        平成30年第22回定例会（PDF：2,345.6キロバイト）
      </a>
    `;

    const result = parsePdfLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("平成30年第22回定例会");
    expect(result[0]!.year).toBe(2018);
    expect(result[0]!.meetingType).toBe("plenary");
  });
});
