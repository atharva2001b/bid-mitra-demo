"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, ArrowDown, Upload, Loader2, Trash2 } from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Bid {
  bid_id: string
  bid_name: string
  pdf_path: string
  result: string
  tender_id: string
  created_at: string
  updated_at: string
}

interface Tender {
  tender_id: string
  name: string
}

interface BidWithTender extends Bid {
  tenderName?: string
  tenderId?: string
  aiEvaluation: string
  aiStatusColor: string
  status: string
  statusColor: string
  submittedDate: string
}

export default function BidsPage() {
  const [bids, setBids] = useState<BidWithTender[]>([])
  const [loading, setLoading] = useState(true)
  const [tenders, setTenders] = useState<Record<string, Tender>>({})
  const [deletingBidId, setDeletingBidId] = useState<string | null>(null)

  useEffect(() => {
    fetchBids()
    fetchTenders()
  }, [])

  const fetchTenders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tenders`)
      if (response.ok) {
        const data = await response.json()
        const tendersMap: Record<string, Tender> = {}
        data.tenders?.forEach((tender: Tender) => {
          tendersMap[tender.tender_id] = tender
        })
        setTenders(tendersMap)
      }
    } catch (error) {
      console.error("Error fetching tenders:", error)
    }
  }

  const fetchBids = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/bids`)
      if (response.ok) {
        const data = await response.json()
        const bidsData: Bid[] = data.bids || []
        
        // Map bids to include tender information and formatted data
        const mappedBids: BidWithTender[] = bidsData.map((bid) => {
          const tender = bid.tender_id ? tenders[bid.tender_id] : null
          const resultJson = JSON.parse(bid.result || "{}")
          
          // Determine AI evaluation status
          const hasResult = resultJson && Object.keys(resultJson).length > 0
          const aiEvaluation = hasResult ? "Done" : "Pending"
          const aiStatusColor = hasResult ? "bg-green-500" : "bg-yellow-500"
          
          // Determine status (simplified - can be enhanced based on result structure)
          const status = hasResult ? "Submitted" : "Not validated"
          const statusColor = hasResult 
            ? "bg-green-100 text-green-800" 
            : "bg-yellow-100 text-yellow-800"
          
          // Format date
          const date = new Date(bid.created_at)
          const submittedDate = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })
          
          return {
            ...bid,
            tenderName: tender?.name || "N/A",
            tenderId: bid.tender_id || "",
            aiEvaluation,
            aiStatusColor,
            status,
            statusColor,
            submittedDate
          }
        })
        
        setBids(mappedBids)
      } else {
        console.error("Failed to fetch bids:", await response.text())
      }
    } catch (error) {
      console.error("Error fetching bids:", error)
    } finally {
      setLoading(false)
    }
  }

  // Refetch bids when tenders are loaded (to update tender names)
  useEffect(() => {
    if (Object.keys(tenders).length > 0) {
      fetchBids()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenders])

  const handleDeleteBid = async (bidId: string) => {
    if (!confirm("Are you sure you want to delete this bid? This action cannot be undone.")) {
      return
    }

    try {
      setDeletingBidId(bidId)
      const response = await fetch(`${API_BASE_URL}/bids/${bidId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Refresh bids list
        await fetchBids()
      } else {
        const errorText = await response.text()
        alert(`Failed to delete bid: ${errorText}`)
      }
    } catch (error) {
      console.error("Error deleting bid:", error)
      alert("An error occurred while deleting the bid")
    } finally {
      setDeletingBidId(null)
    }
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bids</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading..." : `${bids.length} ${bids.length === 1 ? "Bid" : "Bids"}`}
            </p>
          </div>
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Bid
          </Button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search bids..." className="pl-10" />
          </div>
        </div>

        {/* Bids Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sr. No</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      Name <ArrowDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Tender</TableHead>
                  <TableHead>Bid Amount</TableHead>
                  <TableHead>Submitted Date</TableHead>
                  <TableHead>AI Evaluation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="mt-2 text-sm text-muted-foreground">Loading bids...</p>
                    </TableCell>
                  </TableRow>
                ) : bids.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No bids found. Upload your first bid to get started.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  bids.map((bid, index) => (
                    <TableRow key={bid.bid_id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Link
                          href={`/bids/${bid.bid_id}`}
                          className="font-medium hover:text-primary"
                        >
                          {bid.bid_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {bid.tenderId ? (
                          <div>
                            <Link
                              href={`/tenders/${bid.tenderId}`}
                              className="text-sm hover:text-primary"
                            >
                              {bid.tenderName || "N/A"}
                            </Link>
                            <div className="text-xs text-muted-foreground">{bid.tenderId.slice(0, 8)}...</div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No tender linked</span>
                        )}
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>{bid.submittedDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${bid.aiStatusColor}`} />
                          <span className="text-sm">{bid.aiEvaluation}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={bid.statusColor}>{bid.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/bids/${bid.bid_id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            View
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBid(bid.bid_id)}
                            disabled={deletingBidId === bid.bid_id}
                            title="Delete bid"
                          >
                            {deletingBidId === bid.bid_id ? (
                              <Loader2 className="h-4 w-4 text-red-500 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-500" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Page 1 of 1</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              ← Previous
            </Button>
            <Button variant="outline" size="sm" className="bg-primary/10">
              1
            </Button>
            <Button variant="outline" size="sm">
              Next →
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
