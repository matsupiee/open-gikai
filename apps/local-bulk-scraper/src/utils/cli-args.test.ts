import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseYear, parseMeetingLimit, parseTarget, parseSystemType } from "./cli-args";

let originalArgv: string[];

beforeEach(() => {
  originalArgv = process.argv;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit");
  });
});

afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
});

describe("parseYear", () => {
  it("--year フラグがなければ undefined を返す", () => {
    process.argv = ["node", "script"];
    expect(parseYear()).toBeUndefined();
  });

  it("有効な年を返す", () => {
    process.argv = ["node", "script", "--year", "2025"];
    expect(parseYear()).toBe(2025);
  });

  it("2000未満の年で process.exit(1) を呼ぶ", () => {
    process.argv = ["node", "script", "--year", "1999"];
    expect(() => parseYear()).toThrow("process.exit");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("2100超の年で process.exit(1) を呼ぶ", () => {
    process.argv = ["node", "script", "--year", "2101"];
    expect(() => parseYear()).toThrow("process.exit");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("非数値で process.exit(1) を呼ぶ", () => {
    process.argv = ["node", "script", "--year", "abc"];
    expect(() => parseYear()).toThrow("process.exit");
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

describe("parseMeetingLimit", () => {
  it("--meeting-limit フラグがなければ undefined を返す", () => {
    process.argv = ["node", "script"];
    expect(parseMeetingLimit()).toBeUndefined();
  });

  it("有効な値を返す", () => {
    process.argv = ["node", "script", "--meeting-limit", "5"];
    expect(parseMeetingLimit()).toBe(5);
  });

  it("0 で process.exit(1) を呼ぶ", () => {
    process.argv = ["node", "script", "--meeting-limit", "0"];
    expect(() => parseMeetingLimit()).toThrow("process.exit");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("負数で process.exit(1) を呼ぶ", () => {
    process.argv = ["node", "script", "--meeting-limit", "-1"];
    expect(() => parseMeetingLimit()).toThrow("process.exit");
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

describe("parseTarget", () => {
  it("--target フラグがなければ undefined を返す", () => {
    process.argv = ["node", "script"];
    expect(parseTarget()).toBeUndefined();
  });

  it("単一コードを配列で返す", () => {
    process.argv = ["node", "script", "--target", "011002"];
    expect(parseTarget()).toEqual(["011002"]);
  });

  it("カンマ区切りの複数コードを配列で返す", () => {
    process.argv = ["node", "script", "--target", "011002,012025"];
    expect(parseTarget()).toEqual(["011002", "012025"]);
  });

  it("値なしで process.exit(1) を呼ぶ", () => {
    process.argv = ["node", "script", "--target"];
    expect(() => parseTarget()).toThrow("process.exit");
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

describe("parseSystemType", () => {
  it("--system-type フラグがなければ undefined を返す", () => {
    process.argv = ["node", "script"];
    expect(parseSystemType()).toBeUndefined();
  });

  it("有効なシステムタイプを返す", () => {
    process.argv = ["node", "script", "--system-type", "dbsearch"];
    expect(parseSystemType()).toBe("dbsearch");
  });

  it("無効なシステムタイプで process.exit(1) を呼ぶ", () => {
    process.argv = ["node", "script", "--system-type", "invalid"];
    expect(() => parseSystemType()).toThrow("process.exit");
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
