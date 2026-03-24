import { describe, it, expect } from "vitest";
import { splitNameAndRole, classifyKind, parseStatements } from "./detail";

describe("splitNameAndRole", () => {
  it("「福田一郎議長」を名前と役職に分割する", () => {
    const result = splitNameAndRole("福田一郎議長");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("福田一郎");
    expect(result!.role).toBe("議長");
  });

  it("「山田太郎町長」を名前と役職に分割する", () => {
    const result = splitNameAndRole("山田太郎町長");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("山田太郎");
    expect(result!.role).toBe("町長");
  });

  it("「鈴木花子議員」を名前と役職に分割する", () => {
    const result = splitNameAndRole("鈴木花子議員");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("鈴木花子");
    expect(result!.role).toBe("議員");
  });

  it("「田中次郎教育長」を名前と役職に分割する", () => {
    const result = splitNameAndRole("田中次郎教育長");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("田中次郎");
    expect(result!.role).toBe("教育長");
  });

  it("「佐藤三郎副町長」を名前と役職に分割する", () => {
    const result = splitNameAndRole("佐藤三郎副町長");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("佐藤三郎");
    expect(result!.role).toBe("副町長");
  });

  it("「木村課長」を名前と役職に分割する（2文字の名前も処理できる）", () => {
    const result = splitNameAndRole("木村課長");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("木村");
    expect(result!.role).toBe("課長");
  });

  it("役職サフィックスがない場合は null を返す", () => {
    expect(splitNameAndRole("福田一郎")).toBeNull();
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
  it("内灘町形式（名前+役職）でテキストを分割する", () => {
    const text =
      "福田一郎議長 ただいまから本日の会議を開きます。" +
      "鈴木花子議員 質問があります。" +
      "山田太郎町長 お答えします。";
    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(3);

    const chairman = statements.find((s) => s.speakerRole === "議長");
    expect(chairman).toBeDefined();
    expect(chairman!.speakerName).toBe("福田一郎");
    expect(chairman!.kind).toBe("remark");

    const member = statements.find((s) => s.speakerRole === "議員");
    expect(member).toBeDefined();
    expect(member!.speakerName).toBe("鈴木花子");
    expect(member!.kind).toBe("question");

    const mayor = statements.find((s) => s.speakerRole === "町長");
    expect(mayor).toBeDefined();
    expect(mayor!.speakerName).toBe("山田太郎");
    expect(mayor!.kind).toBe("answer");
  });

  it("各 statement に contentHash が付与される", () => {
    const text =
      "福田一郎議長 テスト発言。" + "山田太郎町長 お答えします。";
    const statements = parseStatements(text);
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("課長の発言は answer に分類される", () => {
    const text =
      "高橋五郎課長 ご説明します。" + "山田太郎町長 以上です。";
    const statements = parseStatements(text);
    const kacho = statements.find((s) => s.speakerRole === "課長");
    expect(kacho).toBeDefined();
    expect(kacho!.kind).toBe("answer");
  });

  it("教育長の発言は answer に分類される", () => {
    const text = "田中次郎教育長 お答えいたします。";
    const statements = parseStatements(text);
    expect(statements.length).toBeGreaterThan(0);
    const kyoucho = statements.find((s) => s.speakerRole === "教育長");
    expect(kyoucho).toBeDefined();
    expect(kyoucho!.kind).toBe("answer");
  });
});
