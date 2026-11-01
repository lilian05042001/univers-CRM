import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import type { NavKey } from "@/config/navigation"

/** `export const generateMetadata = moduleMetadata("leads")` — titlul paginii din i18n. */
export function moduleMetadata(key: NavKey) {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("nav")
    return { title: t(key) }
  }
}
