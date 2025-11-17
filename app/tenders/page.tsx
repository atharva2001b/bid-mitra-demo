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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Tender {
  tender_id: string
  name: string
  pdf_path: string
  evaluation_criteria_json: string
  bid_ids: string
  created_at: string
  updated_at: string
}

export default function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([])
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

  // Fetch tenders from API
  useEffect(() => {
    fetchTenders()
  }, [])

  const fetchTenders = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/tenders`)
      if (response.ok) {
        const data = await response.json()
        setTenders(data.tenders || [])
      } else {
        console.error("Failed to fetch tenders:", await response.text())
      }
    } catch (error) {
      console.error("Error fetching tenders:", error)
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
      
      const url = `${API_BASE_URL}/tenders/${tenderToDelete.id}?delete_bids=${deleteBidsOption}`
      const response = await fetch(url, {
        method: "DELETE",
      })

      if (response.ok) {
        const result = await response.json()
        // Refresh tenders list
        await fetchTenders()
        
        // Show success message
        if (deleteBidsOption && result.deleted_bids_count > 0) {
          alert(`Tender and ${result.deleted_bids_count} associated bids deleted successfully.`)
        } else {
          alert("Tender deleted successfully.")
        }
      } else {
        const errorText = await response.text()
        alert(`Failed to delete tender: ${errorText}`)
      }
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
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("name", uploadName.trim())

      const response = await fetch(`${API_BASE_URL}/tenders/upload`, {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        console.log("Tender uploaded successfully:", data)
        // Reset form
        setUploadName("")
        setUploadFile(null)
        setIsUploadDialogOpen(false)
        // Refresh tenders list
        await fetchTenders()
      } else {
        const errorText = await response.text()
        setUploadError(errorText || "Failed to upload tender")
      }
    } catch (error) {
      console.error("Error uploading tender:", error)
      setUploadError("An error occurred while uploading the tender")
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
  const stats = {
    newTenders: tenders.filter(t => {
      const criteria = JSON.parse(t.evaluation_criteria_json || "{}")
      return Object.keys(criteria).length === 0
    }).length,
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
                <CardTitle className="text-sm font-medium">NEW TENDERS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1</div>
                <p className="text-xs text-muted-foreground">Recently uploaded</p>
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

