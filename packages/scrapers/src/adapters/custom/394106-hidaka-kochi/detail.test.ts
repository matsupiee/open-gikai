import { describe, expect, it } from "vitest";
import { parseStatements } from "./detail";

describe("parseStatements", () => {
  it("質問と答弁のブロックを抽出する", () => {
    const text = `
西村玲子議員
質問 災害で心に傷を負った子どもたちにキッズスペースの設置を。
答弁 谷脇総務課参事
昨年12月、内閣府が改訂した避難所における良好な生活環境の確保に向けた取り組みの中に、
キッズスペース、学習のためのスペースの確保がある。
質問 病気やけがなどで意思表示ができなくなった時に終末期等、本人の希望を実現する目的として
終活情報の事前登録制度はできないか。
答弁 藤岡健康福祉課長
他市の取り組みを参考に、村の実情に応じた方法を研究する。
`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(4);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("西村玲子");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.content).toContain("キッズスペース");

    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBeNull();
    expect(statements[1]!.speakerRole).toBe("総務課参事");
    expect(statements[1]!.content).toContain("学習のためのスペース");

    expect(statements[2]!.kind).toBe("question");
    expect(statements[2]!.speakerName).toBe("西村玲子");
    expect(statements[2]!.content).toContain("終活情報");

    expect(statements[3]!.kind).toBe("answer");
    expect(statements[3]!.speakerRole).toBe("健康福祉課長");
  });

  it("ノイズ行を除外して statement を組み立てる", () => {
    const text = `
第１98号
日高村議会だより
森下芳文議員
質問 スーパー再開の見込みを聞く。
答弁 松岡村長
同業他社も訪問し、可能性は積極的に探っていきたい。
（15） 令和7年4月30日
`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerName).toBe("森下芳文");
    expect(statements[1]!.speakerRole).toBe("村長");
    expect(statements[1]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("質問者名がなくても質問 statement を残す", () => {
    const text = `
質問 指定避難所における災害用井戸の設置可能箇所と今後の計画は。
答弁 谷脇総務課参事
財政状況を見ながら計画的な設置を検討する。
`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[1]!.speakerRole).toBe("総務課参事");
  });
});
