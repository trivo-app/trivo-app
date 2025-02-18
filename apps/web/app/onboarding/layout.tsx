import { getUserWithDetailsQuery } from "@trivo/supabase/get-user-with-details";
import { createClient } from "@trivo/supabase/server";
import { redirect } from "next/navigation";

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  const supabase = await createClient();
  const user = await getUserWithDetailsQuery(supabase);

  if (!user) {
    return redirect("/login");
  }

  if (
    user.userDetails[0].onboarded === true &&
    user.userDetails[0].organization_id !== null
  ) {
    return redirect("/home");
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-b from-card/100 to-background/60">
      {children}
    </div>
  );
}
