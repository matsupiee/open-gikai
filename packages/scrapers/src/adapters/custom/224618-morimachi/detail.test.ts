import { describe, it, expect } from "vitest";
import {
  buildNameRoleMap,
  extractRoleFromPreceding,
  classifyKind,
  parseStatements,
} from "./detail";

describe("buildNameRoleMap", () => {
  it("メンバーリストから名前→役職のマッピングを構築する", () => {
    const text = `
      町 長 太 田 康 雄
      副 町 長 村 松 弘
      教 育 長 野 口 和 英
    `;
    const map = buildNameRoleMap(text);

    expect(map.get("太田康雄")).toBe("町長");
    expect(map.get("村松弘")).toBe("副町長");
    expect(map.get("野口和英")).toBe("教育長");
  });

  it("役職アナウンス「役職、名前君」形式もマッピングする", () => {
    const text = "町長、太田康雄君。ただいまより説明します。";
    const map = buildNameRoleMap(text);

    expect(map.get("太田康雄")).toBe("町長");
  });
});

describe("extractRoleFromPreceding", () => {
  it("役職アナウンスから役職を取得する", () => {
    const preceding = "本案について提案理由の説明を求めます。 町長、太田康雄君。 ";
    const map = new Map([["太田康雄", "町長"]]);

    expect(extractRoleFromPreceding(preceding, map, "太田康雄")).toBe("町長");
  });

  it("スペース区切りの役職ラベルから役職を取得する", () => {
    const preceding =
      "静岡地方税滞納整理機構規約の変更について - 3 - ＜議事の経過＞ 議 長 議 長 議 長 ";
    const map = new Map<string, string>();

    expect(extractRoleFromPreceding(preceding, map, "𠮷筋惠治")).toBe("議長");
  });

  it("名前マップから役職を取得する", () => {
    const preceding = "御異議ありませんか。 （ 「異議なし」と言う者多数 ） ";
    const map = new Map([["𠮷筋惠治", "議長"]]);

    expect(extractRoleFromPreceding(preceding, map, "𠮷筋惠治")).toBe("議長");
  });

  it("手がかりがない場合は null を返す", () => {
    const preceding = "御異議ありませんか。 （ 「異議なし」と言う者多数 ） ";
    const map = new Map<string, string>();

    expect(extractRoleFromPreceding(preceding, map, "佐藤花子")).toBeNull();
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("（ NAME 君 ）パターンで発言を分割する", () => {
    const text = `
＜議事の経過＞ 議 長
（ 𠮷 筋 惠 治 君 ）ただいまから本日の会議を開きます。
町長、太田康雄君。
（ 太 田 康 雄 君 ）お答えいたします。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(2);

    expect(statements[0]!.speakerName).toBe("𠮷筋惠治");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toContain("ただいまから本日の会議を開きます");

    expect(statements[1]!.speakerName).toBe("太田康雄");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.content).toContain("お答えいたします");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = `
      町 長 太 田 康 雄
      町長、太田康雄君。
      （ 太 田 康 雄 君 ）テスト発言。
    `;
    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("職員朗読はスキップされる", () => {
    const text = `
      町 長 太 田 康 雄
      （ 職 員 朗 読 ）
      町長、太田康雄君。
      （ 太 田 康 雄 君 ）提案理由の説明を申し上げます。
    `;
    const statements = parseStatements(text);

    // 職員朗読はスキップされ、太田康雄の発言のみ
    for (const s of statements) {
      expect(s.speakerName).not.toBe("職員朗読");
    }
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("メンバーリストから名前→役職のマッピングが正しく機能する", () => {
    const text = `
      議 長 山 田 太 郎
      町 長 鈴 木 次 郎
      議 長
      （ 山 田 太 郎 君 ）会議を開きます。
      町長、鈴木次郎君。
      （ 鈴 木 次 郎 君 ）ご説明します。
    `;
    const statements = parseStatements(text);

    const chairStatement = statements.find((s) => s.speakerName === "山田太郎");
    const mayorStatement = statements.find((s) => s.speakerName === "鈴木次郎");

    expect(chairStatement?.speakerRole).toBe("議長");
    expect(chairStatement?.kind).toBe("remark");
    expect(mayorStatement?.speakerRole).toBe("町長");
    expect(mayorStatement?.kind).toBe("answer");
  });
});
