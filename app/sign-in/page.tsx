import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string; email?: string }> }) {
  const params = await searchParams
  const redirectTo = params.redirectTo?.startsWith("/") && !params.redirectTo.startsWith("//") ? params.redirectTo : undefined
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect(redirectTo ?? "/")
  return <AuthForm mode="sign-in" redirectTo={redirectTo} initialEmail={params.email} />
}
