import { redirect } from "next/navigation";
import { AuthScreen } from "../../components/AuthScreen";
import { getCurrentSession } from "../../lib/server-api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign Up",
  description:
    "Create a Synx account from the migration frontend to save your library and progress.",
};

export default async function SignUpPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/watchlist");
  }

  return <AuthScreen mode="signup" />;
}
