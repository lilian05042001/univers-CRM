import { notFound } from "next/navigation"

/** Orice cale necunoscută (după rescrierea /{limbă}/…) afișează pagina 404 a aplicației. */
export default function CatchAll() {
  notFound()
}
