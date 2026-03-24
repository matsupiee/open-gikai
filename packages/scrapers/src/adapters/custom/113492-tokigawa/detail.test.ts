import { describe, it, expect } from "vitest";
import { classifyKind, parseSpeakerText, parseStatements } from "./detail";

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

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
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

  it("総務課長（サフィックス）は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseSpeakerText", () => {
  it("議長パターンを解析する", () => {
    const result = parseSpeakerText("神山　俊議長");
    expect(result.speakerName).toBe("神山　俊");
    expect(result.speakerRole).toBe("議長");
  });

  it("町長パターンを解析する", () => {
    const result = parseSpeakerText("渡邉一美町長");
    expect(result.speakerName).toBe("渡邉一美");
    expect(result.speakerRole).toBe("町長");
  });

  it("番号付き議員（全角）を解析する", () => {
    const result = parseSpeakerText("６番　田中紀吉議員");
    expect(result.speakerName).toBe("田中紀吉");
    expect(result.speakerRole).toBe("議員");
  });

  it("番号付き議員（半角）を解析する", () => {
    const result = parseSpeakerText("6番　山田一郎議員");
    expect(result.speakerName).toBe("山田一郎");
    expect(result.speakerRole).toBe("議員");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeakerText("佐藤次郎副町長");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("副町長");
  });

  it("課長サフィックスの複合役職を解析する", () => {
    const result = parseSpeakerText("総務課長");
    expect(result.speakerName).toBe("総務");
    expect(result.speakerRole).toBe("課長");
  });

  it("役職サフィックスがない場合はそのまま返す", () => {
    const result = parseSpeakerText("山田太郎");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBeNull();
  });
});

describe("parseStatements", () => {
  it("○ で始まる行を発言として解析する", () => {
    const text = `
<body><TT><font size=3>
○神山　俊議長　皆さん、おはようございます。
○６番　田中紀吉議員　議長の発言許可をいただきましたので…
○渡邉一美町長　田中議員ご質問の…
</font></TT></body>
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("神山　俊");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("皆さん、おはようございます。");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中紀吉");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.content).toBe("議長の発言許可をいただきましたので…");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("渡邉一美");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.content).toBe("田中議員ご質問の…");
  });

  it("◇ で始まる行（質問者見出し）はスキップする", () => {
    const text = `
○神山　俊議長　開会します。
◇　田　中　紀　吉　議員
○６番　田中紀吉議員　質問します。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("発言が複数行にわたる場合は継続して結合する", () => {
    const text = `
○６番　田中紀吉議員　最初の行です。
次の行です。
さらに続きます。
○神山　俊議長　次の発言。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe(
      "最初の行です。\n次の行です。\nさらに続きます。",
    );
  });

  it("各 statement に contentHash が付与される", () => {
    const text = `○神山　俊議長　テスト発言内容。`;
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("HTML タグを除去する", () => {
    const text = `<body><TT><font size=3>
○神山　俊議長　<font color="red">重要な</font>発言です。
</font></TT></body>`;

    const statements = parseStatements(text);
    expect(statements[0]!.content).toBe("重要な発言です。");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
    expect(parseStatements("<html><body></body></html>")).toEqual([]);
  });

  it("offset が連続して計算される", () => {
    const text = `
○神山　俊議長　開会します。
○６番　田中紀吉議員　質問します。
    `;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("開会します。".length);
    expect(statements[1]!.startOffset).toBe("開会します。".length + 1);
  });
});
