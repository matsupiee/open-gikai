import { describe, expect, it } from "vitest";
import {
  parseDateFromHeading,
  parseListPage,
} from "./list";

describe("parseDateFromHeading", () => {
  it("日付付きの臨時会見出しから日付を抽出する", () => {
    expect(parseDateFromHeading("令和7年第3回(8月7日)臨時会会議録")).toBe("2025-08-07");
  });

  it("日付付きの令和6年の見出しから日付を抽出する", () => {
    expect(parseDateFromHeading("令和6年第1回(3月1日)臨時会会議録")).toBe("2024-03-01");
  });

  it("月のみの定例会見出しは null を返す", () => {
    expect(parseDateFromHeading("令和7年第2回(6月)定例会会議録")).toBeNull();
  });

  it("日付なしの見出しは null を返す", () => {
    expect(parseDateFromHeading("令和7年第1回定例会会議録")).toBeNull();
  });

  it("平成年の日付付き見出しから日付を抽出する", () => {
    expect(parseDateFromHeading("平成21年第2回(6月5日)臨時会会議録")).toBe("2009-06-05");
  });

  it("全角数字を含む見出しから日付を抽出する", () => {
    expect(parseDateFromHeading("令和７年第３回(８月７日)臨時会会議録")).toBe("2025-08-07");
  });
});

describe("parseListPage", () => {
  it("h2 見出しと PDF リンクを対応づけて抽出する", () => {
    const html = `
      <h2>令和7年第3回(8月7日)臨時会会議録</h2>
      <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/0703rinnjikai.pdf">
        令和7年第3回臨時会 (PDFファイル: 189.4KB)
      </a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.okinoshima.shimane.jp/material/files/group/3/0703rinnjikai.pdf",
    );
    expect(meetings[0]!.title).toBe("令和7年第3回(8月7日)臨時会会議録");
    expect(meetings[0]!.heldOn).toBe("2025-08-07");
    expect(meetings[0]!.category).toBe("extraordinary");
    expect(meetings[0]!.pdfKey).toBe("325287_0703rinnjikai");
  });

  it("定例会の複数 PDF を同じ h2 見出しに紐づける", () => {
    const html = `
      <h2>令和7年第2回(6月)定例会会議録</h2>
      <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/syoniti00702.pdf">
        第1日(初日) (PDFファイル: 100KB)
      </a>
      <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/ippann0702.pdf">
        第5日(一般質問) (PDFファイル: 200KB)
      </a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("令和7年第2回(6月)定例会会議録");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.okinoshima.shimane.jp/material/files/group/3/syoniti00702.pdf",
    );
    expect(meetings[0]!.category).toBe("plenary");
    expect(meetings[0]!.heldOn).toBeNull();

    expect(meetings[1]!.title).toBe("令和7年第2回(6月)定例会会議録");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.okinoshima.shimane.jp/material/files/group/3/ippann0702.pdf",
    );
    expect(meetings[1]!.pdfKey).toBe("325287_ippann0702");
  });

  it("targetYear フィルタリングが機能する", () => {
    const html = `
      <h2>令和7年第2回(6月)定例会会議録</h2>
      <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/syoniti00702.pdf">
        第1日(初日) (PDFファイル: 100KB)
      </a>
      <h2>令和6年第4回(12月)定例会会議録</h2>
      <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/saisyuubi0604.pdf">
        最終日 (PDFファイル: 150KB)
      </a>
    `;

    const meetings2024 = parseListPage(html, 2024);

    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.title).toBe("令和6年第4回(12月)定例会会議録");
    expect(meetings2024[0]!.pdfKey).toBe("325287_saisyuubi0604");
  });

  it("targetYear なしで全年度を返す", () => {
    const html = `
      <h2>令和7年第2回(6月)定例会会議録</h2>
      <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/syoniti00702.pdf">
        第1日(初日) (PDFファイル: 100KB)
      </a>
      <h2>令和6年第4回(12月)定例会会議録</h2>
      <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/saisyuubi0604.pdf">
        最終日 (PDFファイル: 150KB)
      </a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
  });

  it("プロトコル相対 URL を https: に補完する", () => {
    const html = `
      <h2>令和7年第1回(3月)定例会会議録</h2>
      <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/saisyuubi0701.pdf">
        最終日 (PDFファイル: 120KB)
      </a>
    `;

    const meetings = parseListPage(html);

    expect(meetings[0]!.pdfUrl).toMatch(/^https:\/\//);
  });

  it("h2 の前の PDF リンクは無視する", () => {
    const html = `
      <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/orphan.pdf">
        孤立リンク
      </a>
      <h2>令和7年第1回(3月)定例会会議録</h2>
      <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/saisyuubi0701.pdf">
        最終日 (PDFファイル: 120KB)
      </a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfKey).toBe("325287_saisyuubi0701");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h2>令和7年第1回(3月)定例会会議録</h2>
      <p>準備中</p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(0);
  });
});
