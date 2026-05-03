import * as jose from "jose";
import { env } from "./lib/env";

const googleJwks = jose.createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

export async function verifyGoogleCredential(credential: string): Promise<GoogleIdentity> {
  if (!env.googleClientId) {
    throw new Error("Google sign-in is not configured on the server.");
  }

  const { payload } = await jose.jwtVerify(credential, googleJwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.googleClientId,
  });

  const email = typeof payload.email === "string" ? payload.email : "";
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const emailVerified = payload.email_verified === true;

  if (!sub || !email || !emailVerified) {
    throw new Error("Google account verification failed.");
  }

  return {
    sub,
    email,
    emailVerified,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}
