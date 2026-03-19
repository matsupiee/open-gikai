import { publicProcedure } from "../../index";
import { municipalitiesListSchema } from "./_schemas";
import { listMunicipalities } from "./municipalities.service";

export const municipalitiesRouter = {
  list: publicProcedure
    .input(municipalitiesListSchema)
    .handler(({ input, context }) => listMunicipalities(context.db, input, context.session?.user?.role === "admin")),
};
