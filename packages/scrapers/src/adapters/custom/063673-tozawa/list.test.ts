import { describe, expect, it } from "vitest";
import { parseCouncilList } from "./list";

describe("parseCouncilList", () => {
  it("会議一覧を正しくパースする", () => {
    const data = [
      {
        council_id: "48",
        year: "2024-01-23",
        label: "令和6年第1回臨時会",
        schedules: [
          {
            schedule_id: "1",
            label: "01月23日　本会議",
            is_newest: false,
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "本会議",
                movie_name1: "tozawa/2024/0123010101.mp4",
                vtt_name: null,
                movie_released: "2",
              },
            ],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(1);
    expect(records[0]!.councilId).toBe("48");
    expect(records[0]!.scheduleId).toBe("1");
    expect(records[0]!.councilLabel).toBe("令和6年第1回臨時会");
    expect(records[0]!.scheduleLabel).toBe("01月23日　本会議");
    expect(records[0]!.heldOn).toBe("2024-01-23");
    expect(records[0]!.meetingType).toBe("extraordinary");
  });

  it("schedule.label の月日と council.year の年から開催日を正しく構成する", () => {
    const data = [
      {
        council_id: "50",
        year: "2024-03-01",
        label: "令和6年第1回定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "03月07日　本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
          {
            schedule_id: "2",
            label: "03月15日　本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(2);
    expect(records[0]!.heldOn).toBe("2024-03-07");
    expect(records[1]!.heldOn).toBe("2024-03-15");
    expect(records[0]!.meetingType).toBe("plenary");
  });

  it("複数の schedule を持つ council から複数レコードを生成する", () => {
    const data = [
      {
        council_id: "55",
        year: "2024-09-10",
        label: "令和6年第3回定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "09月10日　本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
          {
            schedule_id: "2",
            label: "09月13日　本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
          {
            schedule_id: "3",
            label: "09月20日　本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(3);
    expect(records[0]!.scheduleId).toBe("1");
    expect(records[1]!.scheduleId).toBe("2");
    expect(records[2]!.scheduleId).toBe("3");
  });

  it("schedules が空の場合は council 単位でレコードを作成する", () => {
    const data = [
      {
        council_id: "50",
        year: "2024-06-01",
        label: "令和6年第2回定例会",
        schedules: [],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(1);
    expect(records[0]!.councilId).toBe("50");
    expect(records[0]!.scheduleId).toBe("0");
    expect(records[0]!.heldOn).toBe("2024-06-01");
  });

  it("schedule.label が月日形式でない場合は heldOn が null になる", () => {
    const data = [
      {
        council_id: "99",
        year: "2024-03-01",
        label: "令和6年第1回定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(1);
    expect(records[0]!.heldOn).toBeNull();
  });

  it("空配列の場合は空配列を返す", () => {
    const records = parseCouncilList([]);
    expect(records).toHaveLength(0);
  });

  it("配列でない場合は空配列を返す", () => {
    const records = parseCouncilList(null);
    expect(records).toHaveLength(0);
  });

  it("sourceUrl が DiscussVision の tozawa テナント URL を含む", () => {
    const data = [
      {
        council_id: "48",
        year: "2024-01-23",
        label: "令和6年第1回臨時会",
        schedules: [
          {
            schedule_id: "1",
            label: "01月23日　本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records[0]!.sourceUrl).toContain("smart.discussvision.net");
    expect(records[0]!.sourceUrl).toContain("tozawa");
  });

  it("複数の council をパースして全 schedule をフラットに返す", () => {
    const data = [
      {
        council_id: "48",
        year: "2024-01-23",
        label: "令和6年第1回臨時会",
        schedules: [
          {
            schedule_id: "1",
            label: "01月23日　本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
      {
        council_id: "50",
        year: "2024-03-01",
        label: "令和6年第1回定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "03月07日　本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
          {
            schedule_id: "2",
            label: "03月15日　本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(3);
    expect(records[0]!.councilId).toBe("48");
    expect(records[1]!.councilId).toBe("50");
    expect(records[2]!.councilId).toBe("50");
  });
});
