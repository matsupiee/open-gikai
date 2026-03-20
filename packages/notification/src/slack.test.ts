import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendSlackWebhook } from "./slack";

describe("sendSlackWebhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("webhookUrl が undefined の場合は fetch を呼ばない", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await sendSlackWebhook(undefined, { text: "test" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("webhookUrl が空文字の場合は fetch を呼ばない", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await sendSlackWebhook("", { text: "test" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("正しいペイロードで fetch を呼ぶ", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 })
    );

    const payload = { text: "ジョブが失敗しました" };
    await sendSlackWebhook("https://hooks.slack.com/test", payload);

    expect(fetchSpy).toHaveBeenCalledWith("https://hooks.slack.com/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("blocks を含むペイロードを送信できる", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 })
    );

    const payload = {
      text: "fallback text",
      blocks: [{ type: "section", text: { type: "mrkdwn", text: "hello" } }],
    };
    await sendSlackWebhook("https://hooks.slack.com/test", payload);

    expect(fetchSpy).toHaveBeenCalledWith("https://hooks.slack.com/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("fetch が非 2xx を返してもエラーを投げない", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("invalid_payload", { status: 400 })
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendSlackWebhook("https://hooks.slack.com/test", { text: "test" })
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
  });

  it("fetch がネットワークエラーを投げてもエラーを投げない", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendSlackWebhook("https://hooks.slack.com/test", { text: "test" })
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
  });
});
