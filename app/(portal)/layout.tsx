import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import { initDb } from "@/lib/db-init";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await initDb();

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 bg-gray-50 overflow-auto pt-12 md:pt-0">{children}</main>
    </div>
  );
}
