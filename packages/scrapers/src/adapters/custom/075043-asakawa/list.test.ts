import { describe, expect, it } from "vitest";
import { parseDateText, parseListPage } from "./list";

describe("parseDateText", () => {
  it("見出しの和暦年とリンクの月日から日付を組み立てる", () => {
    expect(
      parseDateText("令和7年第2回定例会会議録", "1号(3月 4日)"),
    ).toBe("2025-03-04");
  });

  it("全角数字の見出しにも対応する", () => {
    expect(parseDateText("令和７年第１回臨時会", "1号(1月29日)")).toBe(
      "2025-01-29",
    );
  });

  it("令和元年をパースする", () => {
    expect(parseDateText("令和元年第1回定例会", "1号(5月1日)")).toBe(
      "2019-05-01",
    );
  });

  it("平成元年をパースする", () => {
    expect(parseDateText("平成元年第2回臨時会", "1号(4月1日)")).toBe(
      "1989-04-01",
    );
  });

  it("月日がないリンクは null を返す", () => {
    expect(parseDateText("令和7年第2回定例会", "目次")).toBeNull();
  });
});

describe("parseListPage", () => {
  const BASE_URL = "https://www.town.asakawa.fukushima.jp/gikai/kiroku/";

  it("見出しごとに PDF リンクを抽出する", () => {
    const html = `
      <div class="gikai-kiroku__item">
        <h3 class="gikai-kiroku__ttl">令和7年第2回定例会会議録</h3>
        <ul class="gikai-kiroku__list">
          <li><a href="https://www.town.asakawa.fukushima.jp/gikai/uploads/2025/06/R07.3mokuji.pdf" class="gikai-kiroku__link">目次</a></li>
          <li><a href="https://www.town.asakawa.fukushima.jp/gikai/uploads/2025/06/R07.3.01.pdf" class="gikai-kiroku__link">1号(3月 4日)</a></li>
          <li><a href="https://www.town.asakawa.fukushima.jp/gikai/uploads/2025/06/R07.3.02.pdf" class="gikai-kiroku__link">2号(3月 5日)</a></li>
        </ul>
      </div>
    `;

    const meetings = parseListPage(html, BASE_URL);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.sessionName).toBe("令和7年第2回定例会会議録");
    expect(meetings[0]!.heldOn).toBe("2025-03-04");
    expect(meetings[0]!.title).toBe("令和7年第2回定例会会議録 1号(3月 4日)");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.asakawa.fukushima.jp/gikai/uploads/2025/06/R07.3.01.pdf",
    );
  });

  it("プルダウン見出しも抽出する", () => {
    const html = `
      <div class="gikai-kiroku__item">
        <h3 class="pulldown-btn js-pulldown-btn" tabindex="0">令和７年第１回臨時会</h3>
        <div class="js-pulldown-content">
          <ul class="gikai-kiroku__list">
            <li><a href="/gikai/uploads/2025/05/R7_1.pdf" class="gikai-kiroku__link">1号(1月29日)</a></li>
          </ul>
        </div>
      </div>
    `;

    const meetings = parseListPage(html, BASE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.sessionName).toBe("令和７年第１回臨時会");
    expect(meetings[0]!.heldOn).toBe("2025-01-29");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.asakawa.fukushima.jp/gikai/uploads/2025/05/R7_1.pdf",
    );
  });

  it("year フィルタで対象年の会議録だけを返す", () => {
    const html = `
      <div class="gikai-kiroku__item">
        <h3 class="gikai-kiroku__ttl">令和7年第2回定例会会議録</h3>
        <ul class="gikai-kiroku__list">
          <li><a href="https://www.town.asakawa.fukushima.jp/gikai/uploads/2025/06/R07.3.01.pdf" class="gikai-kiroku__link">1号(3月 4日)</a></li>
        </ul>
      </div>
      <div class="gikai-kiroku__item">
        <h3 class="pulldown-btn js-pulldown-btn" tabindex="0">令和6年第4回定例会</h3>
        <div class="js-pulldown-content">
          <ul class="gikai-kiroku__list">
            <li><a href="https://www.town.asakawa.fukushima.jp/gikai/uploads/2025/04/R6%204%201.pdf" class="gikai-kiroku__link">1号(12月 5日)</a></li>
          </ul>
        </div>
      </div>
    `;

    const meetings2025 = parseListPage(html, BASE_URL, 2025);
    expect(meetings2025).toHaveLength(1);
    expect(meetings2025[0]!.heldOn).toBe("2025-03-04");

    const meetings2024 = parseListPage(html, BASE_URL, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-12-05");
  });

  it("月日を含まない PDF リンクはスキップする", () => {
    const html = `
      <div class="gikai-kiroku__item">
        <h3 class="gikai-kiroku__ttl">令和7年第2回定例会会議録</h3>
        <ul class="gikai-kiroku__list">
          <li><a href="https://www.town.asakawa.fukushima.jp/gikai/uploads/2025/06/R07.3mokuji.pdf" class="gikai-kiroku__link">目次</a></li>
        </ul>
      </div>
    `;

    expect(parseListPage(html, BASE_URL)).toEqual([]);
  });
});
