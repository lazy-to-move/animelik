import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  addWatchlistItemForUser,
  addWatchlistItemSchema,
  listWatchlistForUser,
  removeWatchlistItemForUser,
  updateWatchlistItemForUser,
  updateWatchlistItemSchema,
} from "./services/watchlist-service";

export const watchlistRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => listWatchlistForUser(ctx.user.id)),

  add: authedQuery
    .input(addWatchlistItemSchema)
    .mutation(async ({ ctx, input }) =>
      addWatchlistItemForUser(ctx.user.id, input),
    ),

  update: authedQuery
    .input(updateWatchlistItemSchema)
    .mutation(async ({ ctx, input }) =>
      updateWatchlistItemForUser(ctx.user.id, input),
    ),

  remove: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) =>
      removeWatchlistItemForUser(ctx.user.id, input.id),
    ),
});
