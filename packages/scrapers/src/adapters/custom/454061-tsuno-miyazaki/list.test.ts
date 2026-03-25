import { describe, it, expect } from "vitest";
import { extractMeetingsFromSections } from "./list";

// TextContentSec の型を直接定義（テスト用）
interface TextContentSec {
  textType: "C" | "T1" | "L";
  textContent: string | null;
  linkDisplayName: string | null;
  linkUrl: string | null;
  textContentSortOrder: number;
}

describe("extractMeetingsFromSections", () => {
  it("令和7年の定例会を正しく抽出する", () => {
    const sections: TextContentSec[] = [
      {
        textType: "T1",
        textContent: "令和7年定例会会議録",
        linkDisplayName: null,
        linkUrl: null,
        textContentSortOrder: 1,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "令和7年第1回定例会（PDFファイル）",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/%EF%BC%88%E3%83%9B%E3%83%BC%E3%83%A0%E3%83%9A%E3%83%BC%E3%82%B8%E7%94%A8%EF%BC%89%E4%BB%A4%E5%92%8C%EF%BC%97%E5%B9%B4%E7%AC%AC%EF%BC%91%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A%E4%BC%9A%E8%AD%B0%E9%8C%B2.pdf",
        textContentSortOrder: 2,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "令和7年第2回定例会（PDFファイル）",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/r7-2.pdf",
        textContentSortOrder: 3,
      },
    ];

    const meetings = extractMeetingsFromSections(sections, 2025);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("令和7年第1回定例会");
    expect(meetings[0]!.heldOn).toBe("2025-01-01");
    expect(meetings[0]!.meetingKind).toBe("定例会");
    expect(meetings[0]!.session).toBe(1);
    expect(meetings[1]!.title).toBe("令和7年第2回定例会");
    expect(meetings[1]!.session).toBe(2);
  });

  it("令和6年の臨時会を正しく抽出する", () => {
    const sections: TextContentSec[] = [
      {
        textType: "T1",
        textContent: "令和6年臨時会会議録",
        linkDisplayName: null,
        linkUrl: null,
        textContentSortOrder: 1,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "第1回臨時会",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/r6-rinji.pdf",
        textContentSortOrder: 2,
      },
    ];

    const meetings = extractMeetingsFromSections(sections, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingKind).toBe("臨時会");
    expect(meetings[0]!.session).toBe(1);
    expect(meetings[0]!.heldOn).toBe("2024-01-01");
  });

  it("他の年のリンクをスキップする", () => {
    const sections: TextContentSec[] = [
      {
        textType: "T1",
        textContent: "令和7年定例会会議録",
        linkDisplayName: null,
        linkUrl: null,
        textContentSortOrder: 1,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "令和7年第1回定例会（PDFファイル）",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/r7-1.pdf",
        textContentSortOrder: 2,
      },
      {
        textType: "T1",
        textContent: "令和6年定例会会議録",
        linkDisplayName: null,
        linkUrl: null,
        textContentSortOrder: 3,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "令和6年第1回定例会（PDFファイル）",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/r6-1.pdf",
        textContentSortOrder: 4,
      },
    ];

    const meetings = extractMeetingsFromSections(sections, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和7年第1回定例会");
  });

  it("ラベルに年が含まれる場合はラベルの年を優先する", () => {
    const sections: TextContentSec[] = [
      {
        textType: "T1",
        // 平成31年・令和元年の複合見出し → 令和元年(2019)を抽出
        textContent: "平成31年・令和元年 定例会会議録",
        linkDisplayName: null,
        linkUrl: null,
        textContentSortOrder: 1,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "令和元年第4回定例会（PDFファイル）",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/h31-r1-4.pdf",
        textContentSortOrder: 2,
      },
    ];

    const meetings = extractMeetingsFromSections(sections, 2019);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和元年第4回定例会");
  });

  it("平成21年（平成30年度以前）のリンクを正しく抽出する", () => {
    const sections: TextContentSec[] = [
      {
        textType: "T1",
        textContent: "平成21年定例会会議録",
        linkDisplayName: null,
        linkUrl: null,
        textContentSortOrder: 1,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "第1回定例会",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84ef987decd0dbb681c31/2-1T.pdf",
        textContentSortOrder: 2,
      },
    ];

    const meetings = extractMeetingsFromSections(sections, 2009);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("平成21年第1回定例会");
    expect(meetings[0]!.heldOn).toBe("2009-01-01");
  });

  it("linkUrl の末尾スペースを除去する", () => {
    const sections: TextContentSec[] = [
      {
        textType: "T1",
        textContent: "令和6年定例会会議録",
        linkDisplayName: null,
        linkUrl: null,
        textContentSortOrder: 1,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "令和6年第1回定例会（PDFファイル）",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/r6-1.pdf   ",
        textContentSortOrder: 2,
      },
    ];

    const meetings = extractMeetingsFromSections(sections, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/r6-1.pdf"
    );
  });

  it("C タイプのセクションはスキップされる", () => {
    const sections: TextContentSec[] = [
      {
        textType: "T1",
        textContent: "令和7年定例会会議録",
        linkDisplayName: null,
        linkUrl: null,
        textContentSortOrder: 1,
      },
      {
        textType: "C",
        textContent: "会議録の閲覧については議会事務局へお問い合わせください。",
        linkDisplayName: null,
        linkUrl: null,
        textContentSortOrder: 2,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "令和7年第1回定例会（PDFファイル）",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/r7-1.pdf",
        textContentSortOrder: 3,
      },
    ];

    const meetings = extractMeetingsFromSections(sections, 2025);

    expect(meetings).toHaveLength(1);
  });

  it("空の sections は空配列を返す", () => {
    const meetings = extractMeetingsFromSections([], 2025);
    expect(meetings).toHaveLength(0);
  });

  it("session 昇順にソートされる", () => {
    const sections: TextContentSec[] = [
      {
        textType: "T1",
        textContent: "令和6年定例会会議録",
        linkDisplayName: null,
        linkUrl: null,
        textContentSortOrder: 1,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "令和6年第3回定例会（PDFファイル）",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/r6-3.pdf",
        textContentSortOrder: 2,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "令和6年第1回定例会（PDFファイル）",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/r6-1.pdf",
        textContentSortOrder: 3,
      },
      {
        textType: "L",
        textContent: null,
        linkDisplayName: "令和6年第2回定例会（PDFファイル）",
        linkUrl:
          "https://prdurbanostnoapp1.blob.core.windows.net/common-article/61a84c6d87decd0dbb681baa/r6-2.pdf",
        textContentSortOrder: 4,
      },
    ];

    const meetings = extractMeetingsFromSections(sections, 2024);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.session).toBe(1);
    expect(meetings[1]!.session).toBe(2);
    expect(meetings[2]!.session).toBe(3);
  });
});
