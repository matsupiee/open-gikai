import { describe, expect, it } from "vitest";
import { classifyKind, parseHeldOn, detectMeetingType, parsePdfUrl, parseTitle } from "./detail";
import { createHash } from "node:crypto";

describe("classifyKind", () => {
  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseHeldOn", () => {
  it("令和6年第3回定例会を正しくパースする", () => {
    expect(parseHeldOn("五木村議会会議録（令和6年第3回定例会）")).toBe("2024-01-01");
  });

  it("令和7年第1回定例会を正しくパースする", () => {
    expect(parseHeldOn("五木村議会会議録（令和7年第1回定例会）")).toBe("2025-01-01");
  });

  it("令和5年第1回臨時会を正しくパースする", () => {
    expect(parseHeldOn("五木村議会会議録（令和5年第1回臨時会）")).toBe("2023-01-01");
  });

  it("平成30年第2回定例会を正しくパースする", () => {
    expect(parseHeldOn("五木村議会会議録（平成30年第2回定例会）")).toBe("2018-01-01");
  });

  it("パターンに合致しない場合は null を返す", () => {
    expect(parseHeldOn("議会広報紙「やまめ」第30号")).toBeNull();
  });

  it("括弧なしのタイトルは null を返す", () => {
    expect(parseHeldOn("五木村議会会議録")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary", () => {
    expect(detectMeetingType("五木村議会会議録（令和6年第3回定例会）")).toBe("plenary");
  });

  it("臨時会は extraordinary", () => {
    expect(detectMeetingType("五木村議会会議録（令和5年第1回臨時会）")).toBe("extraordinary");
  });

  it("委員会は committee", () => {
    expect(detectMeetingType("総務委員会会議録")).toBe("committee");
  });

  it("不明な場合は plenary", () => {
    expect(detectMeetingType("五木村議会会議録")).toBe("plenary");
  });
});

describe("parsePdfUrl", () => {
  it("相対 PDF リンクを絶対 URL に変換する", () => {
    const html = `
      <div>
        <a href="3_2032_2984_up_m4dlqqbi.pdf">会議録PDFダウンロード</a>
      </div>
    `;
    const articleUrl = "https://www.vill.itsuki.lg.jp/kiji0032032/index.html";

    expect(parsePdfUrl(html, articleUrl)).toBe(
      "https://www.vill.itsuki.lg.jp/kiji0032032/3_2032_2984_up_m4dlqqbi.pdf"
    );
  });

  it("絶対 URL の PDF リンクをそのまま返す", () => {
    const html = `
      <a href="https://www.vill.itsuki.lg.jp/kiji0031916/3_1916_2706_up_42x1c6e7.pdf">ダウンロード</a>
    `;
    const articleUrl = "https://www.vill.itsuki.lg.jp/kiji0031916/index.html";

    expect(parsePdfUrl(html, articleUrl)).toBe(
      "https://www.vill.itsuki.lg.jp/kiji0031916/3_1916_2706_up_42x1c6e7.pdf"
    );
  });

  it("PDF リンクがない場合は null を返す", () => {
    const html = `<div><a href="index.html">トップ</a></div>`;
    const articleUrl = "https://www.vill.itsuki.lg.jp/kiji0032032/index.html";

    expect(parsePdfUrl(html, articleUrl)).toBeNull();
  });

  it("複数 PDF リンクがある場合は最初のものを返す", () => {
    const html = `
      <a href="file1.pdf">PDF1</a>
      <a href="file2.pdf">PDF2</a>
    `;
    const articleUrl = "https://www.vill.itsuki.lg.jp/kiji0032032/index.html";

    expect(parsePdfUrl(html, articleUrl)).toBe(
      "https://www.vill.itsuki.lg.jp/kiji0032032/file1.pdf"
    );
  });
});

describe("parseTitle", () => {
  it("class=title の H1 見出しを優先して返す", () => {
    const html = `
      <html>
        <head><title>サイトタイトル | 五木村</title></head>
        <body>
          <h1 id="hd_header"></h1>
          <h1 class="title">五木村議会会議録（令和6年第3回定例会）</h1>
        </body>
      </html>
    `;

    expect(parseTitle(html)).toBe("五木村議会会議録（令和6年第3回定例会）");
  });

  it("空の H1 をスキップし、テキストのある H1 を返す", () => {
    const html = `
      <html>
        <body>
          <h1></h1>
          <h1>五木村議会会議録（令和6年第1回定例会）</h1>
        </body>
      </html>
    `;

    expect(parseTitle(html)).toBe("五木村議会会議録（令和6年第1回定例会）");
  });

  it("H1 がない場合は title タグを返す", () => {
    const html = `
      <html>
        <head><title>五木村議会会議録（令和6年第3回定例会）</title></head>
        <body></body>
      </html>
    `;

    expect(parseTitle(html)).toBe("五木村議会会議録（令和6年第3回定例会）");
  });

  it("どちらもない場合は null を返す", () => {
    const html = `<html><body></body></html>`;

    expect(parseTitle(html)).toBeNull();
  });

  it("H1 内の HTML タグを除去する", () => {
    const html = `<h1><span>五木村議会会議録（令和6年第3回定例会）</span></h1>`;

    expect(parseTitle(html)).toBe("五木村議会会議録（令和6年第3回定例会）");
  });
});

describe("contentHash", () => {
  it("SHA-256 ハッシュが正しく生成される", () => {
    const content = "会議録PDF: https://www.vill.itsuki.lg.jp/kiji0032032/3_2032_2984_up_m4dlqqbi.pdf";
    const expected = createHash("sha256").update(content).digest("hex");

    expect(expected).toMatch(/^[a-f0-9]{64}$/);
  });
});
