import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getTranslations } from "next-intl/server"
import { locale as rootLocale } from "next/root-params"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { locales } from "@/lib/i18n/config"

import "../globals.css"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app")
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("description"),
  }
}

// Limba e segmentul rădăcină (/ro, /en, /ru), adăugat intern de proxy: URL-urile rămân fără prefix,
// iar fiecare limbă are propriul shell prerandat.
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale()

  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <NextIntlClientProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-right" />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
