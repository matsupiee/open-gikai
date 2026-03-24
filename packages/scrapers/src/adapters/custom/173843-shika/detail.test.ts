import { describe, it, expect } from "vitest";
import { splitNameAndRole, classifyKind, parseStatements } from "./detail";

describe("splitNameAndRole", () => {
  it("「福田晃悦議長」を名前と役職に分割する", () => {
    const result = splitNameAndRole("福田晃悦議長");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("福田晃悦");
    expect(result!.role).toBe("議長");
  });

  it("「稲岡健太郎町長」を名前と役職に分割する", () => {
    const result = splitNameAndRole("稲岡健太郎町長");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("稲岡健太郎");
    expect(result!.role).toBe("町長");
  });

  it("「南正紀議員」を名前と役職に分割する", () => {
    const result = splitNameAndRole("南正紀議員");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("南正紀");
    expect(result!.role).toBe("議員");
  });

  it("「間嶋正剛教育長」を名前と役職に分割する", () => {
    const result = splitNameAndRole("間嶋正剛教育長");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("間嶋正剛");
    expect(result!.role).toBe("教育長");
  });

  it("「庄田義則副町長」を名前と役職に分割する", () => {
    const result = splitNameAndRole("庄田義則副町長");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("庄田義則");
    expect(result!.role).toBe("副町長");
  });

  it("役職サフィックスがない場合は null を返す", () => {
    expect(splitNameAndRole("福田晃悦")).toBeNull();
  });

  it("「山下光雄課長」を名前と役職に分割する（複合役職から最後の役職を取る）", () => {
    const result = splitNameAndRole("山下光雄課長");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("山下光雄");
    expect(result!.role).toBe("課長");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("志賀町形式（名前+役職）でテキストを分割する", () => {
    const text =
      "福田晃悦議長 ただいまから本日の会議を開きます。" +
      "南正紀議員 質問があります。" +
      "稲岡健太郎町長 お答えします。";
    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(3);

    const chairman = statements.find((s) => s.speakerRole === "議長");
    expect(chairman).toBeDefined();
    expect(chairman!.speakerName).toBe("福田晃悦");
    expect(chairman!.kind).toBe("remark");

    const member = statements.find((s) => s.speakerRole === "議員");
    expect(member).toBeDefined();
    expect(member!.speakerName).toBe("南正紀");
    expect(member!.kind).toBe("question");

    const mayor = statements.find((s) => s.speakerRole === "町長");
    expect(mayor).toBeDefined();
    expect(mayor!.speakerName).toBe("稲岡健太郎");
    expect(mayor!.kind).toBe("answer");
  });

  it("各 statement に contentHash が付与される", () => {
    const text =
      "福田晃悦議長 テスト発言。" +
      "稲岡健太郎町長 お答えします。";
    const statements = parseStatements(text);
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("課長の発言は answer に分類される", () => {
    const text =
      "山下光雄課長 ご説明します。" +
      "稲岡健太郎町長 以上です。";
    const statements = parseStatements(text);
    const kacho = statements.find((s) => s.speakerRole === "課長");
    expect(kacho).toBeDefined();
    expect(kacho!.kind).toBe("answer");
  });

  it("教育長の発言は answer に分類される", () => {
    const text =
      "間嶋正剛教育長 お答えいたします。";
    const statements = parseStatements(text);
    expect(statements.length).toBeGreaterThan(0);
    const kyoucho = statements.find((s) => s.speakerRole === "教育長");
    expect(kyoucho).toBeDefined();
    expect(kyoucho!.kind).toBe("answer");
  });
});
