import { describe, expect, it } from "vitest";
import { parsePdfLinksForYear } from "./list";
import { parseWarekiYear, toHalfWidth } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年第1回")).toBe(2025);
    expect(parseWarekiYear("令和2年第3回")).toBe(2020);
    expect(parseWarekiYear("令和6年")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第2回")).toBe(2018);
    expect(parseWarekiYear("平成23年")).toBe(2011);
  });

  it("平成元年を変換する", () => {
    expect(parseWarekiYear("平成元年")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("令和７年")).toBe("令和7年");
    expect(toHalfWidth("第１０回")).toBe("第10回");
    expect(toHalfWidth("１日目")).toBe("1日目");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("令和7年")).toBe("令和7年");
  });
});

describe("parsePdfLinksForYear", () => {
  it("臨時会の PDF リンクを抽出する", () => {
    const html = `
      <h2>令和６年に開催された定例会・臨時会の会議録</h2>
      <ul>
        <li><a href="https://www.town.saka.lg.jp/wp-content/uploads/2017/05/令和6年坂町議会第1回臨時会.pdf">令和６年坂町議会第１回臨時会</a></li>
      </ul>
    `;

    const result = parsePdfLinksForYear(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和６年坂町議会第１回臨時会");
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBeNull();
  });

  it("定例会の複数日 PDF リンクを抽出する", () => {
    const html = `
      <h2>令和６年に開催された定例会・臨時会の会議録</h2>
      <ul>
        <li>令和６年坂町議会第９回定例会（<a href="https://www.town.saka.lg.jp/wp-content/uploads/2024/06/1日目.pdf">１日目</a>/<a href="https://www.town.saka.lg.jp/wp-content/uploads/2024/06/2日目.pdf">２日目</a>）</li>
      </ul>
    `;

    const result = parsePdfLinksForYear(html, 2024);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.saka.lg.jp/wp-content/uploads/2024/06/1日目.pdf",
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[1]!.pdfUrl).toBe(
      "https://www.town.saka.lg.jp/wp-content/uploads/2024/06/2日目.pdf",
    );
    expect(result[1]!.meetingType).toBe("plenary");
  });

  it("対象年度以外はスキップする", () => {
    const html = `
      <h2>令和７年に開催された定例会・臨時会の会議録</h2>
      <ul>
        <li><a href="https://www.town.saka.lg.jp/wp-content/uploads/2017/05/令和7年坂町議会第1回臨時会.pdf">令和７年坂町議会第１回臨時会</a></li>
      </ul>
      <h2>令和６年に開催された定例会・臨時会の会議録</h2>
      <ul>
        <li><a href="https://www.town.saka.lg.jp/wp-content/uploads/2024/06/1日目.pdf">１日目</a></li>
      </ul>
    `;

    const result2025 = parsePdfLinksForYear(html, 2025);
    expect(result2025).toHaveLength(1);

    const result2024 = parsePdfLinksForYear(html, 2024);
    expect(result2024).toHaveLength(1);
  });

  it("h3 見出し（過去分）の年度を処理する", () => {
    const html = `
      <h2>過去の会議はこちら</h2>
      <h3>【令和元年】</h3>
      <ul>
        <li><a href="https://www.town.saka.lg.jp/wp-content/uploads/2000/sites/03/files/cyousei_info/gikai/images/r0106.pdf">令和元年坂町議会第６回定例会</a></li>
      </ul>
    `;

    const result = parsePdfLinksForYear(html, 2019);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h2>令和６年に開催された定例会・臨時会の会議録</h2>
      <p>現在準備中です</p>
    `;

    expect(parsePdfLinksForYear(html, 2024)).toEqual([]);
  });

  it("対象年度の見出しがない場合は空配列を返す", () => {
    const html = `
      <h2>令和７年に開催された定例会・臨時会の会議録</h2>
      <ul>
        <li><a href="https://example.com/test.pdf">令和７年坂町議会第１回定例会</a></li>
      </ul>
    `;

    expect(parsePdfLinksForYear(html, 2024)).toEqual([]);
  });

  it("相対 URL を絶対 URL に変換する", () => {
    const html = `
      <h2>令和６年に開催された定例会・臨時会の会議録</h2>
      <ul>
        <li><a href="/wp-content/uploads/2024/06/test.pdf">令和６年坂町議会第１回定例会</a></li>
      </ul>
    `;

    const result = parsePdfLinksForYear(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.saka.lg.jp/wp-content/uploads/2024/06/test.pdf",
    );
  });
});
