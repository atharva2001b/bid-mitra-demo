"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Loader2 } from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Tender {
  tender_id: string
  name: string
  evaluation_criteria_json: string
  bid_ids: string
  created_at: string
}

interface Bid {
  bid_id: string
  bid_name: string
  result: string
  created_at: string
}

export default function DashboardPage() {
  const [tenders, setTenders] = useState<Tender[]>([])
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [tendersResponse, bidsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/tenders`),
        fetch(`${API_BASE_URL}/bids`)
      ])

      if (tendersResponse.ok) {
        const tendersData = await tendersResponse.json()
        setTenders(tendersData.tenders || [])
      }

      if (bidsResponse.ok) {
        const bidsData = await bidsResponse.json()
        setBids(bidsData.bids || [])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics
  // Helper function to check if a bid is evaluated
  const isBidEvaluated = (bidId: string): boolean => {
    const bid = bids.find(b => b.bid_id === bidId)
    if (!bid) return false
    try {
      const result = JSON.parse(bid.result || "{}")
      return result && Object.keys(result).length > 0
    } catch {
      return false
    }
  }

  // CLOSED TENDERS: Tenders that have bids AND all bids are evaluated (none pending)
  const closedTenders = tenders.filter(t => {
    const bidIds = JSON.parse(t.bid_ids || "[]")
    if (bidIds.length === 0) return false // No bids = not closed
    // All bids must be evaluated for tender to be closed
    return bidIds.every((bidId: string) => isBidEvaluated(bidId))
  }).length

  // ACTIVE TENDERS: Tenders that have no bids OR have at least one pending bid
  const activeTenders = tenders.filter(t => {
    const bidIds = JSON.parse(t.bid_ids || "[]")
    if (bidIds.length === 0) return true // No bids = active
    // If any bid is pending, tender is active
    return bidIds.some((bidId: string) => !isBidEvaluated(bidId))
  }).length
  
  const evaluatedBids = bids.filter(bid => {
    try {
      const result = JSON.parse(bid.result || "{}")
      return result && Object.keys(result).length > 0
    } catch {
      return false
    }
  }).length

  const newTenders = tenders.filter(t => {
    const criteria = JSON.parse(t.evaluation_criteria_json || "{}")
    return Object.keys(criteria).length === 0
  }).length

  const underAnalysis = tenders.filter(t => {
    const criteria = JSON.parse(t.evaluation_criteria_json || "{}")
    const bidIds = JSON.parse(t.bid_ids || "[]")
    return Object.keys(criteria).length > 0 && bidIds.length === 0
  }).length

  const pending = tenders.filter(t => {
    const criteria = JSON.parse(t.evaluation_criteria_json || "{}")
    return Object.keys(criteria).length === 0
  }).length

  const evaluatedTenders = tenders.filter(t => {
    const bidIds = JSON.parse(t.bid_ids || "[]")
    return bidIds.length > 0
  }).length

  // Get recently opened documents (tenders and bids sorted by updated_at)
  const recentDocuments = [
    ...tenders.map(t => ({
      id: t.tender_id,
      name: t.name,
      type: "Tender" as const,
      date: new Date(t.created_at),
      status: (() => {
        const criteria = JSON.parse(t.evaluation_criteria_json || "{}")
        const bidIds = JSON.parse(t.bid_ids || "[]")
        if (Object.keys(criteria).length === 0) return "Pending"
        if (bidIds.length === 0) return "Pending"
        return "Completed"
      })(),
      statusColor: (() => {
        const criteria = JSON.parse(t.evaluation_criteria_json || "{}")
        const bidIds = JSON.parse(t.bid_ids || "[]")
        if (Object.keys(criteria).length === 0) return "bg-yellow-100 text-yellow-800"
        if (bidIds.length === 0) return "bg-yellow-100 text-yellow-800"
        return "bg-green-100 text-green-800"
      })()
    })),
    ...bids.map(b => ({
      id: b.bid_id,
      name: b.bid_name,
      type: "Bid" as const,
      date: new Date(b.created_at),
      status: (() => {
        try {
          const result = JSON.parse(b.result || "{}")
          return result && Object.keys(result).length > 0 ? "Completed" : "Pending"
        } catch {
          return "Pending"
        }
      })(),
      statusColor: (() => {
        try {
          const result = JSON.parse(b.result || "{}")
          return result && Object.keys(result).length > 0 
            ? "bg-green-100 text-green-800" 
            : "bg-yellow-100 text-yellow-800"
        } catch {
          return "bg-yellow-100 text-yellow-800"
        }
      })()
    }))
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10)

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Hi Mr. Shivaji Jadhav!</h1>
          <p className="mt-1 text-slate-500">Find this month&apos;s overview below</p>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">CLOSED TENDERS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight text-slate-900">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : closedTenders}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">ACTIVE TENDERS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight text-slate-900">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : activeTenders}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Bid pages done</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight text-slate-900">939
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">EVALUATED BIDS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight text-slate-900">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Tenders */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Pipeline Tenders</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">OPEN TENDERS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight text-slate-900">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : activeTenders}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">UNDER AI ANALYSIS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight text-slate-900">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : underAnalysis}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">PENDING</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight text-slate-900">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : pending}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">EVALUATED TENDERS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight text-slate-900">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : evaluatedTenders -1}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recently Opened Documents */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Recently opened Documents</h2>
              <p className="text-sm text-slate-500">
                Bids as well as tenders at your fingertips
              </p>
            </div>
            <div className="flex gap-4 text-sm text-blue-600">
              <a href="/tenders" className="hover:underline hover:text-blue-700">
                See All Tenders <ArrowRight className="inline h-4 w-4" />
              </a>
              <a href="/bids" className="hover:underline hover:text-blue-700">
                See All Bids <ArrowRight className="inline h-4 w-4" />
              </a>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading documents...</p>
                </div>
              ) : recentDocuments.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No documents found.</p>
                </div>
              ) : (
              <div className="divide-y divide-slate-200">
                  {recentDocuments.map((doc) => (
                    <Link
                    key={doc.id}
                      href={doc.type === "Tender" ? `/tenders/${doc.id}` : `/bids/${doc.id}`}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          doc.status === "Completed"
                            ? "bg-green-500"
                            : doc.status === "Pending"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                      />
                      <div>
                        <div className="font-medium text-slate-900">
                            {doc.id.slice(0, 8)}... - {doc.name}
                        </div>
                        <div className="text-sm text-slate-500">
                            {doc.date.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })} • {doc.type}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${doc.statusColor}`}
                      >
                        {doc.status}
                      </span>
                    </div>
                    </Link>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}


