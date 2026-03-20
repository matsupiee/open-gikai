import { adminProcedure } from "../../index";
import {
  scrapersListJobsSchema,
  scrapersCreateJobSchema,
  scrapersGetJobSchema,
  scrapersCancelJobSchema,
  scrapersGetJobLogsSchema,
  scrapersListMunicipalitiesSchema,
  scrapersReprocessStatementsSchema,
  scrapersProgressByPrefectureSchema,
  scrapersProgressByMunicipalitySchema,
  scrapersProgressByYearSchema,
} from "./_schemas";
import {
  listJobs,
  createJob,
  getJob,
  cancelJob,
  getJobLogs,
  listMunicipalities,
  reprocessStatements,
  progressByPrefecture,
  progressByMunicipality,
  progressByYear,
} from "./scrapers.service";

export const scrapersRouter = {
  listJobs: adminProcedure
    .input(scrapersListJobsSchema)
    .handler(({ input, context }) => listJobs(context.db, input)),

  createJob: adminProcedure
    .input(scrapersCreateJobSchema)
    .handler(({ input, context }) => createJob(context.db, input)),

  getJob: adminProcedure
    .input(scrapersGetJobSchema)
    .handler(({ input, context }) => getJob(context.db, input)),

  cancelJob: adminProcedure
    .input(scrapersCancelJobSchema)
    .handler(({ input, context }) => cancelJob(context.db, input)),

  getJobLogs: adminProcedure
    .input(scrapersGetJobLogsSchema)
    .handler(({ input, context }) => getJobLogs(context.db, input)),

  listMunicipalities: adminProcedure
    .input(scrapersListMunicipalitiesSchema)
    .handler(({ input, context }) => listMunicipalities(context.db, input)),

  reprocessStatements: adminProcedure
    .input(scrapersReprocessStatementsSchema)
    .handler(({ input, context }) => reprocessStatements(context.db, input)),

  progressByPrefecture: adminProcedure
    .input(scrapersProgressByPrefectureSchema)
    .handler(({ input, context }) => progressByPrefecture(context.db, input)),

  progressByMunicipality: adminProcedure
    .input(scrapersProgressByMunicipalitySchema)
    .handler(({ input, context }) => progressByMunicipality(context.db, input)),

  progressByYear: adminProcedure
    .input(scrapersProgressByYearSchema)
    .handler(({ input, context }) => progressByYear(context.db, input)),
};
