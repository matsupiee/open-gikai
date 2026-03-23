import { describe, it, expect } from "vitest";
import { detectRole, parseStatements } from "./detail";

describe("detectRole", () => {
  it("教育長を検出する", () => {
    const result = detectRole("教 育 長");
    expect(result).toEqual({ role: "教育長", kind: "remark" });
  });

  it("スペースなしの教育長も検出する", () => {
    const result = detectRole("教育長");
    expect(result).toEqual({ role: "教育長", kind: "remark" });
  });

  it("議長を検出する", () => {
    const result = detectRole("議　長");
    expect(result).toEqual({ role: "議長", kind: "remark" });
  });

  it("議長（スペースなし）を検出する", () => {
    const result = detectRole("議長");
    expect(result).toEqual({ role: "議長", kind: "remark" });
  });

  it("課長を検出する", () => {
    const result = detectRole("課　長");
    expect(result).toEqual({ role: "課長", kind: "answer" });
  });

  it("主幹を検出する", () => {
    const result = detectRole("主　幹");
    expect(result).toEqual({ role: "主幹", kind: "answer" });
  });

  it("補佐を検出する", () => {
    const result = detectRole("補　佐");
    expect(result).toEqual({ role: "補佐", kind: "answer" });
  });

  it("指導主事を検出する", () => {
    const result = detectRole("指 導 主 事");
    expect(result).toEqual({ role: "指導主事", kind: "answer" });
  });

  it("係長を検出する", () => {
    const result = detectRole("係　長");
    expect(result).toEqual({ role: "係長", kind: "answer" });
  });

  it("主査を検出する", () => {
    const result = detectRole("主　査");
    expect(result).toEqual({ role: "主査", kind: "answer" });
  });

  it("番号付き委員を検出する", () => {
    const result = detectRole("3番委員");
    expect(result).toEqual({ role: "委員", kind: "question" });
  });

  it("2番委員を検出する", () => {
    const result = detectRole("2番委員");
    expect(result).toEqual({ role: "委員", kind: "question" });
  });

  it("不明な役職は null を返す", () => {
    expect(detectRole("不明な役職")).toBeNull();
  });

  it("空文字は null を返す", () => {
    expect(detectRole("")).toBeNull();
  });
});

describe("parseStatements", () => {
  it("役職 - 発言内容パターンで発言を分割する", () => {
    const text = `
５　会　　議
①　開　　会
教 育 長 - 日程的な事項及び当面の日程について報告
議　長 - 教育長委任事項の報告について質疑の有無を確認
3番委員 - 小中学校職員名簿で教員業務支援の空欄があるのはまだ決まっていないからか
主　幹 - 大谷小学校について現在も探している状況である
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(4);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("教育長");
    expect(statements[0]!.content).toBe("日程的な事項及び当面の日程について報告");

    expect(statements[1]!.kind).toBe("remark");
    expect(statements[1]!.speakerRole).toBe("議長");
    expect(statements[1]!.content).toBe("教育長委任事項の報告について質疑の有無を確認");

    expect(statements[2]!.kind).toBe("question");
    expect(statements[2]!.speakerRole).toBe("委員");
    expect(statements[2]!.content).toBe(
      "小中学校職員名簿で教員業務支援の空欄があるのはまだ決まっていないからか"
    );

    expect(statements[3]!.kind).toBe("answer");
    expect(statements[3]!.speakerRole).toBe("主幹");
    expect(statements[3]!.content).toBe("大谷小学校について現在も探している状況である");
  });

  it("speakerName は常に null", () => {
    const text = `
５　会議
教育長 - テスト発言
`;
    const statements = parseStatements(text);
    expect(statements[0]!.speakerName).toBeNull();
  });

  it("各 statement に contentHash が付与される", () => {
    const text = `
５　会議
教育長 - テスト発言
`;
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `
５　会議
教育長 - 開会。
課長 - 報告。
`;
    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(3);
    expect(statements[1]!.startOffset).toBe(4);
    expect(statements[1]!.endOffset).toBe(7);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("役職パターンが無いテキストは空配列を返す", () => {
    const text = "朝日町教育委員会4月定例会会議録\n１　日　時";
    expect(parseStatements(text).length).toBe(0);
  });

  it("複数行にわたる発言を結合する", () => {
    const text = `
５　会議
2番委員 - 学校訪問について、県町村会会長でもある町長の日程確保は難しいので
はないか。一緒に訪問することは悪いことではないが、町長日程が急に
変わったりするのでやめたほうがいいと思う
課長 - 春先の町長日程は立て込んでいる。早めに日程調整をし実施したい
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(2);
    expect(statements[0]!.content).toBe(
      "学校訪問について、県町村会会長でもある町長の日程確保は難しいのではないか。一緒に訪問することは悪いことではないが、町長日程が急に変わったりするのでやめたほうがいいと思う"
    );
    expect(statements[0]!.kind).toBe("question");
  });

  it("閉会宣言以降の内容をスキップする", () => {
    const text = `
５　会議
教育長 - テスト発言
課長より、閉会宣言
会議録署名委員　井上幸弘
`;
    const statements = parseStatements(text);
    expect(statements.length).toBe(1);
    expect(statements[0]!.speakerRole).toBe("教育長");
  });
});
