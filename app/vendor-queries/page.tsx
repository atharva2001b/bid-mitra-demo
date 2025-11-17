import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"

export default function VendorQueriesPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Vendor Queries</h1>
        <Card className="p-6">
          <p className="text-muted-foreground">Vendor queries will be shown here</p>
        </Card>
      </div>
    </AppLayout>
  )
}


