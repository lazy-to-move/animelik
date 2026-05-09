import { redirect } from "next/navigation";
import { AuthScreen } from "../../components/AuthScreen";
import { getCurrentSession } from "../../lib/server-api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign In",
  description: "Sign in to access your Synx account from the migration frontend.",
};

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/watchlist");
  }

  return <AuthScreen mode="signin" />;
}
