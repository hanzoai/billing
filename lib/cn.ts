import { twMerge } from 'tailwind-merge'

type ClassValue = string | number | bigint | boolean | null | undefined | ClassValue[]

export function cn(...inputs: ClassValue[]) {
  return twMerge(inputs.flat().filter(Boolean).join(' '))
}
