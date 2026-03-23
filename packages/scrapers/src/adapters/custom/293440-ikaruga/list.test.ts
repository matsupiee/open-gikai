import { describe, expect, it } from "vitest";
import { parseListPage, buildHeldOn } from "./list";

describe("buildHeldOn", () => {
  it("年と月から YYYY-MM-01 を返す", () => {
    expect(buildHeldOn(2025, "3月定例会")).toBe("2025-03-01");
  });

  it("12月を正しく処理する", () => {
    expect(buildHeldOn(2024, "12月定例会")).toBe("2024-12-01");
  });

  it("月が不明な場合は YYYY-01-01 を返す", () => {
    expect(buildHeldOn(2025, "委員会")).toBe("2025-01-01");
  });

  it("臨時会も月を抽出できる", () => {
    expect(buildHeldOn(2025, "5月臨時会")).toBe("2025-05-01");
  });

  it("year が null の場合は空文字を返す", () => {
    expect(buildHeldOn(null, "3月定例会")).toBe("");
  });
});

describe("parseListPage", () => {
  it("本会議ページから PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
      <h2>令和7年</h2>
      <p>3月定例会</p>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/419/r07031nichime.pdf">第1日目</a></li>
        <li><a href="./cmsfiles/contents/0000000/419/r07032nichime.pdf">第2日目</a></li>
      </ul>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, {
      url: "/0000000419.html",
      category: "plenary",
      label: "本会議",
    });

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ikaruga.nara.jp/cmsfiles/contents/0000000/419/r07031nichime.pdf",
    );
    expect(meetings[0]!.title).toContain("本会議");
    expect(meetings[0]!.title).toContain("第1日目");
    expect(meetings[0]!.heldOn).toBe("2025-03-01");
    expect(meetings[0]!.category).toBe("plenary");
  });

  it("目次 PDF はスキップする", () => {
    const html = `
      <html>
      <body>
      <h2>令和7年</h2>
      <p>12月定例会</p>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/419/12gatsugikaimokuji.pdf">目次</a></li>
        <li><a href="./cmsfiles/contents/0000000/419/r07121nichime.pdf">第1日目</a></li>
      </ul>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, {
      url: "/0000000419.html",
      category: "plenary",
      label: "本会議",
    });

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toContain("第1日目");
  });

  it("委員会ページから PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
      <h2>令和7年</h2>
      <p>12月</p>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/421/soumuR7.12.11.pdf">令和7年12月11日</a></li>
      </ul>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, {
      url: "/0000000421.html",
      category: "committee",
      label: "総務常任委員会",
    });

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ikaruga.nara.jp/cmsfiles/contents/0000000/421/soumuR7.12.11.pdf",
    );
    expect(meetings[0]!.category).toBe("committee");
    expect(meetings[0]!.pageLabel).toBe("総務常任委員会");
  });

  it("複数年度セクションからリンクを抽出する", () => {
    const html = `
      <html>
      <body>
      <h2>令和7年</h2>
      <p>3月定例会</p>
      <a href="./cmsfiles/contents/0000000/419/r07031nichime.pdf">第1日目</a>
      <h2>令和6年</h2>
      <p>12月定例会</p>
      <a href="./cmsfiles/contents/0000000/419/r06121nichime.pdf">第1日目</a>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, {
      url: "/0000000419.html",
      category: "plenary",
      label: "本会議",
    });

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-03-01");
    expect(meetings[1]!.heldOn).toBe("2024-12-01");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <html>
      <body>
      <h2>令和7年</h2>
      <p>会議録はありません</p>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, {
      url: "/0000000419.html",
      category: "plenary",
      label: "本会議",
    });

    expect(meetings).toHaveLength(0);
  });

  it("絶対パス形式の href も処理できる", () => {
    const html = `
      <html>
      <body>
      <h2>令和7年</h2>
      <p>3月定例会</p>
      <a href="/cmsfiles/contents/0000000/419/r07031nichime.pdf">第1日目</a>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, {
      url: "/0000000419.html",
      category: "plenary",
      label: "本会議",
    });

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ikaruga.nara.jp/cmsfiles/contents/0000000/419/r07031nichime.pdf",
    );
  });
});
