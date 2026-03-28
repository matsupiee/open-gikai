const BLOCKED_UA_PATTERNS = [
  /python-requests/i,
  /scrapy/i,
  /wget/i,
  /httpx/i,
  /aiohttp/i,
  /node-fetch/i,
  /go-http-client/i,
  /java\//i,
  /libwww-perl/i,
  /apify/i,
  /postmanruntime/i,
  /insomnia/i,
  /curl/i,
  /okhttp/i,
  /axios/i,
  /guzzlehttp/i,
  /powershell/i,
  /httpclient/i,
  /GPTBot/i,
  /CCBot/i,
  /Google-Extended/i,
  /anthropic-ai/i,
  /ClaudeBot/i,
  /Bytespider/i,
  /Amazonbot/i,
  /Cohere-ai/i,
];

export function isBlockedBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return BLOCKED_UA_PATTERNS.some((pattern) => pattern.test(userAgent));
}
