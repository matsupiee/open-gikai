import { describe, expect, it } from "vitest";
import { classifyKind, parseMemberName, parseDetailSection } from "./detail";

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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
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

describe("parseMemberName", () => {
  it("姓名＋議員＋会派名を正しくパースする", () => {
    const result = parseMemberName("長内　良蔵　議員（公正会）");
    expect(result.name).toBe("長内 良蔵");
    expect(result.role).toBe("議員");
    expect(result.faction).toBe("公正会");
  });

  it("全角スペース区切りのみの議員名", () => {
    const result = parseMemberName("葛西　幸男　議員（公正会）");
    expect(result.name).toBe("葛西 幸男");
    expect(result.role).toBe("議員");
    expect(result.faction).toBe("公正会");
  });

  it("会派名なしの場合は faction が null", () => {
    const result = parseMemberName("山田太郎　議員");
    expect(result.name).toBe("山田太郎");
    expect(result.role).toBe("議員");
    expect(result.faction).toBeNull();
  });

  it("役職なしの場合は role が null", () => {
    const result = parseMemberName("山田太郎（無所属）");
    expect(result.name).toBe("山田太郎");
    expect(result.role).toBeNull();
    expect(result.faction).toBe("無所属");
  });
});

describe("parseDetailSection", () => {
  it("議決結果テーブルから発言を抽出する", () => {
    const html = `
      <html><body>
      <h2>定例会・臨時会　令和６年</h2>
      <h2>第4回定例会（令和６年12月２日～６日）</h2>
      <h3>議決結果</h3>
      <table>
        <tr><th>議案番号</th><th>提出年月日</th><th>件名</th><th>議決結果</th></tr>
        <tr><td>承認第8号</td><td>令和6年12月2日</td><td>専決処分の承認を求めることについて</td><td>承認</td></tr>
        <tr><td>議案第20号</td><td>令和6年12月2日</td><td>規約の変更について</td><td>原案可決</td></tr>
      </table>
      <h2>第3回定例会</h2>
      </body></html>
    `;

    const statements = parseDetailSection(html, 0);

    expect(statements.length).toBeGreaterThanOrEqual(2);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.content).toContain("承認第8号");
    expect(statements[0]!.content).toContain("専決処分の承認を求めることについて");
    expect(statements[0]!.content).toContain("承認");
    expect(statements[1]!.content).toContain("議案第20号");
  });

  it("一般質問の h4→h5→h6+p 構造を発言として抽出する", () => {
    const html = `
      <html><body>
      <h2>定例会・臨時会　令和６年</h2>
      <h2>第4回定例会（令和６年12月２日～６日）</h2>
      <h3>一般質問の主な項目</h3>
      <h4>長内　良蔵　議員（公正会）</h4>
      <h5>指名競争入札について</h5>
      <h6>（１）訴訟中の２業者が入札に入ったことについて</h6>
      <p>現在、訴訟中で葛西町長になってから一度も指名がなかった業者が令和６年度から指名されている。</p>
      <h6>（２）不自然な入札のやり方について</h6>
      <p>落札率が高止まりしていることについて説明を求める。</p>
      <h2>第3回定例会</h2>
      </body></html>
    `;

    const statements = parseDetailSection(html, 0);

    const questionStatements = statements.filter((s) => s.kind === "question");
    expect(questionStatements.length).toBeGreaterThanOrEqual(1);
    expect(questionStatements[0]!.speakerName).toBe("長内 良蔵");
    expect(questionStatements[0]!.speakerRole).toBe("議員");
    expect(questionStatements[0]!.content).toContain("指名競争入札について");
    expect(questionStatements[0]!.content).toContain("訴訟中の２業者");
  });

  it("複数議員の質問を正しく抽出する", () => {
    const html = `
      <html><body>
      <h2>定例会・臨時会　令和６年</h2>
      <h2>第2回定例会（令和６年６月３日～７日）</h2>
      <h3>一般質問の主な項目</h3>
      <h4>田中　一郎　議員（公正会）</h4>
      <h5>農業政策について</h5>
      <h4>鈴木　花子　議員（無所属）</h4>
      <h5>子育て支援について</h5>
      <h2>次の定例会</h2>
      </body></html>
    `;

    const statements = parseDetailSection(html, 0);

    const questionStatements = statements.filter((s) => s.kind === "question");
    expect(questionStatements).toHaveLength(2);
    expect(questionStatements[0]!.speakerName).toBe("田中 一郎");
    expect(questionStatements[0]!.content).toContain("農業政策について");
    expect(questionStatements[1]!.speakerName).toBe("鈴木 花子");
    expect(questionStatements[1]!.content).toContain("子育て支援について");
  });

  it("sectionIndex が範囲外の場合は空配列を返す", () => {
    const html = `
      <html><body>
      <h2>定例会・臨時会　令和６年</h2>
      <h2>第1回定例会（令和６年３月15日～25日）</h2>
      </body></html>
    `;

    const statements = parseDetailSection(html, 99);
    expect(statements).toHaveLength(0);
  });

  it("contentHash は SHA-256 の 64 文字 hex 文字列", () => {
    const html = `
      <html><body>
      <h2>定例会・臨時会　令和６年</h2>
      <h2>第1回定例会（令和６年３月15日）</h2>
      <table>
        <tr><th>議案番号</th><th>提出年月日</th><th>件名</th><th>議決結果</th></tr>
        <tr><td>議案第1号</td><td>令和6年3月15日</td><td>テスト条例</td><td>原案可決</td></tr>
      </table>
      </body></html>
    `;

    const statements = parseDetailSection(html, 0);
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const html = `
      <html><body>
      <h2>年度タイトル</h2>
      <h2>第1回定例会（令和６年３月15日）</h2>
      <table>
        <tr><th>議案番号</th><th>提出年月日</th><th>件名</th><th>議決結果</th></tr>
        <tr><td>議案第1号</td><td>令和6年3月15日</td><td>テスト条例</td><td>原案可決</td></tr>
        <tr><td>議案第2号</td><td>令和6年3月15日</td><td>別条例</td><td>否決</td></tr>
      </table>
      </body></html>
    `;

    const statements = parseDetailSection(html, 0);
    expect(statements.length).toBeGreaterThanOrEqual(2);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(statements[0]!.content.length);
    expect(statements[1]!.startOffset).toBe(statements[0]!.endOffset + 1);
  });
});
