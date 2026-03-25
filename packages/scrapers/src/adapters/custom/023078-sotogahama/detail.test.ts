import { describe, expect, it } from "vitest";
import { parseStatements } from "./detail";

describe("parseStatements", () => {
  it("テキストを段落に分割して ParsedStatement 配列を返す", () => {
    const text = `外ヶ浜町議会だより第83号

令和8年2月発行

今回の定例会では、令和8年度の予算案について審議が行われました。

一般会計予算は総額30億円となり、前年度比2%増となっています。`;

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBeNull();
  });

  it("10 文字未満の段落はスキップされる", () => {
    const text = `短い

外ヶ浜町議会では令和8年度予算案について審議が行われ、様々な議案が提出されました。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toContain("外ヶ浜町議会では");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = `外ヶ浜町議会だより第83号の内容がここに記載されています。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が連続して計算される", () => {
    const text = `外ヶ浜町議会では令和8年度予算案について審議が行われました。

一般会計予算は総額30億円となり、前年度比2%増となっています。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(statements[0]!.content.length);
    expect(statements[1]!.startOffset).toBe(statements[0]!.endOffset + 1);
  });

  it("空のテキストでは空配列を返す", () => {
    const statements = parseStatements("");
    expect(statements).toHaveLength(0);
  });

  it("空白のみのテキストでは空配列を返す", () => {
    const statements = parseStatements("   \n\n   ");
    expect(statements).toHaveLength(0);
  });

  it("複数の空行で正しく段落分割される", () => {
    const text = `第一段落の内容が記載されています。外ヶ浜町の最新情報をお届けします。


第二段落の内容が記載されています。議会活動の詳細をお伝えします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("第一段落");
    expect(statements[1]!.content).toContain("第二段落");
  });

  it("各 statement の content が空でない", () => {
    const text = `外ヶ浜町議会では令和8年度の一般会計補正予算が審議されました。

委員会審査では賛成多数で可決されました。予算案の詳細については別途配布の資料を参照ください。`;

    const statements = parseStatements(text);

    for (const stmt of statements) {
      expect(stmt.content.length).toBeGreaterThan(0);
    }
  });

  it("CRLF 改行も正しく処理する", () => {
    const text =
      "外ヶ浜町議会では予算案について審議しました。\r\n\r\n賛成多数で可決されました。詳細は次号をご覧ください。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
  });
});
