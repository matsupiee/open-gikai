import { describe, it, expect } from "vitest";
import {
  parseYearPage,
  parseDateFromTitle,
  parseSessionFromTitle,
} from "./list";

describe("parseDateFromTitle", () => {
  it("令和期パターン（月あり）の日付をパースする", () => {
    expect(parseDateFromTitle("第1回能登町議会1月会議録", 2024)).toBe(
      "2024-01-01"
    );
  });

  it("令和期パターン（定例会）の日付をパースする", () => {
    expect(parseDateFromTitle("第2回能登町議会3月定例会議録", 2024)).toBe(
      "2024-03-01"
    );
  });

  it("令和期パターン（9月）の日付をパースする", () => {
    expect(parseDateFromTitle("第5回能登町議会9月定例会議録", 2023)).toBe(
      "2023-09-01"
    );
  });

  it("令和期パターン（12月）の日付をパースする", () => {
    expect(parseDateFromTitle("第6回能登町議会12月定例会議録", 2024)).toBe(
      "2024-12-01"
    );
  });

  it("平成期パターン（月なし）は null を返す", () => {
    expect(
      parseDateFromTitle("平成17年第1回能登町議会定例会", 2005)
    ).toBeNull();
  });

  it("タイトルに月情報がない場合は null を返す", () => {
    expect(parseDateFromTitle("能登町議会議員名簿", 2024)).toBeNull();
  });
});

describe("parseSessionFromTitle", () => {
  it("令和期パターンの定例会を抽出する", () => {
    expect(parseSessionFromTitle("第2回能登町議会3月定例会議録")).toBe(
      "第2回3月定例会"
    );
  });

  it("令和期パターンの通常会議を抽出する", () => {
    expect(parseSessionFromTitle("第1回能登町議会1月会議録")).toBe(
      "第1回1月会議"
    );
  });

  it("令和期パターンの12月定例会を抽出する", () => {
    expect(parseSessionFromTitle("第6回能登町議会12月定例会議録")).toBe(
      "第6回12月定例会"
    );
  });

  it("平成期パターンの定例会を抽出する", () => {
    expect(
      parseSessionFromTitle("平成17年第1回能登町議会定例会")
    ).toBe("第1回定例会");
  });

  it("平成期パターンの臨時会を抽出する", () => {
    expect(
      parseSessionFromTitle("平成17年第2回能登町議会臨時会")
    ).toBe("第2回臨時会");
  });

  it("種別が不明な場合は空文字を返す", () => {
    expect(parseSessionFromTitle("議員名簿")).toBe("");
  });
});

describe("parseYearPage", () => {
  it("PDF リンクを正しく抽出する（令和期）", () => {
    const html = `
      <div class="files">
        <p>
          <a href="//www.town.noto.lg.jp/material/files/group/14/R7_1kaigiroku.pdf">
            第1回能登町議会1月会議録 (PDFファイル: 301.0KB)
          </a>
        </p>
        <p>
          <a href="//www.town.noto.lg.jp/material/files/group/14/R7_2kaigiroku.pdf">
            第2回能登町議会3月定例会議録 (PDFファイル: 450.0KB)
          </a>
        </p>
      </div>
    `;

    const meetings = parseYearPage(html, 2025);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("第1回能登町議会1月会議録");
    expect(meetings[0]!.heldOn).toBe("2025-01-01");
    expect(meetings[0]!.session).toBe("第1回1月会議");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.noto.lg.jp/material/files/group/14/R7_1kaigiroku.pdf"
    );

    expect(meetings[1]!.title).toBe("第2回能登町議会3月定例会議録");
    expect(meetings[1]!.heldOn).toBe("2025-03-01");
    expect(meetings[1]!.session).toBe("第2回3月定例会");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.noto.lg.jp/material/files/group/14/R7_2kaigiroku.pdf"
    );
  });

  it("PDF リンクを正しく抽出する（平成期）", () => {
    const html = `
      <div class="files">
        <p>
          <a href="//www.town.noto.lg.jp/material/files/group/14/0000024411.pdf">
            平成17年第1回能登町議会臨時会 (PDFファイル: 200.0KB)
          </a>
        </p>
        <p>
          <a href="//www.town.noto.lg.jp/material/files/group/14/0000024412.pdf">
            平成17年第1回能登町議会定例会 (PDFファイル: 350.0KB)
          </a>
        </p>
      </div>
    `;

    const meetings = parseYearPage(html, 2005);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("平成17年第1回能登町議会臨時会");
    expect(meetings[0]!.heldOn).toBeNull();
    expect(meetings[0]!.session).toBe("第1回臨時会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.noto.lg.jp/material/files/group/14/0000024411.pdf"
    );
  });

  it("material/files/group/14/ を含まないリンクはスキップする", () => {
    const html = `
      <p>
        <a href="//www.town.noto.lg.jp/material/files/group/14/R7_1kaigiroku.pdf">
          第1回能登町議会1月会議録 (PDFファイル: 301.0KB)
        </a>
      </p>
      <p>
        <a href="//www.town.noto.lg.jp/material/files/group/5/other.pdf">
          その他文書 (PDFファイル: 100.0KB)
        </a>
      </p>
      <p>
        <a href="/kakuka/1013/gyomu/1/1/3430.html">令和7年ページ</a>
      </p>
    `;

    const meetings = parseYearPage(html, 2025);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第1回能登町議会1月会議録");
  });

  it("絶対 URL の href も正規化する", () => {
    const html = `
      <a href="https://www.town.noto.lg.jp/material/files/group/14/R6_test.pdf">
        第1回能登町議会1月会議録 (PDFファイル: 100.0KB)
      </a>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.noto.lg.jp/material/files/group/14/R6_test.pdf"
    );
  });

  it("ルート相対 URL の href も正規化する", () => {
    const html = `
      <a href="/material/files/group/14/R6_test.pdf">
        第1回能登町議会1月会議録 (PDFファイル: 100.0KB)
      </a>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.noto.lg.jp/material/files/group/14/R6_test.pdf"
    );
  });

  it("タイトルが空のリンクはスキップする", () => {
    const html = `
      <a href="//www.town.noto.lg.jp/material/files/group/14/R7_1kaigiroku.pdf">
      </a>
    `;

    const meetings = parseYearPage(html, 2025);
    expect(meetings).toHaveLength(0);
  });
});
