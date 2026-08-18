import { Icon, addCollection } from '@iconify/react'

addCollection({ prefix: 'local', icons: {} })

export function AppIcon() {
  return <Icon icon="local:ic-menu" />
}
