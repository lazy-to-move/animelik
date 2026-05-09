import { createRouter, publicQuery } from "./middleware";
import {
  authCredentialsSchema,
  getSessionUser,
  googleSignInSchema,
  logoutSession,
  signInWithCredentials,
  signInWithGoogleCredential,
  signUpSchema,
  signUpWithCredentials,
} from "./services/auth-service";

export const authRouter = createRouter({
  signUp: publicQuery.input(signUpSchema).mutation(async ({ ctx, input }) => {
    try {
      await signUpWithCredentials({
        reqHeaders: ctx.req.headers,
        resHeaders: ctx.resHeaders,
        name: input.name,
        email: input.email,
        password: input.password,
      });

      return { success: true };
    } catch (err: unknown) {
      console.error("Sign up error:", err);
      throw new Error(err instanceof Error ? err.message : "Sign up failed");
    }
  }),

  signIn: publicQuery.input(authCredentialsSchema).mutation(async ({ ctx, input }) => {
    try {
      await signInWithCredentials({
        reqHeaders: ctx.req.headers,
        resHeaders: ctx.resHeaders,
        email: input.email,
        password: input.password,
      });

      return { success: true };
    } catch (err: unknown) {
      console.error("Sign in error:", err);
      throw new Error(err instanceof Error ? err.message : "Sign in failed");
    }
  }),

  googleSignIn: publicQuery.input(googleSignInSchema).mutation(async ({ ctx, input }) => {
    try {
      await signInWithGoogleCredential({
        reqHeaders: ctx.req.headers,
        resHeaders: ctx.resHeaders,
        credential: input.credential,
      });

      return { success: true };
    } catch (err: unknown) {
      console.error("Google sign-in error:", err);
      throw new Error(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }),

  me: publicQuery.query(async ({ ctx }) => getSessionUser(ctx.req.headers)),
  logout: publicQuery.mutation(async ({ ctx }) => {
    return logoutSession({
      reqHeaders: ctx.req.headers,
      resHeaders: ctx.resHeaders,
    });
  }),
});
