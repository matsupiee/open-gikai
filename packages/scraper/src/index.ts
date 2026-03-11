export type { MeetingData, Logger, LocalScraperTarget, NdlScraperConfig, KagoshimaScraperConfig, LocalScraperConfig } from "./types";
export { scrapeNdl } from "./scrapers/ndl";
export { scrapeKagoshima } from "./scrapers/kagoshima";
export { scrapeLocal } from "./scrapers/local";
