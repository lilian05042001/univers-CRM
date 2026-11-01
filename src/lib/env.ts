// Variabilele publice trebuie referite literal ca Next să le includă în bundle-ul client.
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Lipsește variabila de mediu ${name} (vezi .env.example)`)
  return value
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
}
