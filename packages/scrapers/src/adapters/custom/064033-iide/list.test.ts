import { describe, expect, it } from "vitest";
import { parseDateText, parseListPage } from "./list";

describe("parseDateText", () => {
  it("全角数字の令和の日付をパースする", () => {
    expect(
      parseDateText("一般質問（令和７年６月５日）"),
    ).toBe("2025-06-05");
  });

  it("半角数字の令和の日付をパースする", () => {
    expect(
      parseDateText("一般質問（令和6年12月5日）"),
    ).toBe("2024-12-05");
  });

  it("令和元年をパースする", () => {
    expect(
      parseDateText("議案審議（令和元年6月10日）"),
    ).toBe("2019-06-10");
  });

  it("平成の日付をパースする", () => {
    expect(
      parseDateText("一般質問（平成30年3月5日）"),
    ).toBe("2018-03-05");
  });

  it("平成元年をパースする", () => {
    expect(
      parseDateText("会議録（平成元年4月1日）"),
    ).toBe("1989-04-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("資料一覧")).toBeNull();
  });
});

describe("parseListPage", () => {
  const BASE_URL = "https://www.town.iide.yamagata.jp/004/R40210.html";

  it("見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <p><strong>【令和７年第３回定例会】</strong></p>
      <ul>
        <li><a href="./0605.pdf">一般質問（令和７年６月５日）<img src="../_wcv/images/icon/pdf.gif">(732KB)</a></li>
        <li><a href="./0610.pdf">議案審議（令和７年６月10日）<img src="../_wcv/images/icon/pdf.gif">(494KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, BASE_URL);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.sessionName).toBe("令和７年第３回定例会");
    expect(meetings[0]!.heldOn).toBe("2025-06-05");
    expect(meetings[0]!.title).toBe(
      "令和７年第３回定例会 一般質問（令和７年６月５日）",
    );
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.iide.yamagata.jp/004/0605.pdf",
    );

    expect(meetings[1]!.sessionName).toBe("令和７年第３回定例会");
    expect(meetings[1]!.heldOn).toBe("2025-06-10");
  });

  it("臨時会セクションも正しく抽出する", () => {
    const html = `
      <p><strong>【令和７年第４回臨時会】</strong></p>
      <ul>
        <li><a href="./0805.pdf">令和７年第４回臨時会（令和７年８月５日）<img src="../_wcv/images/icon/pdf.gif">(219KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, BASE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.sessionName).toBe("令和７年第４回臨時会");
    expect(meetings[0]!.heldOn).toBe("2025-08-05");
  });

  it("複数年度のセクションを正しく分離する", () => {
    const html = `
      <p><strong>【令和７年第１回定例会】</strong></p>
      <ul>
        <li><a href="./0304ippannsitumonn.pdf">一般質問（令和７年３月４日）(683KB)</a></li>
      </ul>
      <hr>
      <p><strong>【令和６年第６回定例会】</strong></p>
      <ul>
        <li><a href="./1205ippannsitumonn.pdf">一般質問（令和６年12月５日）(841KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, BASE_URL);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.sessionName).toBe("令和７年第１回定例会");
    expect(meetings[0]!.heldOn).toBe("2025-03-04");
    expect(meetings[1]!.sessionName).toBe("令和６年第６回定例会");
    expect(meetings[1]!.heldOn).toBe("2024-12-05");
  });

  it("year フィルタで対象年の会議録のみ返す", () => {
    const html = `
      <p><strong>【令和７年第１回定例会】</strong></p>
      <ul>
        <li><a href="./0304ippannsitumonn.pdf">一般質問（令和７年３月４日）(683KB)</a></li>
      </ul>
      <p><strong>【令和６年第６回定例会】</strong></p>
      <ul>
        <li><a href="./1205ippannsitumonn.pdf">一般質問（令和６年12月５日）(841KB)</a></li>
      </ul>
    `;

    const meetings2025 = parseListPage(html, BASE_URL, 2025);
    expect(meetings2025).toHaveLength(1);
    expect(meetings2025[0]!.heldOn).toBe("2025-03-04");

    const meetings2024 = parseListPage(html, BASE_URL, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-12-05");
  });

  it("日付を含まないリンクはスキップする", () => {
    const html = `
      <p><strong>【令和７年第３回定例会】</strong></p>
      <ul>
        <li><a href="./0605.pdf">一般質問（令和７年６月５日）(732KB)</a></li>
        <li><a href="./some-doc.pdf">資料一覧</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, BASE_URL);
    expect(meetings).toHaveLength(1);
  });

  it("YYYYMMDD 形式のファイル名にも対応する", () => {
    const html = `
      <p><strong>【令和６年第３回定例会】</strong></p>
      <ul>
        <li><a href="./20240613.pdf">一般質問（令和６年６月13日）(800KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, BASE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.iide.yamagata.jp/004/20240613.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2024-06-13");
  });

  it("ファイルサイズ表記を title から除去する", () => {
    const html = `
      <p><strong>【令和７年第３回定例会】</strong></p>
      <ul>
        <li><a href="./0605.pdf">一般質問（令和７年６月５日）(732KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, BASE_URL);
    expect(meetings[0]!.title).not.toContain("732KB");
  });
});
