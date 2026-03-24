import { describe, it, expect } from "vitest";
import { parseYearCategories, parseContentIds, parseContentPage } from "./list";

describe("parseYearCategories", () => {
  it("定例会の年度別カテゴリを抽出する", () => {
    const html = `
      <ul>
        <li><a href="./?category=233">令和7年</a></li>
        <li><a href="./?category=208">令和6年</a></li>
        <li><a href="./?category=196">令和5年</a></li>
        <li><a href="./?category=168">令和4年</a></li>
      </ul>
    `;

    const result = parseYearCategories(html);

    expect(result).toHaveLength(4);
    expect(result[0]!.categoryId).toBe("233");
    expect(result[0]!.yearLabel).toBe("令和7年");
    expect(result[1]!.categoryId).toBe("208");
    expect(result[1]!.yearLabel).toBe("令和6年");
  });

  it("令和元年を含む場合も抽出する", () => {
    const html = `
      <ul>
        <li><a href="./?category=165">令和元年</a></li>
        <li><a href="./?category=164">平成30年</a></li>
      </ul>
    `;

    const result = parseYearCategories(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.categoryId).toBe("165");
    expect(result[0]!.yearLabel).toBe("令和元年");
    expect(result[1]!.categoryId).toBe("164");
    expect(result[1]!.yearLabel).toBe("平成30年");
  });

  it("年度でないカテゴリリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="./?category=124">定例会</a></li>
        <li><a href="./?category=208">令和6年</a></li>
        <li><a href="./?category=125">臨時会</a></li>
      </ul>
    `;

    const result = parseYearCategories(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.categoryId).toBe("208");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseYearCategories("")).toEqual([]);
  });
});

describe("parseContentIds", () => {
  it("content リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="./?content=3509">令和6年第4回紋別市議会定例会</a></li>
        <li><a href="./?content=3304">令和6年第3回紋別市議会定例会</a></li>
        <li><a href="./?content=3050">令和6年第2回紋別市議会定例会</a></li>
        <li><a href="./?content=2669">令和6年第1回紋別市議会定例会</a></li>
      </ul>
    `;

    const result = parseContentIds(html);

    expect(result).toHaveLength(4);
    expect(result[0]!.contentId).toBe("3509");
    expect(result[0]!.label).toBe("令和6年第4回紋別市議会定例会");
    expect(result[1]!.contentId).toBe("3304");
  });

  it("ラベルが空のリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="./?content=3509">令和6年第4回定例会</a></li>
        <li><a href="./?content=9999"></a></li>
      </ul>
    `;

    const result = parseContentIds(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.contentId).toBe("3509");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseContentIds("")).toEqual([]);
  });
});

describe("parseContentPage", () => {
  it("content ページから PDF リンクと開催日を抽出する", () => {
    const html = `
      <h1>令和6年第4回紋別市議会定例会</h1>
      <ul>
        <li>12月3日 <a href="../../assets/images/content/content_20250221_135713.pdf">会議録</a></li>
        <li>12月9日 <a href="../../assets/images/content/content_20250221_135727.pdf">会議録</a></li>
      </ul>
    `;

    const result = parseContentPage(html, "定例会", "https://mombetsu.jp/gikai/minutes/?content=3509");

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://mombetsu.jp/assets/images/content/content_20250221_135713.pdf",
    );
    expect(result[0]!.heldOn).toBe("2024-12-03");
    expect(result[0]!.title).toBe("令和6年第4回紋別市議会定例会 12月3日");
    expect(result[0]!.meetingTypeLabel).toBe("定例会");

    expect(result[1]!.pdfUrl).toBe(
      "https://mombetsu.jp/assets/images/content/content_20250221_135727.pdf",
    );
    expect(result[1]!.heldOn).toBe("2024-12-09");
  });

  it("令和元年の会議を正しく処理する", () => {
    const html = `
      <h1>令和元年第1回紋別市議会定例会</h1>
      <ul>
        <li>3月5日 <a href="../../assets/images/content/content_20190305_100000.pdf">会議録</a></li>
      </ul>
    `;

    const result = parseContentPage(html, "定例会", "https://mombetsu.jp/gikai/minutes/?content=999");

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2019-03-05");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h1>令和6年第4回紋別市議会定例会</h1>
      <p>内容なし</p>
    `;

    const result = parseContentPage(html, "定例会", "https://mombetsu.jp/gikai/minutes/?content=3509");

    expect(result).toEqual([]);
  });

  it("会議名が取得できない場合はリンクテキストをタイトルとして使用する", () => {
    const html = `
      <ul>
        <li><a href="../../assets/images/content/content_20250221_135713.pdf">12月3日会議録</a></li>
      </ul>
    `;

    const result = parseContentPage(html, "定例会", "https://mombetsu.jp/gikai/minutes/?content=3509");

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("12月3日会議録");
  });

  it("開催日が取得できない場合は heldOn が null になる", () => {
    const html = `
      <h1>令和6年第4回紋別市議会定例会</h1>
      <ul>
        <li><a href="../../assets/images/content/content_20241202_174517.pdf">一般質問通告書</a></li>
      </ul>
    `;

    const result = parseContentPage(html, "定例会", "https://mombetsu.jp/gikai/minutes/?content=3509");

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBeNull();
  });

  it("複数の開催日が含まれる場合を正しく処理する", () => {
    const html = `
      <h1>令和6年第3回紋別市議会定例会</h1>
      <ul>
        <li>8月27日 <a href="../../assets/images/content/content_20241121_103440.pdf">会議録</a></li>
        <li>9月2日 <a href="../../assets/images/content/content_20241121_103552.pdf">会議録</a></li>
        <li>9月3日 <a href="../../assets/images/content/content_20241121_103641.pdf">会議録</a></li>
        <li>9月5日 <a href="../../assets/images/content/content_20241121_103707.pdf">会議録</a></li>
        <li>9月10日 <a href="../../assets/images/content/content_20241121_103721.pdf">会議録</a></li>
      </ul>
    `;

    const result = parseContentPage(html, "定例会", "https://mombetsu.jp/gikai/minutes/?content=3304");

    expect(result).toHaveLength(5);
    expect(result[0]!.heldOn).toBe("2024-08-27");
    expect(result[1]!.heldOn).toBe("2024-09-02");
    expect(result[2]!.heldOn).toBe("2024-09-03");
    expect(result[3]!.heldOn).toBe("2024-09-05");
    expect(result[4]!.heldOn).toBe("2024-09-10");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseContentPage("", "定例会", "https://mombetsu.jp/gikai/minutes/?content=1")).toEqual([]);
  });
});
