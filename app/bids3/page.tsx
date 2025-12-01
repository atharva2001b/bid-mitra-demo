"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2 } from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Bid {
  bid_id: string
  bid_name: string
  pdf_path: string
  tender_id?: string
}

function Bids3ListContent() {
  const router = useRouter()
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBids()
  }, [])

  const fetchBids = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/bids`)
      if (response.ok) {
        const data = await response.json()
        setBids(data.bids || [])
      }
    } catch (error) {
      console.error("Error fetching bids:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Bids Validation</h1>
          <p className="text-sm text-slate-500 mt-1">
            {bids.length} {bids.length === 1 ? "Bid" : "Bids"} available
          </p>
        </div>

        {/* Bids Table */}
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-700">Sr. No</TableHead>
                  <TableHead className="font-semibold text-slate-700">Name</TableHead>
                  <TableHead className="font-semibold text-slate-700">Bid ID</TableHead>
                  <TableHead className="font-semibold text-slate-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                      <p className="mt-2 text-sm text-slate-500">Loading bids...</p>
                    </TableCell>
                  </TableRow>
                ) : bids.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12">
                      <p className="text-sm text-slate-500">No bids found. Upload your first bid to get started.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  bids.map((b, index) => (
                    <TableRow 
                      key={b.bid_id} 
                      className="cursor-pointer hover:bg-slate-50/50 transition-colors border-b border-slate-100"
                      onClick={() => {
                        router.push(`/bids3/${b.bid_id}`)
                      }}
                    >
                      <TableCell className="text-slate-600">{index + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{b.bid_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-500 font-mono">{b.bid_id}</div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-200 hover:bg-slate-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/bids3/${b.bid_id}`)
                          }}
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

export default function Bids3Page() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    }>
      <Bids3ListContent />
    </Suspense>
  )
}










