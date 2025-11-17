import { Suspense } from "react"
import { AppSidebar } from "./app-sidebar"
import { Loader2 } from "lucide-react"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense fallback={
        <div className="w-64 border-r bg-sidebar flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }>
        <AppSidebar />
      </Suspense>
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white">{children}</main>
    </div>
  )
}


