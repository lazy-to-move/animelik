import { createRouter, publicQuery } from "./middleware";
import { getWeeklySchedule } from "./services/weekly-schedule";

export const scheduleRouter = createRouter({
  weekly: publicQuery.query(async () => getWeeklySchedule()),
});
