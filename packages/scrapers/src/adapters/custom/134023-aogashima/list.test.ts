import { describe, expect, it } from "vitest";
import { parsePressList } from "./list";

describe("parsePressList", () => {
  it("PDF リンクを正しく抽出する", () => {
    const html = `
      <ul>
        <li><a href="koho2501.pdf">広報あおがしま　No.414（2.28MB）</a></li>
        <li><a href="koho2502.pdf">広報あおがしま　No.415（1.95MB）</a></li>
        <li><a href="koho2503.pdf">広報あおがしま　No.416（2.10MB）</a></li>
      </ul>
    `;

    const results = parsePressList(html);

    expect(results).toHaveLength(3);
    expect(results[0]!.pdfUrl).toBe(
      "https://www.vill.aogashima.tokyo.jp/press/koho2501.pdf"
    );
    expect(results[0]!.filename).toBe("koho2501.pdf");
    expect(results[0]!.yearMonth).toBe("2025-01");
    expect(results[1]!.yearMonth).toBe("2025-02");
    expect(results[2]!.yearMonth).toBe("2025-03");
  });

  it("2006年の PDF も正しくパースする", () => {
    const html = `
      <ul>
        <li><a href="koho0604.pdf">広報あおがしま（1.50MB）</a></li>
      </ul>
    `;

    const results = parsePressList(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.yearMonth).toBe("2006-04");
    expect(results[0]!.filename).toBe("koho0604.pdf");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<ul><li>データがありません</li></ul>`;

    const results = parsePressList(html);
    expect(results).toHaveLength(0);
  });

  it("koho 以外のリンクは無視する", () => {
    const html = `
      <ul>
        <li><a href="koho2501.pdf">広報あおがしま（2.28MB）</a></li>
        <li><a href="other.pdf">その他（1.00MB）</a></li>
      </ul>
    `;

    const results = parsePressList(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.filename).toBe("koho2501.pdf");
  });
});
