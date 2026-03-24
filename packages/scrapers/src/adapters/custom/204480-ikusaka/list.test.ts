import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import { detectMeetingType, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和元年")).toBe(2019);
    expect(parseWarekiYear("令和6年")).toBe(2024);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成31年")).toBe(2019);
    expect(parseWarekiYear("平成元年")).toBe(1989);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("定例会")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("6月定例会")).toBe("plenary");
    expect(detectMeetingType("3月定例会")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("1月臨時会")).toBe("extraordinary");
    expect(detectMeetingType("8月臨時会")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseListPage", () => {
  it("新形式（令和3年〜）の strong + ul 構造から PDF リンクを抽出する", () => {
    const html = `
      <h3>令和7年</h3>
      <strong>6月定例会</strong>
      <ul>
        <li>
          <img src="images/pdf_icon.png" class="icon">
          <a href="gijiroku/teireikai07.06.pdf" target="_blank"> 会議録</a>
        </li>
      </ul>
      <strong>3月定例会</strong>
      <ul>
        <li>
          <a href="gijiroku/teireikai07.03.pdf" target="_blank"> 会議録</a>
        </li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和7年6月定例会");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.village.ikusaka.nagano.jp/gikai/gijiroku/teireikai07.06.pdf",
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.year).toBe(2025);
    expect(result[1]!.title).toBe("令和7年3月定例会");
    expect(result[1]!.year).toBe(2025);
  });

  it("新形式で YouTube リンクなど gijiroku/ を含まないリンクは除外する", () => {
    const html = `
      <h3>令和7年</h3>
      <strong>6月定例会</strong>
      <ul>
        <li>
          <a href="gijiroku/teireikai07.06.pdf" target="_blank"> 会議録</a>
        </li>
        <li>
          <a href="https://youtu.be/abc123" target="_blank">一般質問動画</a>
        </li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain(".pdf");
  });

  it("旧形式（令和2年以前）のフラット a タグ構造から PDF リンクを抽出する", () => {
    const html = `
      <h3>令和2年</h3>
      <a href="gijiroku/teireikai02.01.pdf" target="_blank">1月臨時会</a>
      <a href="gijiroku/teireikai02.03.pdf" target="_blank">3月定例会</a>
      <a href="gijiroku/teireikai02.06.pdf" target="_blank">6月定例会</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("令和2年1月臨時会");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.village.ikusaka.nagano.jp/gikai/gijiroku/teireikai02.01.pdf",
    );
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.year).toBe(2020);
    expect(result[1]!.title).toBe("令和2年3月定例会");
    expect(result[1]!.meetingType).toBe("plenary");
    expect(result[2]!.title).toBe("令和2年6月定例会");
  });

  it("平成の年度も正しくパースする（旧形式）", () => {
    const html = `
      <h3>平成31年</h3>
      <a href="gijiroku/teireikai31.3.pdf" target="_blank">3月定例会</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("平成31年3月定例会");
    expect(result[0]!.year).toBe(2019);
  });

  it("全角数字の年度を正規化してパースする", () => {
    const html = `
      <h3>令和６年</h3>
      <strong>12月定例会</strong>
      <ul>
        <li><a href="gijiroku/teireikai06.12.pdf" target="_blank">会議録</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年12月定例会");
    expect(result[0]!.year).toBe(2024);
  });

  it("複数の年度セクションをそれぞれ正しくパースする", () => {
    const html = `
      <h3>令和7年</h3>
      <strong>6月定例会</strong>
      <ul><li><a href="gijiroku/teireikai07.06.pdf">会議録</a></li></ul>
      <h3>令和6年</h3>
      <strong>12月定例会</strong>
      <ul><li><a href="gijiroku/teireikai06.12.pdf">会議録</a></li></ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2025);
    expect(result[1]!.year).toBe(2024);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<h3>令和7年</h3><p>会議録なし</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("年度情報がない h3 はスキップする", () => {
    const html = `
      <h3>その他情報</h3>
      <a href="gijiroku/teireikai07.06.pdf">会議録</a>
    `;

    expect(parseListPage(html)).toEqual([]);
  });

  it("ドットが2つあるファイル名（誤記）も収集する", () => {
    const html = `
      <h3>令和６年</h3>
      <strong>9月定例会</strong>
      <ul>
        <li><a href="gijiroku/teireikai06..09.pdf" target="_blank">会議録</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.village.ikusaka.nagano.jp/gikai/gijiroku/teireikai06..09.pdf",
    );
  });
});
