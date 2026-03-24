import { describe, expect, it } from "vitest";
import { parseCouncilList } from "./list";

describe("parseCouncilList", () => {
  it("会議一覧を正しくパースする", () => {
    const data = [
      {
        council_id: "12",
        year: "2024-03-12",
        label: "令和6年3月定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "03月11日　本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
          {
            schedule_id: "2",
            label: "03月12日　本会議",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(2);

    expect(records[0]!.councilId).toBe("12");
    expect(records[0]!.scheduleId).toBe("1");
    expect(records[0]!.councilLabel).toBe("令和6年3月定例会");
    expect(records[0]!.scheduleLabel).toBe("03月11日　本会議");
    expect(records[0]!.heldOn).toBe("2024-03-12");
    expect(records[0]!.meetingType).toBe("plenary");

    expect(records[1]!.scheduleId).toBe("2");
    expect(records[1]!.scheduleLabel).toBe("03月12日　本会議");
    expect(records[1]!.meetingType).toBe("plenary");
  });

  it("委員会を committee として認識する", () => {
    const data = [
      {
        council_id: "10",
        year: "2023-09-10",
        label: "令和5年決算特別委員会",
        schedules: [
          {
            schedule_id: "1",
            label: "09月10日",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("committee");
  });

  it("臨時会を extraordinary として認識する", () => {
    const data = [
      {
        council_id: "8",
        year: "2024-01-10",
        label: "令和6年1月臨時会",
        schedules: [
          {
            schedule_id: "1",
            label: "01月10日",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("extraordinary");
  });

  it("schedules が空の場合は council 単位でレコードを作成する", () => {
    const data = [
      {
        council_id: "5",
        year: "2022-06-10",
        label: "令和4年6月定例会",
        schedules: [],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(1);
    expect(records[0]!.councilId).toBe("5");
    expect(records[0]!.scheduleId).toBe("0");
    expect(records[0]!.heldOn).toBe("2022-06-10");
  });

  it("year フィールドが YYYY-MM-DD 形式でない場合は label から日付を解析する", () => {
    const data = [
      {
        council_id: "3",
        year: "invalid",
        label: "令和3年3月1日定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "3月1日",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(1);
    expect(records[0]!.heldOn).toBe("2021-03-01");
  });

  it("year フィールドも label も解析できない場合は heldOn が null になる", () => {
    const data = [
      {
        council_id: "99",
        year: "invalid",
        label: "令和6年第4回定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "日程1",
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

  it("sourceUrl が DiscussVision の nozawaonsen テナント URL を含む", () => {
    const data = [
      {
        council_id: "1",
        year: "2021-03-01",
        label: "令和3年3月定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "03月01日",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records[0]!.sourceUrl).toContain("smart.discussvision.net");
    expect(records[0]!.sourceUrl).toContain("nozawaonsen");
  });

  it("平成年号を正しく西暦に変換する", () => {
    const data = [
      {
        council_id: "1",
        year: "invalid",
        label: "平成30年3月1日定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "03月01日",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records[0]!.heldOn).toBe("2018-03-01");
  });
});
