"use client"

import { useState, useEffect, Suspense } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Tender {
  tender_id: string
  name: string
  bid_ids: string
}

interface Bid {
  bid_id: string
  bid_name: string
  pdf_path: string
}

function ReportsContent() {
  const searchParams = useSearchParams()
  const tenderIdParam = searchParams.get("tender")
  const [tenders, setTenders] = useState<Tender[]>([])
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(tenderIdParam)
  const [bids, setBids] = useState<Bid[]>([])
  const [loadingTenders, setLoadingTenders] = useState(true)
  const [loadingBids, setLoadingBids] = useState(false)
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null)

  useEffect(() => {
    fetchTenders()
  }, [])

  useEffect(() => {
    if (selectedTenderId) {
      fetchBids(selectedTenderId)
    } else {
      // When no tender is selected, fetch all bids from all tenders
      fetchAllBids()
    }
  }, [selectedTenderId])

  const fetchAllBids = async () => {
    setLoadingBids(true)
    try {
      const response = await fetch(`${API_BASE_URL}/bids`)
      if (response.ok) {
        const data = await response.json()
        setBids(data.bids || [])
      } else {
        setBids([])
      }
    } catch (error) {
      console.error("Error fetching all bids:", error)
      setBids([])
    } finally {
      setLoadingBids(false)
    }
  }

  const fetchTenders = async () => {
    try {
      setLoadingTenders(true)
      const response = await fetch(`${API_BASE_URL}/tenders`)
      if (response.ok) {
        const data = await response.json()
        setTenders(data.tenders || [])
        if (tenderIdParam && !selectedTenderId) {
          setSelectedTenderId(tenderIdParam)
        }
      }
    } catch (error) {
      console.error("Error fetching tenders:", error)
    } finally {
      setLoadingTenders(false)
    }
  }

  const fetchBids = async (tenderId: string) => {
    setLoadingBids(true)
    try {
      const tenderResponse = await fetch(`${API_BASE_URL}/tenders/${tenderId}`)
      if (tenderResponse.ok) {
        const tender = await tenderResponse.json()
        const bidIds = JSON.parse(tender.bid_ids || "[]")
        
        if (bidIds.length > 0) {
          const bidsPromises = bidIds.map(async (bidId: string) => {
            try {
              const response = await fetch(`${API_BASE_URL}/bids/${bidId}`)
              if (response.ok) {
                return await response.json()
              }
              return null
            } catch (err) {
              console.error(`Error fetching bid ${bidId}:`, err)
              return null
            }
          })
          
          const bidsData = await Promise.all(bidsPromises)
          const validBids = bidsData.filter(bid => bid !== null && !bid.error)
          setBids(validBids)
        } else {
          setBids([])
        }
      }
    } catch (error) {
      console.error("Error fetching bids:", error)
      setBids([])
    } finally {
      setLoadingBids(false)
    }
  }

  const getReportData = (bid: Bid) => {
    const bidNameLower = (bid.bid_name || "").toLowerCase()
    const bidIdLower = (bid.bid_id || "").toLowerCase()
    const isAbhiraj = (bidNameLower.includes("abhiraj") || bidIdLower.includes("abhiraj")) && !bidNameLower.includes("shraddha") && !bidNameLower.includes("shankar")
    const isShankar = bidNameLower.includes("shankar") || bidNameLower.includes("sambhaji") || bidNameLower.includes("jadhav") || bidIdLower.includes("shankar")
    
    if (!isAbhiraj && !isShankar) {
      return null
    }

    return isAbhiraj ? {
      bidderName: "ABHIRAJ ENGICON PVT LTD",
      criteria: [
        {
          srNo: "1",
          criteria: "Annual Turnover (updated to current year)",
          unit: "Rs lakhs",
          requirement: "3106.13",
          bidderValue: "9993",
          result: "Qualified"
        },
        {
          srNo: "2",
          criteria: "Bid Capacity = (AxNx2) – B",
          unit: "Rs lakhs",
          requirement: "8283.00",
          bidderValue: "24232.902",
          result: "Qualified"
        },
        {
          srNo: "3",
          criteria: "Completed Similar type of work",
          unit: "Rs lakhs",
          requirement: "2484.90",
          bidderValue: "3013.488",
          result: "Qualified"
        },
        {
          srNo: "4",
          criteria: "Quantities of Main Items Executed in any single year",
          unit: "",
          requirement: "",
          bidderValue: "",
          result: "",
          subPoints: [
            {
              srNo: "a",
              criteria: "Concrete Lining",
              unit: "Cum",
              requirement: "16910",
              bidderValue: "15364.95",
              result: "Not Qualified"
            },
            {
              srNo: "b",
              criteria: "Steel Reinforcement",
              unit: "MT",
              requirement: "431",
              bidderValue: "88.74",
              result: "Not Qualified"
            },
            {
              srNo: "c",
              criteria: "Earthwork",
              unit: "Cum",
              requirement: "60490",
              bidderValue: "411302.28",
              result: "Qualified"
            }
          ]
        }
      ]
    } : {
      bidderName: "Shankar Sambhaji Jadhav",
      criteria: [
        {
          srNo: "1",
          criteria: "Annual Turnover (updated to current year)",
          unit: "Rs lakhs",
          requirement: "3106.13",
          bidderValue: "2662",
          result: "Not Qualified"
        },
        {
          srNo: "2",
          criteria: "Bid Capacity = (AxNx2) – B",
          unit: "Rs lakhs",
          requirement: "8283.00",
          bidderValue: "10648.768",
          result: "Qualified"
        },
        {
          srNo: "3",
          criteria: "Completed Similar type of work",
          unit: "Rs lakhs",
          requirement: "2484.90",
          bidderValue: "#REF!",
          result: "#REF!"
        },
        {
          srNo: "4",
          criteria: "Quantities of Main Items Executed in any single year",
          unit: "",
          requirement: "",
          bidderValue: "",
          result: "",
          subPoints: [
            {
              srNo: "a",
              criteria: "Concrete Lining",
              unit: "Cum",
              requirement: "16910",
              bidderValue: "5081.19",
              result: "Not Qualified"
            },
            {
              srNo: "b",
              criteria: "Steel Reinforcement",
              unit: "MT",
              requirement: "431",
              bidderValue: "390.46",
              result: "Not Qualified"
            },
            {
              srNo: "c",
              criteria: "Earthwork",
              unit: "Cum",
              requirement: "60490",
              bidderValue: "275283.19",
              result: "Qualified"
            }
          ]
        }
      ]
    }
  }

  const selectedTender = tenders.find(t => t.tender_id === selectedTenderId)

  // Add demo Abhiraj bid if no Abhiraj bid exists in the list
  const hasAbhirajBid = bids.some(bid => {
    const bidNameLower = (bid.bid_name || "").toLowerCase()
    const bidIdLower = (bid.bid_id || "").toLowerCase()
    return (bidNameLower.includes("abhiraj") || bidIdLower.includes("abhiraj")) && !bidNameLower.includes("shraddha")
  })
  
  const displayBids = hasAbhirajBid 
    ? bids 
    : [
        ...bids,
        {
          bid_id: "KQHSDHI0239",
          bid_name: "ABHIRAJ ENGICON PVT LTD",
          pdf_path: ""
        } as Bid
      ]

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Evaluation Reports</h1>
          <p className="text-muted-foreground">
            View evaluation reports for bids across all tenders
          </p>
        </div>

        {/* Tender Selection */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              <label htmlFor="tender-select" className="text-sm font-medium">
                Select Tender
              </label>
              <select
                id="tender-select"
                value={selectedTenderId || ""}
                onChange={(e) => setSelectedTenderId(e.target.value || null)}
                className="w-full px-3 py-2 border rounded-md"
                disabled={loadingTenders}
              >
                <option value="">All Tenders</option>
                {tenders.map((tender) => (
                  <option key={tender.tender_id} value={tender.tender_id}>
                    {tender.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Bids List */}
        {loadingBids ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading bids...</p>
            </CardContent>
          </Card>
        ) : displayBids.length === 0 ? (
          <Card className="mb-6">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">
                {selectedTenderId 
                  ? "No bids available for this tender." 
                  : "Select a tender to view bids and evaluation reports."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Bids List</h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sr No</TableHead>
                      <TableHead>Bid Name</TableHead>
                      <TableHead>Bid ID</TableHead>
                      <TableHead>Tender</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayBids.map((bid, index) => {
                      const isAbhiraj = (bid.bid_name || "").toLowerCase().includes("abhiraj") || (bid.bid_id || "").toLowerCase().includes("abhiraj")
                      const hasReport = getReportData(bid) !== null || isAbhiraj
                      const isSelected = selectedBidId === bid.bid_id
                      
                      return (
                        <TableRow 
                          key={bid.bid_id}
                          className={`cursor-pointer hover:bg-muted/50 ${isSelected ? "bg-primary/10" : ""}`}
                          onClick={() => {
                            if (hasReport) {
                              setSelectedBidId(bid.bid_id)
                            }
                          }}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium">{bid.bid_name || "N/A"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{bid.bid_id}</TableCell>
                          <TableCell>{selectedTender?.name || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {hasReport ? "Has Report" : "No Report"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Evaluation Reports */}
        {!loadingBids && selectedBidId && (
          <div className="space-y-6">
            {/* Show Abhiraj report if Abhiraj bid is selected */}
            {(() => {
              const selectedBid = displayBids.find(bid => bid.bid_id === selectedBidId)
              if (!selectedBid) return null
              
              const isAbhiraj = (selectedBid.bid_name || "").toLowerCase().includes("abhiraj") || (selectedBid.bid_id || "").toLowerCase().includes("abhiraj")
              const reportData = getReportData(selectedBid)
              
              // Show Abhiraj demo report if it's an Abhiraj bid (even if no report data from getReportData)
              if (isAbhiraj && !reportData) {
                return (
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-5 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">ABHIRAJ ENGICON PVT LTD</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Demo Report (No matching bid found)
                      </p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800 text-sm px-3 py-1">
                      Partially Qualified
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="border">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total Criteria</p>
                        <p className="text-2xl font-bold">4</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-green-200 bg-green-50/50">
                      <CardContent className="p-4">
                        <p className="text-xs text-green-700 mb-1">Qualified</p>
                        <p className="text-2xl font-bold text-green-700">4</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-red-200 bg-red-50/50">
                      <CardContent className="p-4">
                        <p className="text-xs text-red-700 mb-1">Not Qualified</p>
                        <p className="text-2xl font-bold text-red-700">2</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-blue-200 bg-blue-50/50">
                      <CardContent className="p-4">
                        <p className="text-xs text-blue-700 mb-1">Sub-Criteria</p>
                        <p className="text-2xl font-bold text-blue-700">3</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-16 font-semibold">Sr No</TableHead>
                          <TableHead className="font-semibold">Criteria</TableHead>
                          <TableHead className="w-32 font-semibold">Unit</TableHead>
                          <TableHead className="w-40 font-semibold">Requirement</TableHead>
                          <TableHead className="w-40 font-semibold">Bidder Value</TableHead>
                          <TableHead className="w-32 font-semibold">Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          {
                            srNo: "1",
                            criteria: "Annual Turnover (updated to current year)",
                            unit: "Rs lakhs",
                            requirement: "3106.13",
                            bidderValue: "9993",
                            result: "Qualified"
                          },
                          {
                            srNo: "2",
                            criteria: "Bid Capacity = (AxNx2) – B",
                            unit: "Rs lakhs",
                            requirement: "8283.00",
                            bidderValue: "24232.902",
                            result: "Qualified"
                          },
                          {
                            srNo: "3",
                            criteria: "Completed Similar type of work",
                            unit: "Rs lakhs",
                            requirement: "2484.90",
                            bidderValue: "3013.488",
                            result: "Qualified"
                          },
                          {
                            srNo: "4",
                            criteria: "Quantities of Main Items Executed in any single year",
                            unit: "",
                            requirement: "",
                            bidderValue: "",
                            result: "",
                            subPoints: [
                              {
                                srNo: "a",
                                criteria: "Concrete Lining",
                                unit: "Cum",
                                requirement: "16910",
                                bidderValue: "15364.95",
                                result: "Not Qualified"
                              },
                              {
                                srNo: "b",
                                criteria: "Steel Reinforcement",
                                unit: "MT",
                                requirement: "431",
                                bidderValue: "88.74",
                                result: "Not Qualified"
                              },
                              {
                                srNo: "c",
                                criteria: "Earthwork",
                                unit: "Cum",
                                requirement: "60490",
                                bidderValue: "411302.28",
                                result: "Qualified"
                              }
                            ]
                          }
                        ].flatMap((item) => [
                          <TableRow key={item.srNo} className="hover:bg-muted/30">
                            <TableCell className="font-semibold">{item.srNo}</TableCell>
                            <TableCell className="font-medium">{item.criteria}</TableCell>
                            <TableCell>{item.unit || "-"}</TableCell>
                            <TableCell className="font-medium">{item.requirement || "-"}</TableCell>
                            <TableCell className="font-medium">{item.bidderValue || "-"}</TableCell>
                            <TableCell>
                              {item.result ? (
                                <Badge 
                                  className={
                                    item.result === "Qualified" 
                                      ? "bg-green-100 text-green-800 border border-green-300" 
                                      : item.result === "Not Qualified"
                                      ? "bg-red-100 text-red-800 border border-red-300"
                                      : "bg-gray-100 text-gray-800"
                                  }
                                >
                                  {item.result}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>,
                          ...(item.subPoints?.map((subPoint) => (
                            <TableRow key={`${item.srNo}-${subPoint.srNo}`} className="bg-muted/30">
                              <TableCell className="pl-8 font-medium text-muted-foreground">
                                {item.srNo}.{subPoint.srNo}
                              </TableCell>
                              <TableCell className="pl-4 text-muted-foreground">{subPoint.criteria}</TableCell>
                              <TableCell className="text-muted-foreground">{subPoint.unit}</TableCell>
                              <TableCell className="font-medium text-muted-foreground">{subPoint.requirement}</TableCell>
                              <TableCell className="font-medium text-muted-foreground">{subPoint.bidderValue}</TableCell>
                              <TableCell>
                                <Badge 
                                  className={
                                    subPoint.result === "Qualified" 
                                      ? "bg-green-100 text-green-800 border border-green-300" 
                                      : "bg-red-100 text-red-800 border border-red-300"
                                  }
                                >
                                  {subPoint.result}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )) || [])
                        ])}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
                )
              }
              
              // Show report from getReportData if available
              if (reportData) {
                const subPoints = reportData.criteria.flatMap(c => c.subPoints || [])
                const qualifiedCount = reportData.criteria.filter(c => c.result === "Qualified").length
                const notQualifiedCount = reportData.criteria.filter(c => c.result === "Not Qualified").length
                const refCount = reportData.criteria.filter(c => c.result === "#REF!").length
                const qualifiedSubPoints = subPoints.filter(s => s.result === "Qualified").length
                const notQualifiedSubPoints = subPoints.filter(s => s.result === "Not Qualified").length
                const refSubPoints = subPoints.filter(s => s.result === "#REF!").length
                const overallQualified = qualifiedCount + qualifiedSubPoints
                const overallNotQualified = notQualifiedCount + notQualifiedSubPoints
                const overallRef = refCount + refSubPoints

                return (
                  <Card key={selectedBid.bid_id} className="overflow-hidden">
                    <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-5 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold">{reportData.bidderName}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedTender?.name || "Tender"} • Bid ID: {selectedBid.bid_id}
                          </p>
                        </div>
                        <Badge 
                          className={
                            overallNotQualified === 0 && overallRef === 0
                              ? "bg-green-100 text-green-800 text-sm px-3 py-1" 
                              : "bg-yellow-100 text-yellow-800 text-sm px-3 py-1"
                          }
                        >
                          {overallNotQualified === 0 && overallRef === 0 ? "Fully Qualified" : "Partially Qualified"}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Card className="border">
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground mb-1">Total Criteria</p>
                            <p className="text-2xl font-bold">{reportData.criteria.length}</p>
                          </CardContent>
                        </Card>
                        <Card className="border border-green-200 bg-green-50/50">
                          <CardContent className="p-4">
                            <p className="text-xs text-green-700 mb-1">Qualified</p>
                            <p className="text-2xl font-bold text-green-700">{overallQualified}</p>
                          </CardContent>
                        </Card>
                        <Card className="border border-red-200 bg-red-50/50">
                          <CardContent className="p-4">
                            <p className="text-xs text-red-700 mb-1">Not Qualified</p>
                            <p className="text-2xl font-bold text-red-700">{overallNotQualified}</p>
                          </CardContent>
                        </Card>
                        <Card className="border border-blue-200 bg-blue-50/50">
                          <CardContent className="p-4">
                            <p className="text-xs text-blue-700 mb-1">Sub-Criteria</p>
                            <p className="text-2xl font-bold text-blue-700">{subPoints.length}</p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-16 font-semibold">Sr No</TableHead>
                              <TableHead className="font-semibold">Criteria</TableHead>
                              <TableHead className="w-32 font-semibold">Unit</TableHead>
                              <TableHead className="w-40 font-semibold">Requirement</TableHead>
                              <TableHead className="w-40 font-semibold">Bidder Value</TableHead>
                              <TableHead className="w-32 font-semibold">Result</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reportData.criteria.flatMap((item) => [
                              <TableRow key={item.srNo} className="hover:bg-muted/30">
                                <TableCell className="font-semibold">{item.srNo}</TableCell>
                                <TableCell className="font-medium">{item.criteria}</TableCell>
                                <TableCell>{item.unit || "-"}</TableCell>
                                <TableCell className="font-medium">{item.requirement || "-"}</TableCell>
                                <TableCell className="font-medium">{item.bidderValue || "-"}</TableCell>
                                <TableCell>
                                  {item.result ? (
                                    <Badge 
                                      className={
                                        item.result === "Qualified" 
                                          ? "bg-green-100 text-green-800 border border-green-300" 
                                          : item.result === "Not Qualified"
                                          ? "bg-red-100 text-red-800 border border-red-300"
                                          : item.result === "#REF!"
                                          ? "bg-orange-100 text-orange-800 border border-orange-300"
                                          : "bg-gray-100 text-gray-800"
                                      }
                                    >
                                      {item.result}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </TableRow>,
                              ...(item.subPoints?.map((subPoint) => (
                                <TableRow key={`${item.srNo}-${subPoint.srNo}`} className="bg-muted/30">
                                  <TableCell className="pl-8 font-medium text-muted-foreground">
                                    {item.srNo}.{subPoint.srNo}
                                  </TableCell>
                                  <TableCell className="pl-4 text-muted-foreground">{subPoint.criteria}</TableCell>
                                  <TableCell className="text-muted-foreground">{subPoint.unit}</TableCell>
                                  <TableCell className="font-medium text-muted-foreground">{subPoint.requirement}</TableCell>
                                  <TableCell className="font-medium text-muted-foreground">{subPoint.bidderValue}</TableCell>
                                  <TableCell>
                                    <Badge 
                                      className={
                                        subPoint.result === "Qualified" 
                                          ? "bg-green-100 text-green-800 border border-green-300" 
                                          : subPoint.result === "Not Qualified"
                                          ? "bg-red-100 text-red-800 border border-red-300"
                                          : subPoint.result === "#REF!"
                                          ? "bg-orange-100 text-orange-800 border border-orange-300"
                                          : "bg-gray-100 text-gray-800"
                                      }
                                    >
                                      {subPoint.result}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              )) || [])
                            ])}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )
              }
              
              return null
            })()}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <div className="text-lg font-semibold">Loading...</div>
          </div>
        </div>
      </AppLayout>
    }>
      <ReportsContent />
    </Suspense>
  )
}
