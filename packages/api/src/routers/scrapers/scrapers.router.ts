import { publicProcedure as protectedProcedure } from "../../index";
import {
  scrapersListJobsSchema,
  scrapersCreateJobSchema,
  scrapersGetJobSchema,
  scrapersCancelJobSchema,
  scrapersGetJobLogsSchema,
} from "./_schemas";
import { listJobs, createJob, getJob, cancelJob, getJobLogs } from "./scrapers.service";

export const scrapersRouter = {
  listJobs: protectedProcedure
    .input(scrapersListJobsSchema)
    .handler(({ input }) => listJobs(input)),

  createJob: protectedProcedure
    .input(scrapersCreateJobSchema)
    .handler(({ input }) => createJob(input)),

  getJob: protectedProcedure
    .input(scrapersGetJobSchema)
    .handler(({ input }) => getJob(input)),

  cancelJob: protectedProcedure
    .input(scrapersCancelJobSchema)
    .handler(({ input }) => cancelJob(input)),

  getJobLogs: protectedProcedure
    .input(scrapersGetJobLogsSchema)
    .handler(({ input }) => getJobLogs(input)),
};
