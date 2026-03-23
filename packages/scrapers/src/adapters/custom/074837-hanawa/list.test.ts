import { describe, expect, it } from "vitest";
import { expandCouncils } from "./list";
import type { CouncilItem } from "./list";

describe("expandCouncils", () => {
  it("council → schedule → playlist を展開して schedule 単位のレコードを返す", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "42",
        year: "2024-03-05",
        label: "令和6年第1回塙町議会定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "03月05日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "金澤太郎",
                speaker_id: "21",
                content: "農地維持政策について",
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
            ],
          },
          {
            schedule_id: "2",
            label: "03月06日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "佐藤一郎",
                speaker_id: "15",
                content: "道路整備について",
                movie_name1: "hanawa/2024/0306000301.mp4",
                movie_released: "2",
              },
            ],
          },
        ],
      },
    ];

    const records = expandCouncils(councils);

    expect(records).toHaveLength(2);
    expect(records[0]!.councilId).toBe("42");
    expect(records[0]!.councilLabel).toBe("令和6年第1回塙町議会定例会");
    expect(records[0]!.councilYear).toBe("2024-03-05");
    expect(records[0]!.scheduleId).toBe("1");
    expect(records[0]!.scheduleLabel).toBe("03月05日　一般質問");
    expect(records[0]!.playlist).toHaveLength(2);
    expect(records[1]!.scheduleId).toBe("2");
    expect(records[1]!.playlist).toHaveLength(1);
  });

  it("playlist が空の schedule はスキップする", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "10",
        year: "2023-06-01",
        label: "令和5年第2回塙町議会定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "06月01日　本会議",
            playlist: [],
          },
          {
            schedule_id: "2",
            label: "06月02日　一般質問",
            playlist: [
              {
                playlist_id: "1",
                speaker: "田中次郎",
                speaker_id: "8",
                content: "防災対策について",
                movie_name1: "hanawa/2023/0602000301.mp4",
                movie_released: "2",
              },
            ],
          },
        ],
      },
    ];

    const records = expandCouncils(councils);

    expect(records).toHaveLength(1);
    expect(records[0]!.scheduleId).toBe("2");
  });

  it("councils が空配列なら空配列を返す", () => {
    expect(expandCouncils([])).toHaveLength(0);
  });

  it("複数 council を正しく展開する", () => {
    const councils: CouncilItem[] = [
      {
        council_id: "41",
        year: "2024-01-10",
        label: "令和6年第1回塙町議会臨時会",
        schedules: [
          {
            schedule_id: "1",
            label: "01月10日　臨時会",
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "議事進行",
                movie_name1: "hanawa/2024/0110000101.mp4",
                movie_released: "2",
              },
            ],
          },
        ],
      },
      {
        council_id: "42",
        year: "2024-03-05",
        label: "令和6年第1回塙町議会定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "03月05日　一般質問",
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
        ],
      },
    ];

    const records = expandCouncils(councils);

    expect(records).toHaveLength(2);
    expect(records[0]!.councilId).toBe("41");
    expect(records[1]!.councilId).toBe("42");
  });
});
