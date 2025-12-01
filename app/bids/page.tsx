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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Trash2 } from "lucide-react"
import mockBids from "@/data/mock-bids.json"

interface Bid {
  bid_id: string
  bid_name: string
  pdf_path: string
  tender_id?: string
}

function BidsListContent() {
  const router = useRouter()
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bidToDelete, setBidToDelete] = useState<Bid | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchBids()
  }, [])

  const fetchBids = async () => {
    try {
      setLoading(true)
      // Use mock data instead of API call
      const data = mockBids
      setBids(data.bids || [])
    } catch (error) {
      console.error("Error loading bids:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (bid: Bid, e: React.MouseEvent) => {
    e.stopPropagation()
    setBidToDelete(bid)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!bidToDelete) return

    try {
      setDeleting(true)
      // In demo mode, just remove from local state
      setBids(bids.filter((b) => b.bid_id !== bidToDelete.bid_id))
      setDeleteDialogOpen(false)
      setBidToDelete(null)
    } catch (error) {
      console.error("Error deleting bid:", error)
      alert("Failed to delete bid. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Bids Review</h1>
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
                        router.push(`/bids/${b.bid_id}`)
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
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-200 hover:bg-slate-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/bids/${b.bid_id}`)
                            }}
                          >
                            Open
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={(e) => handleDeleteClick(b, e)}
                          >
                            <Trash2 className="h-4 w-4" />
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Bid</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{bidToDelete?.bid_name}"? This action cannot be undone and will permanently delete the bid and all associated data.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setBidToDelete(null)
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

export default function BidsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    }>
      <BidsListContent />
    </Suspense>
  )
}





