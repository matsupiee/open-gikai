import { describe, it, expect } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  parseDetailPage,
  parseTitleDate,
  parseYearFromTitle,
} from "./detail";

describe("parseSpeaker", () => {
  it("カッコ形式: 議長（名前君）を解析する", () => {
    const result = parseSpeaker("○議長（山田太郎君） ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("カッコ形式: 村長（名前君）を解析する", () => {
    const result = parseSpeaker("○村長（鈴木一郎君） お答えいたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("カッコ形式: 番号議員パターンを解析する", () => {
    const result = parseSpeaker("○1番（田中花子君） 質問いたします。");
    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("カッコ形式: 副村長を解析する", () => {
    const result = parseSpeaker("○副村長（佐藤次郎君） ご説明いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("カッコ形式: 教育長を解析する", () => {
    const result = parseSpeaker("○教育長（中村三郎君） 答弁いたします。");
    expect(result.speakerName).toBe("中村三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("答弁いたします。");
  });

  it("スペース区切り形式: 議長を解析する", () => {
    const result = parseSpeaker("○ 山田 議長 ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("副委員長が委員長より優先される", () => {
    const result = parseSpeaker("○副委員長（佐藤花子君） ご報告いたします。");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("村長は answer", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer", () => {
    expect(classifyKind("副村長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーありのカッコ形式の発言を分割する", () => {
    const text = `○議長（山田太郎君） ただいまから会議を開きます。○1番（田中花子君） 質問があります。○村長（鈴木一郎君） お答えします。`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木一郎");
    expect(statements[2]!.speakerRole).toBe("村長");
  });

  it("○ マーカーなしのテキストは単一の remark として扱う", () => {
    const text =
      "令和6年第4回定例会 議案第1号 中芸広域連合規約の一部を変更する規約について 可決 議案第2号 北川村建設発生土処理場の利用に関する条例の一部を改正する条例について 可決";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBeNull();
    expect(statements[0]!.startOffset).toBe(0);
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○議長（山田太郎君） テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("○ マーカーなしテキストにも contentHash が付与される", () => {
    const statements = parseStatements("議案第1号 可決");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});

describe("parseDetailPage", () => {
  it("div.file_link > p.icon-pdf > a から PDF リンクを抽出する", () => {
    const html = `
      <div class="file_link">
        <p class="icon-pdf">
          <a href="/download/?t=LD&id=123&fid=456">
            令和7年第4回定例会 会期日程・審議結果（PDF：132KB）
          </a>
        </p>
      </div>
    `;

    const links = parseDetailPage(html);

    expect(links).toHaveLength(1);
    expect(links[0]!.pdfUrl).toBe(
      "https://www.kitagawamura.jp/download/?t=LD&id=123&fid=456"
    );
    expect(links[0]!.label).toBe(
      "令和7年第4回定例会 会期日程・審議結果（PDF：132KB）"
    );
  });

  it("複数の PDF リンクを抽出する", () => {
    const html = `
      <div class="file_link">
        <p class="icon-pdf">
          <a href="/download/?t=LD&id=123&fid=100">令和7年第4回定例会 会期日程・審議結果（PDF：132KB）</a>
        </p>
        <p class="icon-pdf">
          <a href="/download/?t=LD&id=123&fid=101">令和7年第4回定例会 会期及び審議の予定（PDF：98KB）</a>
        </p>
      </div>
    `;

    const links = parseDetailPage(html);

    expect(links).toHaveLength(2);
    expect(links[0]!.pdfUrl).toBe(
      "https://www.kitagawamura.jp/download/?t=LD&id=123&fid=100"
    );
    expect(links[1]!.pdfUrl).toBe(
      "https://www.kitagawamura.jp/download/?t=LD&id=123&fid=101"
    );
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div class="file_link"><p>PDF なし</p></div>`;
    expect(parseDetailPage(html)).toHaveLength(0);
  });
});

describe("parseTitleDate", () => {
  it("令和年月日を YYYY-MM-DD にパースする", () => {
    expect(parseTitleDate("令和6年第4回定例会(令和6年12月17日～18日)")).toBe(
      "2024-12-17"
    );
  });

  it("平成年月日を YYYY-MM-DD にパースする", () => {
    expect(parseTitleDate("平成30年第3回定例会(平成30年9月10日)")).toBe(
      "2018-09-10"
    );
  });

  it("日付がない場合は null を返す", () => {
    expect(parseTitleDate("令和7年第4回定例会 会期日程・審議結果")).toBeNull();
  });
});

describe("parseYearFromTitle", () => {
  it("令和から西暦年を取得する", () => {
    expect(parseYearFromTitle("令和7年第4回定例会")).toBe(2025);
  });

  it("令和6年から西暦年を取得する", () => {
    expect(parseYearFromTitle("令和6年第4回定例会")).toBe(2024);
  });

  it("平成から西暦年を取得する", () => {
    expect(parseYearFromTitle("平成30年第3回定例会")).toBe(2018);
  });

  it("元号がない場合は null を返す", () => {
    expect(parseYearFromTitle("第4回定例会")).toBeNull();
  });
});
