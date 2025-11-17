"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    // Clear auth token cookie
    document.cookie = "auth_token=; path=/; max-age=0; SameSite=Lax"
    // Redirect to login
    router.push("/login")
    router.refresh()
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Logging out...</p>
      </div>
    </div>
  )
}

