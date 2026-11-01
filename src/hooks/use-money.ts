"use client"

import { useFormatter } from "next-intl"

/** Sume în moneda lead-ului, fără zecimale inutile: „12 500 MDL”. */
export function useMoney() {
  const format = useFormatter()
  return (value: number, currency: string) =>
    format.number(value, { style: "currency", currency, maximumFractionDigits: value % 1 ? 2 : 0 })
}
