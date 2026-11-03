import { getRequestConfig } from "next-intl/server"
import { locale as rootLocale } from "next/root-params"

import { defaultLocale, isLocale } from "./config"

// Componentele server citesc limba din segmentul rădăcină [locale]; route handlerele
// (unde next/root-params nu e disponibil) o transmit explicit: getTranslations({ locale, … }).
export default getRequestConfig(async ({ locale: explicit }) => {
  const requested = explicit ?? (await rootLocale())
  const locale = isLocale(requested) ? requested : defaultLocale

  return {
    locale,
    timeZone: "Europe/Chisinau",
    messages: (await import(`../../../messages/${locale}.json`)).default,
  }
})
