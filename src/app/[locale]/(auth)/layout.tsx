import { AuthShell } from "@/modules/auth/components/auth-shell"

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return <AuthShell>{children}</AuthShell>
}
