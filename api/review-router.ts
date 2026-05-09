import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import {
  createOrUpdateReviewForUser,
  createReviewSchema,
  deleteReviewForUser,
  listReviewsForAnime,
} from "./services/review-service";

export const reviewRouter = createRouter({
  list: publicQuery
    .input(z.object({ animeId: z.number() }))
    .query(async ({ input }) => listReviewsForAnime(input.animeId)),

  create: authedQuery
    .input(createReviewSchema)
    .mutation(async ({ ctx, input }) =>
      createOrUpdateReviewForUser(ctx.user.id, input),
    ),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) =>
      deleteReviewForUser({
        reviewId: input.id,
        userId: ctx.user.id,
        isAdmin: ctx.user.role === "admin",
      }),
    ),
});
