import { describe, expect, it } from "vitest";
import {
  parseContentBody,
  parseListPage,
  extractYearFromHeading,
} from "./list";

describe("parseContentBody", () => {
  it("h6 タグで区切られた定例会ブロックから PDF リンクを抽出する", () => {
    const html = `
      <div class="contentBody">
        <h6 class="content_p_01">第4回定例会（12月1日（月）から12月2日（火））</h6>
        <p><a href="/index.cfm/10,12437,c,html/12437/20251201-090000.pdf">１２月１日（月）　本会議１号（議事日程）</a></p>
        <p><a href="/index.cfm/10,12437,c,html/12437/20251201-100000.pdf">１２月１日（月）　本会議１号（開会、提案理由）</a></p>
      </div>
    `;

    const docs = parseContentBody(html, "令和7年会議録", "https://www.town.yokohama.lg.jp/index.cfm/10,0,47,html");

    expect(docs).toHaveLength(2);
    expect(docs[0]!.sessionTitle).toBe("第4回定例会(12月1日(月)から12月2日(火))");
    expect(docs[0]!.linkText).toBe("１２月１日（月）　本会議１号（議事日程）");
    expect(docs[0]!.pdfUrl).toBe("https://www.town.yokohama.lg.jp/index.cfm/10,12437,c,html/12437/20251201-090000.pdf");
    expect(docs[0]!.yearHeading).toBe("令和7年会議録");
    expect(docs[1]!.linkText).toBe("１２月１日（月）　本会議１号（開会、提案理由）");
  });

  it("臨時会ブロックからも PDF リンクを抽出する", () => {
    const html = `
      <div class="contentBody">
        <h6>第2回臨時会（12月19日（金））</h6>
        <p><a href="/index.cfm/10,12437,c,html/12437/20251219-120000.pdf">１２月１９日（金）　本会議１号（議事日程）</a></p>
      </div>
    `;

    const docs = parseContentBody(html, "令和7年会議録", "https://www.town.yokohama.lg.jp/index.cfm/10,0,47,html");

    expect(docs).toHaveLength(1);
    expect(docs[0]!.sessionTitle).toBe("第2回臨時会(12月19日(金))");
    expect(docs[0]!.pdfUrl).toBe("https://www.town.yokohama.lg.jp/index.cfm/10,12437,c,html/12437/20251219-120000.pdf");
  });

  it("複数の会議ブロックから PDF リンクをそれぞれ抽出する", () => {
    const html = `
      <div class="contentBody">
        <h6 class="content_p_01">第2回臨時会（12月19日（金））</h6>
        <p><a href="/index.cfm/10,12437,c,html/12437/20251219-120000.pdf">１２月１９日（金）　本会議１号（議事日程）</a></p>
        <h6 class="content_p_01">第4回定例会（12月1日（月）から12月2日（火））</h6>
        <p><a href="/index.cfm/10,12437,c,html/12437/20251201-090000.pdf">１２月１日（月）　本会議１号（議事日程）</a></p>
        <p><a href="/index.cfm/10,12437,c,html/12437/20251202-100000.pdf">１２月２日（火）　本会議２号（一般質問）</a></p>
      </div>
    `;

    const docs = parseContentBody(html, "令和7年会議録", "https://www.town.yokohama.lg.jp/index.cfm/10,0,47,html");

    expect(docs).toHaveLength(3);
    expect(docs[0]!.sessionTitle).toBe("第2回臨時会(12月19日(金))");
    expect(docs[1]!.sessionTitle).toBe("第4回定例会(12月1日(月)から12月2日(火))");
    expect(docs[2]!.sessionTitle).toBe("第4回定例会(12月1日(月)から12月2日(火))");
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `
      <div class="contentBody">
        <h6>第1回定例会（3月3日（月）から3月6日（木））</h6>
        <p><a href="https://www.town.yokohama.lg.jp/index.cfm/10,12437,c,html/12437/20260311-132035.pdf">３月３日（月）　本会議１号（開会）</a></p>
      </div>
    `;

    const docs = parseContentBody(html, "令和8年会議録", "https://www.town.yokohama.lg.jp/index.cfm/10,0,47,html");

    expect(docs).toHaveLength(1);
    expect(docs[0]!.pdfUrl).toBe("https://www.town.yokohama.lg.jp/index.cfm/10,12437,c,html/12437/20260311-132035.pdf");
  });

  it("会議録関連でない h6 タグはスキップする", () => {
    const html = `
      <div class="contentBody">
        <h6>お知らせ</h6>
        <p><a href="/notice.pdf">お知らせ文書</a></p>
        <h6>第4回定例会（12月1日（月）から12月2日（火））</h6>
        <p><a href="/index.cfm/10,12437,c,html/12437/20251201-090000.pdf">１２月１日（月）　本会議１号（議事日程）</a></p>
      </div>
    `;

    const docs = parseContentBody(html, "令和7年会議録", "https://www.town.yokohama.lg.jp/index.cfm/10,0,47,html");

    expect(docs).toHaveLength(1);
    expect(docs[0]!.sessionTitle).toBe("第4回定例会(12月1日(月)から12月2日(火))");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div class="contentBody"><p>会議録はございません。</p></div>`;
    const docs = parseContentBody(html, "令和7年会議録", "https://www.town.yokohama.lg.jp/index.cfm/10,0,47,html");
    expect(docs).toHaveLength(0);
  });
});

describe("parseListPage", () => {
  it("h2 の 会議録 見出しブロックから PDF リンクを抽出する", () => {
    const html = `
      <div id="CenterArea">
        <div class="content">
          <section>
            <h2 class="titleOfContent">令和7年会議録</h2>
            <div class="contentBodyBox">
              <div class="contentBody">
                <h6 class="content_p_01">第4回定例会（12月1日（月）から12月2日（火））</h6>
                <p><a href="/index.cfm/10,12437,c,html/12437/20251201-090000.pdf">１２月１日（月）　本会議１号（議事日程）</a></p>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;

    const docs = parseListPage(html, "https://www.town.yokohama.lg.jp/index.cfm/10,0,47,html");

    expect(docs).toHaveLength(1);
    expect(docs[0]!.yearHeading).toBe("令和7年会議録");
    expect(docs[0]!.sessionTitle).toBe("第4回定例会(12月1日(月)から12月2日(火))");
  });

  it("複数年度のブロックがある場合はすべて抽出する", () => {
    const html = `
      <div>
        <h2 class="titleOfContent">令和7年会議録</h2>
        <h6>第4回定例会（12月1日（月））</h6>
        <p><a href="/index.cfm/10,12437,c,html/12437/20251201-090000.pdf">１２月１日（月）　本会議１号（開会）</a></p>
        <h2 class="titleOfContent">令和6年会議録</h2>
        <h6>第4回定例会（12月2日（月））</h6>
        <p><a href="/index.cfm/10,12437,c,html/12437/20241202-090000.pdf">１２月２日（月）　本会議１号（開会）</a></p>
      </div>
    `;

    const docs = parseListPage(html, "https://www.town.yokohama.lg.jp/index.cfm/10,0,47,html");

    expect(docs).toHaveLength(2);
    expect(docs[0]!.yearHeading).toBe("令和7年会議録");
    expect(docs[1]!.yearHeading).toBe("令和6年会議録");
  });
});

describe("extractYearFromHeading", () => {
  it("令和7年会議録 → 2025", () => {
    expect(extractYearFromHeading("令和7年会議録")).toBe(2025);
  });

  it("令和元年会議録 → 2019", () => {
    expect(extractYearFromHeading("令和元年会議録")).toBe(2019);
  });

  it("令和６年会議録（全角）→ 2024", () => {
    expect(extractYearFromHeading("令和６年会議録")).toBe(2024);
  });

  it("平成31年会議録 → 2019", () => {
    expect(extractYearFromHeading("平成31年会議録")).toBe(2019);
  });

  it("解析できない場合は null を返す", () => {
    expect(extractYearFromHeading("会議録一覧")).toBeNull();
  });
});
