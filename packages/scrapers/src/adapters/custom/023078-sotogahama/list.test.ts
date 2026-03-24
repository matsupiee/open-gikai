import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import { parseDateFromFilename } from "./shared";

describe("parseDateFromFilename", () => {
  it("議会だよりファイル名から YYYY-MM-DD を取得する", () => {
    const result = parseDateFromFilename("202602_soto_gikaidayori_83");
    expect(result).toBe("2026-02-01");
  });

  it("一般質問通告表ファイル名から YYYY-MM-DD を取得する", () => {
    const result = parseDateFromFilename("202603_ippan_situmon");
    expect(result).toBe("2026-03-01");
  });

  it("年月が取得できない場合は null を返す", () => {
    const result = parseDateFromFilename("unknown_file");
    expect(result).toBeNull();
  });

  it("月が 13 以上の場合は null を返す", () => {
    const result = parseDateFromFilename("202413_soto_gikaidayori_83");
    expect(result).toBeNull();
  });

  it("古いファイル名パターンも処理できる", () => {
    const result = parseDateFromFilename("202405_soto_gikaidayori_76");
    expect(result).toBe("2024-05-01");
  });
});

describe("parseListPage (dayori)", () => {
  it("議会だより PDF リンクを収集する", () => {
    const html = `
      <html>
        <body>
          <h3>令和8年度</h3>
          <ul>
            <li><a href="files/202602_soto_gikaidayori_83.pdf">議会だより第83号（令和8年2月号）</a></li>
            <li><a href="files/202511_soto_gikaidayori_82.pdf">議会だより第82号（令和7年11月号）</a></li>
          </ul>
        </body>
      </html>
    `;

    const docs = parseListPage(html, "dayori");

    expect(docs).toHaveLength(2);
    expect(docs[0]!.pdfUrl).toBe(
      "http://www.town.sotogahama.lg.jp/gyosei/gikai/files/202602_soto_gikaidayori_83.pdf",
    );
    expect(docs[0]!.issue).toBe("第83号");
    expect(docs[0]!.heldOn).toBe("2026-02-01");
    expect(docs[0]!.type).toBe("dayori");
    expect(docs[1]!.issue).toBe("第82号");
    expect(docs[1]!.heldOn).toBe("2025-11-01");
  });

  it("一般質問通告表 PDF は dayori フィルタで除外される", () => {
    const html = `
      <html>
        <body>
          <a href="files/202603_ippan_situmon.pdf">一般質問通告表</a>
          <a href="files/202602_soto_gikaidayori_83.pdf">議会だより第83号</a>
        </body>
      </html>
    `;

    const docs = parseListPage(html, "dayori");

    expect(docs).toHaveLength(1);
    expect(docs[0]!.filename).toBe("202602_soto_gikaidayori_83");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const docs = parseListPage("<html><body><p>テキストのみ</p></body></html>", "dayori");
    expect(docs).toHaveLength(0);
  });

  it("同じ PDF リンクが複数あっても重複を除去する", () => {
    const html = `
      <html>
        <body>
          <a href="files/202602_soto_gikaidayori_83.pdf">第83号（表紙）</a>
          <a href="files/202602_soto_gikaidayori_83.pdf">第83号（本文）</a>
        </body>
      </html>
    `;

    const docs = parseListPage(html, "dayori");

    expect(docs).toHaveLength(1);
    expect(docs[0]!.issue).toBe("第83号");
  });

  it("絶対 URL の PDF リンクも処理できる", () => {
    const html = `
      <html>
        <body>
          <a href="http://www.town.sotogahama.lg.jp/gyosei/gikai/files/202602_soto_gikaidayori_83.pdf">第83号</a>
        </body>
      </html>
    `;

    const docs = parseListPage(html, "dayori");

    expect(docs).toHaveLength(1);
    expect(docs[0]!.pdfUrl).toBe(
      "http://www.town.sotogahama.lg.jp/gyosei/gikai/files/202602_soto_gikaidayori_83.pdf",
    );
  });
});

describe("parseListPage (ippan)", () => {
  it("一般質問通告表 PDF リンクを収集する", () => {
    const html = `
      <html>
        <body>
          <a href="files/202603_ippan_situmon.pdf">一般質問通告表（令和8年3月定例会）</a>
          <a href="files/202412_ippan_situmon.pdf">一般質問通告表（令和6年12月定例会）</a>
        </body>
      </html>
    `;

    const docs = parseListPage(html, "ippan");

    expect(docs).toHaveLength(2);
    expect(docs[0]!.type).toBe("ippan");
    expect(docs[0]!.heldOn).toBe("2026-03-01");
    expect(docs[0]!.issue).toBeNull();
    expect(docs[1]!.heldOn).toBe("2024-12-01");
  });

  it("議会だより PDF は ippan フィルタで除外される", () => {
    const html = `
      <html>
        <body>
          <a href="files/202602_soto_gikaidayori_83.pdf">議会だより第83号</a>
          <a href="files/202603_ippan_situmon.pdf">一般質問通告表</a>
        </body>
      </html>
    `;

    const docs = parseListPage(html, "ippan");

    expect(docs).toHaveLength(1);
    expect(docs[0]!.filename).toBe("202603_ippan_situmon");
  });
});
