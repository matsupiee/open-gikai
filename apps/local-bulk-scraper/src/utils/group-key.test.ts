import { describe, expect, it } from "vitest";
import { extractGroupKey } from "./group-key";

describe("extractGroupKey", () => {
  it("共有サービスドメイン dbsr.jp のサブドメインを dbsr.jp に集約する", () => {
    expect(extractGroupKey("gifu.dbsr.jp")).toBe("dbsr.jp");
  });

  it("共有サービスドメイン kaigiroku.net のサブドメインを集約する", () => {
    expect(extractGroupKey("ssp.kaigiroku.net")).toBe("kaigiroku.net");
  });

  it("共有サービスドメイン kensakusystem.jp のサブドメインを集約する", () => {
    expect(extractGroupKey("city.kensakusystem.jp")).toBe("kensakusystem.jp");
  });

  it("共有サービスドメイン gijiroku.com のサブドメインを集約する", () => {
    expect(extractGroupKey("city.gijiroku.com")).toBe("gijiroku.com");
  });

  it("非共有ドメインはフルホスト名をそのまま返す", () => {
    expect(extractGroupKey("gikai.city.sapporo.jp")).toBe("gikai.city.sapporo.jp");
  });

  it("2パートドメインはそのまま返す", () => {
    expect(extractGroupKey("example.com")).toBe("example.com");
  });

  it("1パートホスト名はそのまま返す", () => {
    expect(extractGroupKey("localhost")).toBe("localhost");
  });
});
