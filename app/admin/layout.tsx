import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { isAdminEmail } from "@/lib/admin"
import { AdminLayout } from "@/components/admin/admin-layout"

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")
  if (!isAdminEmail(session.user.email)) redirect("/")

  return <AdminLayout>{children}</AdminLayout>
}
