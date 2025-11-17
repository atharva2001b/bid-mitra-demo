import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"

export default function AccountPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">My Account</h1>
        <Card className="p-6">
          <p className="text-muted-foreground">Account settings will be shown here</p>
        </Card>
      </div>
    </AppLayout>
  )
}


