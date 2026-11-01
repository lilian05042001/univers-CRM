import { AuthShell } from "@/modules/auth/components/auth-shell"

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <AuthShell>{children}</AuthShell>
}
