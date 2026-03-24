import { describe, expect, it } from "vitest";
import { parseEraYear, parseLinkText, parsePage } from "./list";

describe("parseEraYear", () => {
  it("令和の年を西暦に変換する", () => {
    expect(parseEraYear("令和７年")).toBe(2025);
    expect(parseEraYear("令和６年")).toBe(2024);
    expect(parseEraYear("令和元年")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(parseEraYear("平成24年")).toBe(2012);
    expect(parseEraYear("平成元年")).toBe(1989);
  });

  it("strong タグを含むテキストも処理する", () => {
    expect(parseEraYear("<strong>令和７年</strong>")).toBe(2025);
  });

  it("日本語以外は null を返す", () => {
    expect(parseEraYear("2024年")).toBeNull();
    expect(parseEraYear("議事日程")).toBeNull();
  });
});

describe("parseLinkText", () => {
  it("新形式のリンクテキストをパースする", () => {
    const result = parseLinkText("本会議3号（12月9日）[PDF：414KB]", 2024);
    expect(result.meetingName).toBe("本会議3号");
    expect(result.heldOn).toBe("2024-12-09");
  });

  it("本会議1号のリンクテキストをパースする", () => {
    const result = parseLinkText("本会議１号（12月8日）[PDF：610KB]", 2024);
    expect(result.meetingName).toBe("本会議１号");
    expect(result.heldOn).toBe("2024-12-08");
  });

  it("月日が1桁の場合もゼロパディングする", () => {
    const result = parseLinkText("本会議1号（3月1日）", 2024);
    expect(result.heldOn).toBe("2024-03-01");
  });

  it("月日なしのテキストは heldOn が null", () => {
    const result = parseLinkText("議事日程", 2024);
    expect(result.heldOn).toBeNull();
  });
});

describe("parsePage", () => {
  it("新形式（R6以降）の PDF リンクを抽出する", () => {
    const html = `
      <div class="body">
        <h3><strong>令和７年</strong></h3>
        <ul>
          <li>第４回定例会［１２月］</li>
        </ul>
        <p>　・<a class="iconFile iconPdf" href="file_contents/071209.pdf">本会議3号（12月9日）[PDF：414KB]</a></p>
        <p>　・<a class="iconFile iconPdf" href="file_contents/071208.pdf">本会議2号（12月8日）[PDF：610KB]</a></p>
      </div>
    `;

    const records = parsePage(html, 2025);

    expect(records.length).toBeGreaterThanOrEqual(2);
    const rec0 = records[0]!;
    expect(rec0.pdfUrl).toBe(
      "https://www.town.rokunohe.aomori.jp/docs/2023051900005/file_contents/071209.pdf",
    );
    expect(rec0.title).toBe("本会議3号");
    expect(rec0.heldOn).toBe("2025-12-09");
  });

  it("旧形式（R5以前）のネスト構造から PDF リンクを抽出する", () => {
    const html = `
      <div class="body">
        <h3>令和５年</h3>
        <ul>
          <li>第８回定例会［12月］
            <ul>
              <li><a class="iconFile iconPdf" href="file_contents/126.pdf">本会議３号（12月６日）[PDF：458KB]</a></li>
            </ul>
          </li>
        </ul>
      </div>
    `;

    const records = parsePage(html, 2023);

    expect(records.length).toBeGreaterThanOrEqual(1);
    const rec = records[0]!;
    expect(rec.pdfUrl).toBe(
      "https://www.town.rokunohe.aomori.jp/docs/2023051900005/file_contents/126.pdf",
    );
    expect(rec.heldOn).toBe("2023-12-06");
  });

  it("旧形式で ../../file/ パスの PDF リンクを絶対 URL に変換する", () => {
    const html = `
      <div class="body">
        <h3>令和５年</h3>
        <ul>
          <li>第７回臨時会［10月］
            <ul>
              <li><a href="../../file/chousei/cyougikai/kaigiroku/R5-7rinnzihonkaigi1.pdf">本会議１号（10月19日）</a></li>
            </ul>
          </li>
        </ul>
      </div>
    `;

    const records = parsePage(html, 2023);

    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records[0]!.pdfUrl).toBe(
      "https://www.town.rokunohe.aomori.jp/file/chousei/cyougikai/kaigiroku/R5-7rinnzihonkaigi1.pdf",
    );
  });

  it("img を含むダミーリンクは除外する", () => {
    const html = `
      <div class="body">
        <h3>令和５年</h3>
        <ul>
          <li>第８回定例会
            <ul>
              <li><a href="file_contents/126.pdf">本会議３号（12月６日）</a>
                <a href="../../file/1912190611.pdf"><img alt="PDFアイコン" src="../../file/icon_pdf.gif" /></a>(PDF/134KB)
              </li>
            </ul>
          </li>
        </ul>
      </div>
    `;

    const records = parsePage(html, 2023);

    // 最初のリンクのみ取得し、ダミーリンクは除外される
    const pdfUrls = records.map((r) => r.pdfUrl);
    expect(pdfUrls).not.toContain(
      "https://www.town.rokunohe.aomori.jp/file/chousei/cyougikai/kaigiroku/1912190611.pdf",
    );
  });

  it("対象年以外のセクションは除外する", () => {
    const html = `
      <div class="body">
        <h3>令和７年</h3>
        <p><a class="iconFile iconPdf" href="file_contents/r7.pdf">本会議1号（1月10日）</a></p>
        <h3>令和６年</h3>
        <p><a class="iconFile iconPdf" href="file_contents/r6.pdf">本会議1号（1月10日）</a></p>
      </div>
    `;

    const records2025 = parsePage(html, 2025);
    const records2024 = parsePage(html, 2024);

    const r7Urls = records2025.map((r) => r.pdfUrl);
    const r6Urls = records2024.map((r) => r.pdfUrl);

    expect(
      r7Urls.some((u) => u.includes("r7.pdf")),
    ).toBe(true);
    expect(
      r7Urls.some((u) => u.includes("r6.pdf")),
    ).toBe(false);
    expect(
      r6Urls.some((u) => u.includes("r6.pdf")),
    ).toBe(true);
    expect(
      r6Urls.some((u) => u.includes("r7.pdf")),
    ).toBe(false);
  });

  it("データがない年は空配列を返す", () => {
    const html = `
      <div class="body">
        <h3>令和７年</h3>
        <p><a class="iconFile iconPdf" href="file_contents/r7.pdf">本会議1号（1月10日）</a></p>
      </div>
    `;

    const records = parsePage(html, 2020);
    expect(records).toHaveLength(0);
  });
});
