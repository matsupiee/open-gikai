import { describe, expect, it } from "vitest";
import { parseCouncilList } from "./list";

describe("parseCouncilList", () => {
  it("会議一覧を正しくパースする", () => {
    const data = [
      {
        council_id: "4",
        year: "2025-05-19",
        label: "令和7年5月臨時会",
        schedules: [
          {
            schedule_id: "1",
            label: "5月20日",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(1);
    expect(records[0]!.councilId).toBe("4");
    expect(records[0]!.scheduleId).toBe("1");
    expect(records[0]!.councilLabel).toBe("令和7年5月臨時会");
    expect(records[0]!.scheduleLabel).toBe("5月20日");
    expect(records[0]!.heldOn).toBe("2025-05-19");
    expect(records[0]!.meetingType).toBe("extraordinary");
  });

  it("複数の schedule を持つ council から複数レコードを生成する", () => {
    const data = [
      {
        council_id: "5",
        year: "2025-06-03",
        label: "令和7年6月定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "6月4日",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
          {
            schedule_id: "2",
            label: "6月13日",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(2);
    expect(records[0]!.scheduleId).toBe("1");
    expect(records[0]!.scheduleLabel).toBe("6月4日");
    expect(records[1]!.scheduleId).toBe("2");
    expect(records[1]!.scheduleLabel).toBe("6月13日");
    expect(records[0]!.meetingType).toBe("plenary");
  });

  it("委員会を committee として認識する", () => {
    const data = [
      {
        council_id: "8",
        year: "2025-09-10",
        label: "令和7年決算特別委員会",
        schedules: [
          {
            schedule_id: "1",
            label: "9月10日",
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

  it("schedules が空の場合は council 単位でレコードを作成する", () => {
    const data = [
      {
        council_id: "5",
        year: "2025-06-03",
        label: "令和7年6月定例会",
        schedules: [],
      },
    ];

    const records = parseCouncilList(data);

    expect(records).toHaveLength(1);
    expect(records[0]!.councilId).toBe("5");
    expect(records[0]!.scheduleId).toBe("0");
    expect(records[0]!.heldOn).toBe("2025-06-03");
  });

  it("year フィールドが YYYY-MM-DD 形式でない場合は label から日付を解析する", () => {
    const data = [
      {
        council_id: "1",
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
        label: "令和7年第4回定例会",
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

  it("sourceUrl が DiscussVision の ooki テナント URL を含む", () => {
    const data = [
      {
        council_id: "5",
        year: "2025-06-03",
        label: "令和7年6月定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "6月4日",
            is_newest: false,
            playlist: [],
            minute_text: [],
          },
        ],
      },
    ];

    const records = parseCouncilList(data);

    expect(records[0]!.sourceUrl).toContain("smart.discussvision.net");
    expect(records[0]!.sourceUrl).toContain("ooki");
  });
});
