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

  it("町長を含む speaker は answer", () => {
    expect(classifyKind("町長", "10")).toBe("answer");
  });

  it("副町長を含む speaker は answer", () => {
    expect(classifyKind("副町長", "11")).toBe("answer");
  });

  it("教育長を含む speaker は answer", () => {
    expect(classifyKind("教育長", "12")).toBe("answer");
  });

  it("課長を含む speaker は answer", () => {
    expect(classifyKind("総務課長", "13")).toBe("answer");
  });

  it("一般的な議員名は question", () => {
    expect(classifyKind("金澤太郎", "21")).toBe("question");
  });
});

describe("buildStatements", () => {
  it("playlist アイテムから statements を生成する", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: "金澤太郎",
        speaker_id: "21",
        content: "農地維持政策について\n高齢化対策について",
        movie_name1: "hanawa/2024/0305000301.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "町長",
        speaker_id: "10",
        content: "農地維持政策についてお答えいたします。",
        movie_name1: "hanawa/2024/0305000302.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("金澤太郎");
    expect(statements[0]!.content).toBe("農地維持政策について\n高齢化対策について");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("町長");
  });

  it("content が空の playlist アイテムはスキップする", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: "金澤太郎",
        speaker_id: "21",
        content: "",
        movie_name1: "hanawa/2024/0305000301.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "鈴木花子",
        speaker_id: "12",
        content: "子育て支援について",
        movie_name1: "hanawa/2024/0305000302.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("鈴木花子");
  });

  it("speaker_id '0' の発言は remark になる", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: null,
        speaker_id: "0",
        content: "議事進行に関する説明",
        movie_name1: "hanawa/2024/0305000301.mp4",
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
        speaker: "金澤太郎",
        speaker_id: "21",
        content: "質問です",
        movie_name1: "hanawa/2024/0305000301.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "町長",
        speaker_id: "10",
        content: "お答えします",
        movie_name1: "hanawa/2024/0305000302.mp4",
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
        councilId: "42",
        councilLabel: "令和6年第1回塙町議会定例会",
        councilYear: "2024-03-05",
        scheduleId: "1",
        scheduleLabel: "03月05日　一般質問",
        playlist: [
          {
            playlist_id: "1",
            speaker: "金澤太郎",
            speaker_id: "21",
            content: "農地維持政策について",
            movie_name1: "hanawa/2024/0305000301.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-123",
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityId).toBe("muni-123");
    expect(result!.title).toBe("令和6年第1回塙町議会定例会 03月05日　一般質問");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-03-05");
    expect(result!.sourceUrl).toBe(
      "https://smart.discussvision.net/smart/tenant/hanawa/WebView/rd/schedule.html?council_id=42&schedule_id=1",
    );
    expect(result!.externalId).toBe("hanawa_42_1");
    expect(result!.statements).toHaveLength(1);
  });

  it("臨時会の meetingType が extraordinary になる", () => {
    const result = buildMeetingData(
      {
        councilId: "41",
        councilLabel: "令和6年第2回塙町議会臨時会",
        councilYear: "2024-04-05",
        scheduleId: "1",
        scheduleLabel: "04月05日　臨時会",
        playlist: [
          {
            playlist_id: "1",
            speaker: "議長",
            speaker_id: "1",
            content: "議事進行",
            movie_name1: "hanawa/2024/0405000101.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-123",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("playlist が全て空 content なら null を返す", () => {
    const result = buildMeetingData(
      {
        councilId: "42",
        councilLabel: "令和6年第1回塙町議会定例会",
        councilYear: "2024-03-05",
        scheduleId: "1",
        scheduleLabel: "03月05日　一般質問",
        playlist: [
          {
            playlist_id: "1",
            speaker: "金澤太郎",
            speaker_id: "21",
            content: "",
            movie_name1: "hanawa/2024/0305000301.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-123",
    );

    expect(result).toBeNull();
  });

  it("scheduleLabel から日付が抽出できない場合は null を返す", () => {
    const result = buildMeetingData(
      {
        councilId: "42",
        councilLabel: "令和6年第1回塙町議会定例会",
        councilYear: "2024-03-05",
        scheduleId: "1",
        scheduleLabel: "不明な日程",
        playlist: [
          {
            playlist_id: "1",
            speaker: "金澤太郎",
            speaker_id: "21",
            content: "農地維持政策について",
            movie_name1: "hanawa/2024/0305000301.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-123",
    );

    expect(result).toBeNull();
  });
});
