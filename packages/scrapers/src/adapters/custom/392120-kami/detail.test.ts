import { describe, expect, it } from "vitest";
import { buildMeetingData, buildStatements, classifyKind } from "./detail";
import type { PlaylistItem } from "./list";

describe("classifyKind", () => {
  it("speaker_id '0' は remark", () => {
    expect(classifyKind(null, "0")).toBe("remark");
  });

  it("speaker が null は remark", () => {
    expect(classifyKind(null, "5")).toBe("remark");
  });

  it("speaker が空文字は remark", () => {
    expect(classifyKind("", "5")).toBe("remark");
  });

  it("議長を含む speaker は remark", () => {
    expect(classifyKind("議長", "1")).toBe("remark");
  });

  it("副議長を含む speaker は remark", () => {
    expect(classifyKind("副議長", "2")).toBe("remark");
  });

  it("委員長を含む speaker は remark", () => {
    expect(classifyKind("委員長", "3")).toBe("remark");
  });

  it("副委員長を含む speaker は remark", () => {
    expect(classifyKind("副委員長", "4")).toBe("remark");
  });

  it("市長を含む speaker は answer", () => {
    expect(classifyKind("市長", "10")).toBe("answer");
  });

  it("副市長を含む speaker は answer", () => {
    expect(classifyKind("副市長", "11")).toBe("answer");
  });

  it("教育長を含む speaker は answer", () => {
    expect(classifyKind("教育長", "12")).toBe("answer");
  });

  it("課長を含む speaker は answer", () => {
    expect(classifyKind("総務課長", "13")).toBe("answer");
  });

  it("部長を含む speaker は answer", () => {
    expect(classifyKind("福祉部長", "14")).toBe("answer");
  });

  it("一般的な議員名は question", () => {
    expect(classifyKind("山﨑眞幹", "6")).toBe("question");
  });
});

describe("buildStatements", () => {
  it("playlist アイテムから statements を生成する", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: "山﨑眞幹",
        speaker_id: "6",
        content: "１　「あんぱん」と予算案をめぐって\n２　市長提案説明をめぐって",
        movie_name1: "kami/2024/2024030501.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "市長",
        speaker_id: "10",
        content: "予算案についてお答えいたします。",
        movie_name1: "kami/2024/2024030502.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("山﨑眞幹");
    expect(statements[0]!.content).toBe("１　「あんぱん」と予算案をめぐって\n２　市長提案説明をめぐって");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("市長");
  });

  it("content が空の playlist アイテムはスキップする", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: "山﨑眞幹",
        speaker_id: "6",
        content: "",
        movie_name1: "kami/2024/2024030501.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "田中一郎",
        speaker_id: "7",
        content: "農業振興策について",
        movie_name1: "kami/2024/2024030502.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("田中一郎");
  });

  it("speaker_id '0' の発言は remark になる", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: null,
        speaker_id: "0",
        content: "議事進行に関する説明",
        movie_name1: "kami/2024/2024030501.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
  });

  it("offset が正しく計算される", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: "山﨑眞幹",
        speaker_id: "6",
        content: "質問です",
        movie_name1: "kami/2024/2024030501.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "市長",
        speaker_id: "10",
        content: "お答えします",
        movie_name1: "kami/2024/2024030502.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("質問です".length);
    expect(statements[1]!.startOffset).toBe("質問です".length + 1);
    expect(statements[1]!.endOffset).toBe("質問です".length + 1 + "お答えします".length);
  });

  it("空の playlist は空配列を返す", () => {
    expect(buildStatements([])).toHaveLength(0);
  });
});

describe("buildMeetingData", () => {
  it("正常なパラメータから MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        councilId: "86",
        councilLabel: "令和6年香美市議会定例会3月定例会議",
        councilYear: "2024-02-22",
        scheduleId: "2",
        scheduleLabel: "3月5日　一般質問",
        playlist: [
          {
            playlist_id: "1",
            speaker: "山﨑眞幹",
            speaker_id: "6",
            content: "「あんぱん」と予算案をめぐって",
            movie_name1: "kami/2024/2024030501.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-392120",
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityCode).toBe("muni-392120");
    expect(result!.title).toBe("令和6年香美市議会定例会3月定例会議 3月5日　一般質問");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-03-05");
    expect(result!.sourceUrl).toBe(
      "https://smart.discussvision.net/smart/tenant/kami/WebView/rd/schedule.html?council_id=86&schedule_id=2",
    );
    expect(result!.externalId).toBe("kami_86_2");
    expect(result!.statements).toHaveLength(1);
  });

  it("委員会の meetingType が committee になる", () => {
    const result = buildMeetingData(
      {
        councilId: "87",
        councilLabel: "総務常任委員会",
        councilYear: "2024-03-08",
        scheduleId: "308",
        scheduleLabel: "3月8日　委員会",
        playlist: [
          {
            playlist_id: "1",
            speaker: "委員長",
            speaker_id: "1",
            content: "議事進行",
            movie_name1: "kami/2024/2024030801.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-392120",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("committee");
  });

  it("分科会の meetingType が committee になる", () => {
    const result = buildMeetingData(
      {
        councilId: "88",
        councilLabel: "総務分科会",
        councilYear: "2024-03-11",
        scheduleId: "311",
        scheduleLabel: "3月11日　分科会",
        playlist: [
          {
            playlist_id: "1",
            speaker: "委員長",
            speaker_id: "1",
            content: "分科会を開会します",
            movie_name1: "kami/2024/2024031101.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-392120",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("committee");
  });

  it("臨時会の meetingType が extraordinary になる", () => {
    const result = buildMeetingData(
      {
        councilId: "85",
        councilLabel: "令和6年香美市議会定例会2月臨時会議",
        councilYear: "2024-01-19",
        scheduleId: "1",
        scheduleLabel: "1月19日　臨時会",
        playlist: [
          {
            playlist_id: "1",
            speaker: "議長",
            speaker_id: "1",
            content: "議事進行",
            movie_name1: "kami/2024/2024011901.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-392120",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("playlist が全て空 content なら null を返す", () => {
    const result = buildMeetingData(
      {
        councilId: "86",
        councilLabel: "令和6年香美市議会定例会3月定例会議",
        councilYear: "2024-02-22",
        scheduleId: "2",
        scheduleLabel: "3月5日　一般質問",
        playlist: [
          {
            playlist_id: "1",
            speaker: "山﨑眞幹",
            speaker_id: "6",
            content: "",
            movie_name1: "kami/2024/2024030501.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-392120",
    );

    expect(result).toBeNull();
  });

  it("scheduleLabel から日付が抽出できない場合は null を返す", () => {
    const result = buildMeetingData(
      {
        councilId: "86",
        councilLabel: "令和6年香美市議会定例会3月定例会議",
        councilYear: "2024-02-22",
        scheduleId: "2",
        scheduleLabel: "不明な日程",
        playlist: [
          {
            playlist_id: "1",
            speaker: "山﨑眞幹",
            speaker_id: "6",
            content: "市政について",
            movie_name1: "kami/2024/2024030501.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-392120",
    );

    expect(result).toBeNull();
  });
});
