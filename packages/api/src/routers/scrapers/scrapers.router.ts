import { publicProcedure as protectedProcedure } from "../../index";
import {
  scrapersListJobsSchema,
  scrapersCreateJobSchema,
  scrapersGetJobSchema,
  scrapersCancelJobSchema,
  scrapersGetJobLogsSchema,
  scrapersListMunicipalitiesSchema,
} from "./_schemas";
import {
  listJobs,
  createJob,
  getJob,
  cancelJob,
  getJobLogs,
  listMunicipalities,
} from "./scrapers.service";

export const scrapersRouter = {
  listJobs: protectedProcedure
    .input(scrapersListJobsSchema)
    .handler(({ input, context }) => listJobs(context.db, input)),

  createJob: protectedProcedure
    .input(scrapersCreateJobSchema)
    .handler(({ input, context }) => createJob(context.db, input)),

  getJob: protectedProcedure
    .input(scrapersGetJobSchema)
    .handler(({ input, context }) => getJob(context.db, input)),

  cancelJob: protectedProcedure
    .input(scrapersCancelJobSchema)
    .handler(({ input, context }) => cancelJob(context.db, input)),

  getJobLogs: protectedProcedure
    .input(scrapersGetJobLogsSchema)
    .handler(({ input, context }) => getJobLogs(context.db, input)),

  listMunicipalities: protectedProcedure
    .input(scrapersListMunicipalitiesSchema)
    .handler(({ input, context }) => listMunicipalities(context.db, input)),
};
