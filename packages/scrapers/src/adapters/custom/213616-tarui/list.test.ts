import { describe, it, expect } from "vitest";
import { parseYearPage } from "./list";

describe("parseYearPage", () => {
  it("dl/dt/dd 形式の HTML から PDF リンクを抽出する", () => {
    const html = `
      <div class="page-text__text">
        <dl>
          <dt>第5回定例会</dt>
          <dd><a href="/uploaded/attachment/11111.pdf">目次 [PDFファイル／76KB]</a></dd>
          <dd><a href="/uploaded/attachment/11112.pdf">会議録　令和６年12月３日（水曜日） [PDFファイル／255KB]</a></dd>
          <dd><a href="/uploaded/attachment/11113.pdf">会議録　令和６年12月10日（水曜日）（一般質問） [PDFファイル／480KB]</a></dd>
        </dl>
        <dl>
          <dt>第3回臨時会</dt>
          <dd><a href="/uploaded/attachment/22221.pdf">目次 [PDFファイル／50KB]</a></dd>
          <dd><a href="/uploaded/attachment/22222.pdf">会議録　令和６年8月5日（月曜日） [PDFファイル／150KB]</a></dd>
        </dl>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe("https://www.town.tarui.lg.jp/uploaded/attachment/11112.pdf");
    expect(meetings[0]!.heldOn).toBe("2024-12-03");
    expect(meetings[0]!.sessionTitle).toBe("第5回定例会");
    expect(meetings[0]!.title).toBe("第5回定例会");

    expect(meetings[1]!.pdfUrl).toBe("https://www.town.tarui.lg.jp/uploaded/attachment/11113.pdf");
    expect(meetings[1]!.heldOn).toBe("2024-12-10");
    expect(meetings[1]!.sessionTitle).toBe("第5回定例会");

    expect(meetings[2]!.pdfUrl).toBe("https://www.town.tarui.lg.jp/uploaded/attachment/22222.pdf");
    expect(meetings[2]!.heldOn).toBe("2024-08-05");
    expect(meetings[2]!.sessionTitle).toBe("第3回臨時会");
  });

  it("目次 PDF はスキップする", () => {
    const html = `
      <dl>
        <dt>第5回定例会</dt>
        <dd><a href="/uploaded/attachment/11111.pdf">目次 [PDFファイル／76KB]</a></dd>
        <dd><a href="/uploaded/attachment/11112.pdf">会議録　令和６年12月３日（水曜日） [PDFファイル／255KB]</a></dd>
      </dl>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("11112");
  });

  it("/uploaded/attachment/ 以外の PDF はスキップする", () => {
    const html = `
      <dl>
        <dt>第5回定例会</dt>
        <dd><a href="/other/document.pdf">会議録　令和６年12月３日（水曜日）</a></dd>
        <dd><a href="/uploaded/attachment/11112.pdf">会議録　令和６年12月10日（水曜日） [PDFファイル／255KB]</a></dd>
      </dl>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("/uploaded/attachment/");
  });

  it("日付を含まないリンクはスキップする", () => {
    const html = `
      <dl>
        <dt>第5回定例会</dt>
        <dd><a href="/uploaded/attachment/11112.pdf">会議録（一般質問） [PDFファイル／255KB]</a></dd>
        <dd><a href="/uploaded/attachment/11113.pdf">会議録　令和６年12月10日（水曜日） [PDFファイル／480KB]</a></dd>
      </dl>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-12-10");
  });

  it("yearFilter で指定年以外はスキップする", () => {
    const html = `
      <dl>
        <dt>第5回定例会</dt>
        <dd><a href="/uploaded/attachment/11112.pdf">会議録　令和６年12月３日（水曜日） [PDFファイル／255KB]</a></dd>
      </dl>
      <dl>
        <dt>第4回定例会</dt>
        <dd><a href="/uploaded/attachment/22222.pdf">会議録　令和５年12月5日（火曜日） [PDFファイル／200KB]</a></dd>
      </dl>
    `;

    const meetings2024 = parseYearPage(html, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-12-03");

    const meetings2023 = parseYearPage(html, 2023);
    expect(meetings2023).toHaveLength(1);
    expect(meetings2023[0]!.heldOn).toBe("2023-12-05");
  });

  it("dl がない場合は空配列を返す", () => {
    const html = `<div><p>準備中です</p></div>`;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("絶対 URL の PDF リンクも処理する", () => {
    const html = `
      <dl>
        <dt>第5回定例会</dt>
        <dd><a href="https://www.town.tarui.lg.jp/uploaded/attachment/11112.pdf">会議録　令和６年12月３日（水曜日） [PDFファイル／255KB]</a></dd>
      </dl>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe("https://www.town.tarui.lg.jp/uploaded/attachment/11112.pdf");
  });

  it("平成の日付も正しく解析する", () => {
    const html = `
      <dl>
        <dt>第3回定例会</dt>
        <dd><a href="/uploaded/attachment/33333.pdf">会議録　平成30年12月10日（月曜日） [PDFファイル／300KB]</a></dd>
      </dl>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-12-10");
  });
});
