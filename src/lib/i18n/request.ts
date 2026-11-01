import { getRequestConfig } from "next-intl/server"

import { defaultLocale } from "./config"

// Limba e fixă (ro) până la Etapa 2; apoi se va citi din profilul utilizatorului.
export default getRequestConfig(async () => {
  const locale = defaultLocale

  return {
    locale,
    timeZone: "Europe/Chisinau",
    messages: (await import(`../../../messages/${locale}.json`)).default,
  }
})
