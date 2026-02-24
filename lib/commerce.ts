import { Commerce } from './commerce-client'

let instance: Commerce | null = null

export function getCommerce(commerceUrl: string, token?: string): Commerce {
  if (!instance) {
    instance = new Commerce({ commerceUrl, token })
  }
  if (token) {
    instance.setToken(token)
  }
  return instance
}
