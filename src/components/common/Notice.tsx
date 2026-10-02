import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="status">
      <CircleAlert size={17} className="shrink-0" />
      <span>{children}</span>
    </div>
  )
}
