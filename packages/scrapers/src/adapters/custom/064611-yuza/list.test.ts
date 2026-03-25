import { describe, expect, it } from "vitest";
import { parseDateText, parseYearPage, parseYearPageUrls } from "./list";

describe("parseDateText", () => {
  it("全角数字の令和の日付をパースする", () => {
    expect(
      parseDateText("第583回遊佐町議会定例会（令和７年１２月２日開会）"),
    ).toBe("2025-12-02");
  });

  it("半角数字の令和の日付をパースする", () => {
    expect(
      parseDateText("第582回遊佐町議会臨時会（令和7年11月15日開会）"),
    ).toBe("2025-11-15");
  });

  it("令和元年をパースする", () => {
    expect(
      parseDateText("第550回遊佐町議会定例会（令和元年6月10日開会）"),
    ).toBe("2019-06-10");
  });

  it("平成の日付をパースする", () => {
    expect(
      parseDateText("第530回遊佐町議会定例会（平成30年3月5日開会）"),
    ).toBe("2018-03-05");
  });

  it("平成元年をパースする", () => {
    expect(
      parseDateText("定例会（平成元年4月1日開会）"),
    ).toBe("1989-04-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("資料一覧")).toBeNull();
  });
});

describe("parseYearPageUrls", () => {
  it("年度別ページの URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/ou/gikai/gikai/2022gikairoku.html">令和7年</a></li>
        <li><a href="/ou/gikai/gikai/copy3_of_2022gikairoku.html">令和8年</a></li>
        <li><a href="/ou/gikai/gikai/2021gikairoku.html">令和6年</a></li>
      </ul>
    `;

    const urls = parseYearPageUrls(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe(
      "https://www.town.yuza.yamagata.jp/ou/gikai/gikai/2022gikairoku.html",
    );
    expect(urls[1]).toBe(
      "https://www.town.yuza.yamagata.jp/ou/gikai/gikai/copy3_of_2022gikairoku.html",
    );
    expect(urls[2]).toBe(
      "https://www.town.yuza.yamagata.jp/ou/gikai/gikai/2021gikairoku.html",
    );
  });

  it("トップページ自身（pd0223162117）は除外する", () => {
    const html = `
      <a href="/ou/gikai/gikai/pd0223162117.html">会議録トップ</a>
      <a href="/ou/gikai/gikai/2022gikairoku.html">令和7年</a>
    `;

    const urls = parseYearPageUrls(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://www.town.yuza.yamagata.jp/ou/gikai/gikai/2022gikairoku.html",
    );
  });

  it("重複する URL は一度だけ返す", () => {
    const html = `
      <a href="/ou/gikai/gikai/2022gikairoku.html">令和7年</a>
      <a href="/ou/gikai/gikai/2022gikairoku.html">令和7年（再掲）</a>
    `;

    const urls = parseYearPageUrls(html);

    expect(urls).toHaveLength(1);
  });

  it("対象のパス以外のリンクは含まない", () => {
    const html = `
      <a href="/ou/gikai/index.html">議会トップ</a>
      <a href="https://example.com">外部リンク</a>
      <a href="/ou/gikai/gikai/2022gikairoku.html">令和7年</a>
    `;

    const urls = parseYearPageUrls(html);

    expect(urls).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  it("PDF リンクとメタ情報を正しく抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="/uploads/contents/archive_0000002698_00/第582回臨時会_会議録.pdf">
            第582回遊佐町議会臨時会（令和7年11月15日開会）
          </a>
        </li>
        <li>
          <a href="/uploads/contents/archive_0000002698_00/第583回定例会_会議録.pdf">
            第583回遊佐町議会定例会（令和7年12月2日開会）
          </a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.sessionName).toBe("第582回遊佐町議会臨時会");
    expect(meetings[0]!.heldOn).toBe("2025-11-15");
    expect(meetings[0]!.title).toBe(
      "第582回遊佐町議会臨時会（令和7年11月15日開会）",
    );

    expect(meetings[1]!.sessionName).toBe("第583回遊佐町議会定例会");
    expect(meetings[1]!.heldOn).toBe("2025-12-02");
  });

  it("year フィルタで対象年の会議録のみ返す", () => {
    const html = `
      <ul>
        <li>
          <a href="/uploads/contents/archive_0000002698_00/r7-teireikai.pdf">
            第583回遊佐町議会定例会（令和7年12月2日開会）
          </a>
        </li>
        <li>
          <a href="/uploads/contents/archive_0000002698_00/r6-teireikai.pdf">
            第572回遊佐町議会定例会（令和6年12月3日開会）
          </a>
        </li>
      </ul>
    `;

    const meetings2025 = parseYearPage(html, 2025);
    expect(meetings2025).toHaveLength(1);
    expect(meetings2025[0]!.heldOn).toBe("2025-12-02");

    const meetings2024 = parseYearPage(html, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-12-03");
  });

  it("日付がないリンクは year フィルタ時にスキップする", () => {
    const html = `
      <ul>
        <li>
          <a href="/uploads/contents/archive_0000002698_00/shiryo.pdf">
            参考資料
          </a>
        </li>
        <li>
          <a href="/uploads/contents/archive_0000002698_00/r7-teireikai.pdf">
            第583回遊佐町議会定例会（令和7年12月2日開会）
          </a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2025);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-12-02");
  });

  it("全角数字の日付を含むリンクテキストを解析する", () => {
    const html = `
      <ul>
        <li>
          <a href="/uploads/contents/archive_0000002698_00/r7-teireikai.pdf">
            第583回遊佐町議会定例会（令和７年１２月２日開会）
          </a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-12-02");
  });

  it("PDF URL を正しく構築する（絶対パス）", () => {
    const html = `
      <a href="/uploads/contents/archive_0000002698_00/test.pdf">
        第583回遊佐町議会定例会（令和7年12月2日開会）
      </a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.yuza.yamagata.jp/uploads/contents/archive_0000002698_00/test.pdf",
    );
  });

  it("日本語ファイル名の PDF URL を URL エンコードする", () => {
    const html = `
      <a href="/uploads/contents/archive_0000002698_00/７．１２遊佐町１号（配付用）.pdf">
        第583回遊佐町議会定例会（令和7年12月2日開会）
      </a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    // URL エンコードされていること
    expect(meetings[0]!.pdfUrl).not.toContain("遊佐町");
    expect(meetings[0]!.pdfUrl).toContain(
      "https://www.town.yuza.yamagata.jp/uploads/contents/archive_0000002698_00/",
    );
  });

  it("year フィルタなし時は日付がなくても返す", () => {
    const html = `
      <ul>
        <li>
          <a href="/uploads/contents/archive_0000002698_00/shiryo.pdf">
            参考資料
          </a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBeNull();
  });
});
