import { describe, expect, it } from "vitest";
import { extractRemarkLines, parseStatements } from "./detail";

describe("extractRemarkLines", () => {
  it("長い空白で区切られた 2 段組の行を分離する", () => {
    const text = `東みよし町議会だより
第7号
横関秋義議員            長谷川吉正議員
黒川原谷川の浚渫工事を            町内の橋梁の安全確認は
建設課長
西部県民局に要望する
`;

    expect(extractRemarkLines(text)).toEqual([
      "黒川原谷川の浚渫工事を",
      "町内の橋梁の安全確認は",
      "西部県民局に要望する",
    ]);
  });

  it("短いノイズやページ見出しを除外する", () => {
    const text = `ふるさと東みよし町
元気・交流・未来へ
一般質問
2025
東みよし町まつりと町民運動会の今後は
`;

    expect(extractRemarkLines(text)).toEqual([
      "東みよし町まつりと町民運動会の今後は",
    ]);
  });
});

describe("parseStatements", () => {
  it("remark statements を連続した offset で返す", () => {
    const text = `黒川原谷川の浚渫工事を
西部県民局に要望する
東みよし町まつりと町民運動会の今後は
`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBeNull();
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[1]!.startOffset).toBe(statements[0]!.endOffset + 1);
    expect(statements[2]!.startOffset).toBe(statements[1]!.endOffset + 1);
  });

  it("抽出できる行がない場合は空配列を返す", () => {
    expect(parseStatements("東みよし町議会だより\n第7号\n一般質問\n")).toEqual(
      [],
    );
  });
});
