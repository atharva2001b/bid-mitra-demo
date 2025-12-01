"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { ArrowUp, Search, ArrowDown, Info, Upload, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import mockBids from "@/data/mock-bids.json"
import mockTender from "@/data/mock-tender.json"

interface Tender {
  tender_id: string
  name: string
  pdf_path: string
  evaluation_criteria_json: string
  bid_ids: string
  created_at: string
  updated_at: string
}

interface Bid {
  bid_id: string
  bid_name: string
  result: string
  created_at: string
}

export default function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([])
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploadName, setUploadName] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingTenderId, setDeletingTenderId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tenderToDelete, setTenderToDelete] = useState<{ id: string; name: string; bidCount: number } | null>(null)
  const [deleteBidsOption, setDeleteBidsOption] = useState<boolean>(false)

  // Fetch tenders and bids from API
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Use mock data instead of API calls
      setTenders([mockTender as Tender])
      setBids(mockBids.bids as Bid[])
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTenders = async () => {
    try {
      setLoading(true)
      // Use mock data instead of API call
      setTenders([mockTender as Tender])
    } catch (error) {
      console.error("Error loading tenders:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (tender: Tender) => {
    const bidIds = JSON.parse(tender.bid_ids || "[]")
    setTenderToDelete({
      id: tender.tender_id,
      name: tender.name,
      bidCount: bidIds.length
    })
    setDeleteBidsOption(false)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!tenderToDelete) return

    // Second confirmation - critical action
    const confirmMessage = tenderToDelete.bidCount > 0
      ? (deleteBidsOption
          ? `⚠️ FINAL CONFIRMATION: This will PERMANENTLY DELETE the tender "${tenderToDelete.name}" AND ALL ${tenderToDelete.bidCount} associated bids. This action CANNOT be undone. Are you absolutely sure?`
          : `⚠️ FINAL CONFIRMATION: This will PERMANENTLY DELETE the tender "${tenderToDelete.name}". The ${tenderToDelete.bidCount} associated bids will remain but will be unlinked. This action CANNOT be undone. Are you absolutely sure?`)
      : `⚠️ FINAL CONFIRMATION: This will PERMANENTLY DELETE the tender "${tenderToDelete.name}". This action CANNOT be undone. Are you absolutely sure?`

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      setDeletingTenderId(tenderToDelete.id)
      setDeleteDialogOpen(false)
      
      // In demo mode, just remove from local state
      setTenders(tenders.filter((t) => t.tender_id !== tenderToDelete.id))
      if (deleteBidsOption) {
        // Also remove associated bids
        const bidIds = JSON.parse(mockTender.bid_ids || "[]")
        setBids(bids.filter((b) => !bidIds.includes(b.bid_id)))
      }
      alert("Tender deleted successfully (demo mode).")
    } catch (error) {
      console.error("Error deleting tender:", error)
      alert("An error occurred while deleting the tender")
    } finally {
      setDeletingTenderId(null)
      setTenderToDelete(null)
      setDeleteBidsOption(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type !== "application/pdf") {
        setUploadError("Please select a PDF file")
        return
      }
      setUploadFile(file)
      setUploadError(null)
      // Auto-fill name from filename if name is empty
      if (!uploadName && file.name) {
        setUploadName(file.name.replace(/\.pdf$/i, ""))
      }
    }
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) {
      setUploadError("Please provide both a file and a name")
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      // In independent/demo mode, uploads are not supported
      // Show a message instead
      alert("Upload functionality is not available in independent frontend mode. This is a demo version with mock data.")
      setUploadName("")
      setUploadFile(null)
      setIsUploadDialogOpen(false)
    } catch (error) {
      console.error("Error uploading tender:", error)
      setUploadError("Uploads are not supported in demo mode")
    } finally {
      setUploading(false)
    }
  }

  // Helper to get status from tender data
  const getTenderStatus = (tender: Tender) => {
    const bidIds = JSON.parse(tender.bid_ids || "[]")
    const criteria = JSON.parse(tender.evaluation_criteria_json || "{}")
    
    if (Object.keys(criteria).length === 0) {
      return {
        status: "Pending",
        statusColor: "bg-yellow-100 text-yellow-800",
        statusDot: "bg-yellow-500",
        comments: "Uploaded - awaiting criteria setup",
      }
    }
    
    if (bidIds.length === 0) {
      return {
        status: "AI Analysis",
        statusColor: "bg-purple-100 text-purple-800",
        statusDot: "bg-purple-500",
        comments: "Criteria set - awaiting bids",
      }
    }
    
    return {
      status: "Active",
      statusColor: "bg-green-100 text-green-800",
      statusDot: "bg-green-500",
      comments: "Evaluating bids",
      evaluatedBids: 0,
      totalBids: bidIds.length,
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

  // OPEN TENDERS: Tenders that have no bids OR have at least one pending bid (same as activeTenders in dashboard)
  const openTenders = tenders.filter(t => {
    const bidIds = JSON.parse(t.bid_ids || "[]")
    if (bidIds.length === 0) return true // No bids = open
    // If any bid is pending, tender is open
    return bidIds.some((bidId: string) => !isBidEvaluated(bidId))
  }).length

  const stats = {
    openTenders,
    underAnalysis: tenders.filter(t => {
      const criteria = JSON.parse(t.evaluation_criteria_json || "{}")
      const bidIds = JSON.parse(t.bid_ids || "[]")
      return Object.keys(criteria).length > 0 && bidIds.length === 0
    }).length,
    pending: tenders.filter(t => {
      const criteria = JSON.parse(t.evaluation_criteria_json || "{}")
      return Object.keys(criteria).length === 0
    }).length,
    evaluated: tenders.filter(t => {
      const bidIds = JSON.parse(t.bid_ids || "[]")
      return bidIds.length > 0
    }).length,
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Overview Cards */}
        <div className="mb-8">
          <h1 className="mb-6 text-2xl font-bold">Overview</h1>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">OPEN TENDERS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.openTenders}
                </div>
                <p className="text-xs text-muted-foreground">Accepting bids</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">UNDER AI ANALYSIS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.underAnalysis}</div>
                <p className="text-xs text-muted-foreground">Awaiting bids</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">PENDING</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pending}</div>
                <p className="text-xs text-muted-foreground">Awaiting criteria</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">EVALUATED TENDERS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">With bids</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tenders List */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Tenders</h2>
              <p className="text-sm text-muted-foreground">
                showing {tenders.length} {tenders.length === 1 ? "Tender" : "Tenders"}
              </p>
            </div>
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Tender
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload New Tender</DialogTitle>
                  <DialogDescription>
                    Upload a PDF file for a new tender. Evaluation criteria and bid IDs can be added later.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="tender-name" className="text-sm font-medium">
                      Tender Name
                    </label>
                    <Input
                      id="tender-name"
                      placeholder="Enter tender name"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      disabled={uploading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tender-file" className="text-sm font-medium">
                      PDF File
                    </label>
                    <Input
                      id="tender-file"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      disabled={uploading}
                    />
                    {uploadFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {uploadFile.name}
                      </p>
                    )}
                  </div>
                  {uploadError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {uploadError}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsUploadDialogOpen(false)
                      setUploadName("")
                      setUploadFile(null)
                      setUploadError(null)
                    }}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadName.trim()}>
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Type to search"
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sr. No.</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Name <ArrowDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Status <ArrowDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Cost put to Tender (L) <Info className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Evaluated Bids / Total Bids <Info className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Comments <Info className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        <p className="mt-2 text-sm text-muted-foreground">Loading tenders...</p>
                      </TableCell>
                    </TableRow>
                  ) : tenders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-sm text-muted-foreground">No tenders found. Upload your first tender to get started.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenders.map((tender, index) => {
                      const status = getTenderStatus(tender)
                      const bidIds = JSON.parse(tender.bid_ids || "[]")
                      return (
                        <TableRow key={tender.tender_id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <div>
                              <Link
                                href={`/tenders/${tender.tender_id}`}
                                className="font-medium hover:text-primary"
                              >
                                {tender.name}
                              </Link>
                              <div className="text-sm text-muted-foreground">{tender.tender_id.slice(0, 8)}...</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${status.statusDot}`}
                              />
                              <Badge className={status.statusColor}>{status.status}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>
                            {status.evaluatedBids !== undefined && status.totalBids !== undefined ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  {status.evaluatedBids}/{status.totalBids}
                                </span>
                                <div className="h-2 w-24 rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{
                                      width: `${(status.evaluatedBids / status.totalBids) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {status.comments}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(tender)}
                              disabled={deletingTenderId === tender.tender_id}
                              title="Delete tender"
                            >
                              {deletingTenderId === tender.tender_id ? (
                                <Loader2 className="h-4 w-4 text-red-500 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-red-500" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Page 1 of 10</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                ← Previous
              </Button>
              <Button variant="outline" size="sm" className="bg-primary/10">
                1
              </Button>
              <Button variant="outline" size="sm">
                2
              </Button>
              <Button variant="outline" size="sm">
                3
              </Button>
              <span className="px-2">...</span>
              <Button variant="outline" size="sm">
                8
              </Button>
              <Button variant="outline" size="sm">
                9
              </Button>
              <Button variant="outline" size="sm">
                10
              </Button>
              <Button variant="outline" size="sm">
                Next →
              </Button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Tender</DialogTitle>
              <DialogDescription>
                {tenderToDelete && (
                  <>
                    You are about to delete <strong>{tenderToDelete.name}</strong>.
                    {tenderToDelete.bidCount > 0 && (
                      <span className="block mt-2 text-amber-600">
                        ⚠️ This tender has {tenderToDelete.bidCount} associated {tenderToDelete.bidCount === 1 ? "bid" : "bids"}.
                      </span>
                    )}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {tenderToDelete && tenderToDelete.bidCount > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">What would you like to do with the associated bids?</p>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="deleteOption"
                        checked={!deleteBidsOption}
                        onChange={() => setDeleteBidsOption(false)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">
                        Delete tender only (bids will remain but be unlinked)
                      </span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="deleteOption"
                        checked={deleteBidsOption}
                        onChange={() => setDeleteBidsOption(true)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-red-600">
                        Delete tender AND all {tenderToDelete.bidCount} associated bids
                      </span>
                    </label>
                  </div>
                </div>
              )}
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">
                  ⚠️ <strong>Warning:</strong> This action cannot be undone. You will be asked to confirm again.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setTenderToDelete(null)
                  setDeleteBidsOption(false)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
              >
                Continue to Final Confirmation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

