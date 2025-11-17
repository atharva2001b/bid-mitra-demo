"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Send,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Edit,
  Bookmark,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const TURNOVER_YEARS = ["2020-21", "2021-22", "2022-23", "2023-24", "2024-25"]

interface Bid {
  bid_id: string
  bid_name: string
  pdf_path: string
  tender_id?: string
}

interface Tender {
  tender_id: string
  name: string
  evaluation_criteria_json: string
}

interface Criteria {
  title: string
  value: string
  description?: string
}

function Bids3CockpitContent() {
  const params = useParams()
  const router = useRouter()
  const bidId = params.id as string
  
  const [bid, setBid] = useState<Bid | null>(null)
  const [tender, setTender] = useState<Tender | null>(null)
  const [criteria, setCriteria] = useState<Record<string, Criteria>>({})
  const [loading, setLoading] = useState(true)
  
  // View mode: "validate" or "evaluate"
  const [viewMode, setViewMode] = useState<"validate" | "evaluate">("validate")
  const [selectedCriteria, setSelectedCriteria] = useState<string>("1")
  const [selectedBidder, setSelectedBidder] = useState<string>("Abhiraj")
  
  // PDF viewer state
  const [currentPdfPage, setCurrentPdfPage] = useState(1)
  const [totalPdfPages, setTotalPdfPages] = useState(0)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfViewMode, setPdfViewMode] = useState<"bookmarked" | "full">("bookmarked")
  const [loadingPdf, setLoadingPdf] = useState(false)
  const pdfDocumentRef = useRef<any>(null)
  const pdfViewerContainerRef = useRef<HTMLDivElement>(null)
  const [renderedPages, setRenderedPages] = useState<Map<number, string>>(new Map())
  
  // Validation table state
  const [turnoverData, setTurnoverData] = useState(() => {
    const initialData: Record<string, string> = {
      "2020-21": "333.9",
      "2021-22": "332.3",
      "2022-23": "334.3",
      "2023-24": "445.5",
      "2024-25": "324.4"
    }
    return initialData
  })
  const [approvedCells, setApprovedCells] = useState<Set<string>>(new Set())
  const [approvedRows, setApprovedRows] = useState<Set<string>>(new Set())
  const [cellPageNumbers, setCellPageNumbers] = useState<Record<string, number>>({
    "turnover-2020-21": 5,
    "turnover-2021-22": 5,
    "turnover-2022-23": 5,
    "turnover-2023-24": 5,
    "turnover-2024-25": 5,
  })
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [editingPageNumber, setEditingPageNumber] = useState(1)
  
  // AI Chat state
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: "Selected criteria is 5 year annual turnover.\n- document found on page 5 is submitted by bidder which I have done OCR of. please check and Approve it as it is an OCR."
    }
  ])
  const [input, setInput] = useState("")
  
  // Page tray state
  const [trayPages, setTrayPages] = useState<number[]>([])
  const [isTrayMinimized, setIsTrayMinimized] = useState(false)
  
  // Panel collapse state
  const [isPdfCollapsed, setIsPdfCollapsed] = useState(false)
  const [isMiddleCollapsed, setIsMiddleCollapsed] = useState(false)
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(false)
  
  // Extract bidder names
  const getBidderNames = () => {
    if (!bid?.bid_name) return ["Abhiraj", "Shraddha", "Kishor"]
    const name = bid.bid_name
    if (name.includes("J.V") || name.includes("Joint Venture")) {
      const match = name.match(/([A-Z][a-z]+)\s*(?:and|&)\s*([A-Z][a-z]+)/i)
      if (match) {
        return [match[1], match[2], "Kishor"]
      }
    }
    return ["Abhiraj", "Shraddha", "Kishor"]
  }
  
  const bidderNames = getBidderNames()
  
  useEffect(() => {
    fetchBidData()
  }, [bidId])
  
  useEffect(() => {
    if (bid && tender) {
      loadEvaluationData()
    }
  }, [selectedCriteria, selectedBidder, bid, tender])
  
  // Load evaluation data from JSON
  const loadEvaluationData = async () => {
    try {
      const response = await fetch("/api/bid-evaluation")
      if (response.ok) {
        const data = await response.json()
        
        // Update current session state
        if (data.current_view_mode) setViewMode(data.current_view_mode)
        if (data.current_selected_criteria) setSelectedCriteria(data.current_selected_criteria)
        if (data.current_selected_bidder) setSelectedBidder(data.current_selected_bidder)
        if (data.current_pdf_page) setCurrentPdfPage(data.current_pdf_page)
        
        // Load validation data for current criteria and bidder
        const currentValidation = data.validations?.find(
          (v: any) => v.criteria_key === data.current_selected_criteria && 
                      v.bidder_name === data.current_selected_bidder
        )
        
        if (currentValidation) {
          // Load cell data
          const cellData: Record<string, string> = {}
          const pageNumbers: Record<string, number> = {}
          const approvedCellsSet = new Set<string>()
          
          Object.entries(currentValidation.cell_data || {}).forEach(([key, cell]: [string, any]) => {
            cellData[key.replace("turnover-", "")] = cell.value
            pageNumbers[key] = cell.page_number
            if (cell.is_approved) {
              approvedCellsSet.add(key)
            }
          })
          
          setTurnoverData(cellData)
          setCellPageNumbers(pageNumbers)
          setApprovedCells(approvedCellsSet)
          setApprovedRows(new Set(currentValidation.approved_rows || []))
        }
        
        // Load bookmarked pages for current criteria
        const criteriaBookmarks = data.bookmarked_pages?.filter(
          (bm: any) => bm.criteria_key === data.current_selected_criteria
        ) || []
        setTrayPages(criteriaBookmarks.map((bm: any) => bm.page_number))
        
        // Load chat messages
        const criteriaMessages = data.chat_messages?.filter(
          (msg: any) => msg.criteria_key === data.current_selected_criteria
        ) || []
        setMessages(criteriaMessages.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        })))
      }
    } catch (error) {
      console.error("Error loading evaluation data:", error)
    }
  }
  
  // Save evaluation data to JSON
  const saveEvaluationData = async () => {
    try {
      // Get current validation for criteria + bidder
      const currentValidation = {
        validation_id: `val-${selectedCriteria}-${selectedBidder}`,
        bid_evaluation_id: bid?.bid_id || "eval-001",
        criteria_key: selectedCriteria,
        bidder_name: selectedBidder,
        cell_data: Object.entries(turnoverData).reduce((acc, [year, value]) => {
          const cellKey = `turnover-${year}`
          acc[cellKey] = {
            value,
            page_number: cellPageNumbers[cellKey] || 5,
            is_approved: approvedCells.has(cellKey)
          }
          return acc
        }, {} as Record<string, any>),
        approved_rows: Array.from(approvedRows),
        validation_status: "in_progress"
      }
      
      // Fetch current data
      const response = await fetch("/api/bid-evaluation")
      const currentData = await response.ok ? await response.json() : {}
      
      // Update validations (replace or add)
      const validations = currentData.validations || []
      const existingIndex = validations.findIndex(
        (v: any) => v.criteria_key === selectedCriteria && v.bidder_name === selectedBidder
      )
      if (existingIndex >= 0) {
        validations[existingIndex] = currentValidation
      } else {
        validations.push(currentValidation)
      }
      
      // Update bookmarked pages for current criteria
      const bookmarkedPages = currentData.bookmarked_pages || []
      const criteriaBookmarks = bookmarkedPages.filter(
        (bm: any) => bm.criteria_key !== selectedCriteria
      )
      trayPages.forEach(pageNum => {
        criteriaBookmarks.push({
          bookmark_id: `bm-${selectedCriteria}-${pageNum}`,
          bid_evaluation_id: bid?.bid_id || "eval-001",
          criteria_key: selectedCriteria,
          page_number: pageNum,
          created_at: new Date().toISOString()
        })
      })
      
      // Update chat messages
      const chatMessages = currentData.chat_messages || []
      const otherCriteriaMessages = chatMessages.filter(
        (msg: any) => msg.criteria_key !== selectedCriteria
      )
      messages.forEach((msg, idx) => {
        otherCriteriaMessages.push({
          message_id: `msg-${selectedCriteria}-${idx}`,
          role: msg.role,
          content: msg.content,
          criteria_key: selectedCriteria,
          created_at: new Date().toISOString()
        })
      })
      
      // Prepare updated data
      const updatedData = {
        ...currentData,
        bid_id: bid?.bid_id || currentData.bid_id,
        tender_id: tender?.tender_id || currentData.tender_id,
        current_view_mode: viewMode,
        current_selected_criteria: selectedCriteria,
        current_selected_bidder: selectedBidder,
        current_pdf_page: currentPdfPage,
        validations,
        bookmarked_pages: criteriaBookmarks,
        chat_messages: otherCriteriaMessages,
        updated_at: new Date().toISOString()
      }
      
      // Save to API
      await fetch("/api/bid-evaluation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData)
      })
    } catch (error) {
      console.error("Error saving evaluation data:", error)
    }
  }
  
  const fetchBidData = async () => {
    try {
      setLoading(true)
      const bidResponse = await fetch(`${API_BASE_URL}/bids/${bidId}`)
      if (bidResponse.ok) {
        const bidData = await bidResponse.json()
        setBid(bidData)
        
        if (bidData.tender_id) {
          const tenderResponse = await fetch(`${API_BASE_URL}/tenders/${bidData.tender_id}`)
          if (tenderResponse.ok) {
            const tenderData = await tenderResponse.json()
            setTender(tenderData)
            
            const criteriaJson = JSON.parse(tenderData.evaluation_criteria_json || "{}")
            setCriteria(criteriaJson)
            
            // Set first criteria as selected
            const firstKey = Object.keys(criteriaJson).sort((a, b) => {
              const numA = parseInt(a) || 0
              const numB = parseInt(b) || 0
              return numA - numB
            })[0]
            if (firstKey) setSelectedCriteria(firstKey)
          }
        }
        
        // Load PDF
        loadPdfInfo(bidData.pdf_path)
      }
    } catch (error) {
      console.error("Error fetching bid data:", error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadPdfInfo = async (pdfPath: string) => {
    const fullUrl = pdfPath.startsWith('http') 
      ? pdfPath 
      : `${API_BASE_URL}/${pdfPath}`
    
    setPdfUrl(fullUrl)
    
    try {
      setLoadingPdf(true)
      if (!(window as any).pdfjsLib) {
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'
        script.onload = () => {
          const pdfjsLib = (window as any).pdfjsLib
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
          initializePdf(fullUrl, pdfjsLib)
        }
        document.head.appendChild(script)
      } else {
        initializePdf(fullUrl, (window as any).pdfjsLib)
      }
    } catch (error) {
      console.error("Error loading PDF:", error)
      setLoadingPdf(false)
    }
  }
  
  const initializePdf = async (url: string, pdfjsLib: any) => {
    try {
      const loadingTask = pdfjsLib.getDocument(url)
      const pdf = await loadingTask.promise
      pdfDocumentRef.current = pdf
      setTotalPdfPages(pdf.numPages)
      setLoadingPdf(false)
      
      // Render based on current view mode
      if (pdfViewMode === "bookmarked" && trayPages.length > 0) {
        renderBookmarkedPages(pdf)
      } else if (pdfViewMode === "full") {
        renderPdfPage(currentPdfPage, pdf)
      }
    } catch (error) {
      console.error("Error initializing PDF:", error)
      setLoadingPdf(false)
    }
  }
  
  const renderPdfPage = async (pageNum: number, pdf?: any) => {
    const pdfDoc = pdf || pdfDocumentRef.current
    if (!pdfDoc) return
    
    try {
      const page = await pdfDoc.getPage(pageNum)
      const scale = 1.5
      const viewport = page.getViewport({ scale })
      
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) return
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      
      const imageData = canvas.toDataURL('image/png')
      setRenderedPages(prev => new Map(prev).set(pageNum, imageData))
    } catch (error) {
      console.error("Error rendering PDF page:", error)
    }
  }
  
  const renderBookmarkedPages = async (pdf: any) => {
    if (!pdf || trayPages.length === 0) return
    
    const pagesToRender = [...trayPages].sort((a, b) => a - b)
    for (const pageNum of pagesToRender) {
      await renderPdfPage(pageNum, pdf)
    }
  }
  
  const jumpToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPdfPages) {
      setCurrentPdfPage(pageNum)
      if (pdfViewMode === "full") {
        renderPdfPage(pageNum)
        // Scroll to top of viewer
        if (pdfViewerContainerRef.current) {
          pdfViewerContainerRef.current.scrollTop = 0
        }
      }
    }
  }
  
  useEffect(() => {
    if (pdfDocumentRef.current && currentPdfPage > 0 && pdfViewMode === "full") {
      renderPdfPage(currentPdfPage)
    }
  }, [currentPdfPage, pdfViewMode])
  
  useEffect(() => {
    if (pdfDocumentRef.current) {
      if (pdfViewMode === "bookmarked" && trayPages.length > 0) {
        renderBookmarkedPages(pdfDocumentRef.current)
      } else if (pdfViewMode === "full" && !renderedPages.has(currentPdfPage)) {
        renderPdfPage(currentPdfPage)
      }
    }
  }, [pdfViewMode, trayPages])
  
  const handleSendMessage = () => {
    if (!input.trim()) return
    
    setMessages(prev => [...prev, { role: "user", content: input }])
    setInput("")
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I've analyzed the document. The information appears to be accurate based on the OCR data."
      }])
      // Auto-save after AI response
      setTimeout(() => saveEvaluationData(), 100)
    }, 1000)
    
    // Auto-save user message
    setTimeout(() => saveEvaluationData(), 100)
  }
  
  const handleCellClick = (year: string) => {
    // Single click: Navigate to the page where this information is from
    const cellKey = `turnover-${year}`
    const pageNumber = cellPageNumbers[cellKey] || 5 // Default to page 5 if not set
    // Switch to full PDF view and jump to page
    setPdfViewMode("full")
    jumpToPage(pageNumber)
  }
  
  const handleCellDoubleClick = (year: string) => {
    // Double click: Open approve dialog
    const cellKey = `turnover-${year}`
    setSelectedCell(cellKey)
    setEditingValue(turnoverData[year] || "")
    setEditingPageNumber(cellPageNumbers[cellKey] || 5)
    setDialogOpen(true)
  }
  
  const handleApproveCell = () => {
    if (!selectedCell) return
    
    setApprovedCells(prev => {
      const newSet = new Set(prev)
      newSet.add(selectedCell)
      return newSet
    })
    
    // Update page number if changed
    setCellPageNumbers(prev => ({
      ...prev,
      [selectedCell]: editingPageNumber
    }))
    
    // Update value if edited
    const year = selectedCell.replace("turnover-", "")
    if (editingValue !== turnoverData[year]) {
      setTurnoverData(prev => ({
        ...prev,
        [year]: editingValue
      }))
    }
    
    setDialogOpen(false)
    setSelectedCell(null)
    
    // Auto-save
    setTimeout(() => saveEvaluationData(), 100)
  }
  
  const handleRemoveApproval = () => {
    if (!selectedCell) return
    
    setApprovedCells(prev => {
      const newSet = new Set(prev)
      newSet.delete(selectedCell)
      return newSet
    })
    
    setDialogOpen(false)
    setSelectedCell(null)
    
    // Auto-save
    setTimeout(() => saveEvaluationData(), 100)
  }
  
  const handleRowApprove = () => {
    setApprovedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has("turnover-row")) {
        newSet.delete("turnover-row")
      } else {
        newSet.add("turnover-row")
      }
      return newSet
    })
    // Auto-save
    setTimeout(() => saveEvaluationData(), 100)
  }
  
  const addPageToTray = (pageNum: number) => {
    if (!trayPages.includes(pageNum)) {
      setTrayPages(prev => [...prev, pageNum])
      // Auto-save
      setTimeout(() => saveEvaluationData(), 100)
    }
  }
  
  const criteriaKeys = Object.keys(criteria).sort((a, b) => {
    const numA = parseInt(a) || 0
    const numB = parseInt(b) || 0
    return numA - numB
  })
  
  const currentCriteria = criteria[selectedCriteria]
  
  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    )
  }
  
  if (!bid) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-slate-500">Bid not found</p>
        </div>
      </AppLayout>
    )
  }
  
  return (
    <AppLayout>
      <div className="h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
        {/* Top Header */}
        <div className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-sm">
          <div className="px-6 py-4">
            {isNavbarCollapsed ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Tender Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-slate-500">Tender:</span>
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {tender?.name || "Loading..."}
                    </span>
                  </div>
                  
                  {/* Bid Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-slate-500">Bid:</span>
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {bid?.bid_name || "Loading..."}
                    </span>
                  </div>
                  
                  {/* Current Status - Compact */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">
                      {viewMode === "validate" ? "Validating" : "Evaluating"}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-700 font-medium truncate">
                      {currentCriteria?.title || "Annual turnover"}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600">{selectedBidder}</span>
                  </div>
                </div>
                
                {/* JV Person Selection - Right Corner */}
                <div className="flex items-center gap-2">
                  {bidderNames.map((name, idx) => (
                    <div key={name} className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedBidder(name)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium transition-all rounded-full",
                          selectedBidder === name
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                      >
                        {name}
                      </button>
                      {idx < bidderNames.length - 1 && (
                        <span className="text-slate-300 text-xs">|</span>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Collapse Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsNavbarCollapsed(!isNavbarCollapsed)}
                  className="h-8 w-8 rounded-lg hover:bg-slate-100 flex-shrink-0"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Mode Tabs */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <button
                      onClick={() => setViewMode("validate")}
                      className={cn(
                        "px-4 py-2 text-sm font-medium transition-all rounded-full",
                        viewMode === "validate"
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm"
                      )}
                    >
                      Validate
                    </button>
                    <button
                      onClick={() => setViewMode("evaluate")}
                      className={cn(
                        "px-4 py-2 text-sm font-medium transition-all rounded-full",
                        viewMode === "evaluate"
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm"
                      )}
                    >
                      Evaluate
                    </button>
                  </div>
                  
                  {/* Criteria Filters */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {criteriaKeys.map((key) => {
                      const crit = criteria[key]
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedCriteria(key)}
                          className={cn(
                            "px-4 py-2 text-sm font-medium transition-all rounded-full",
                            selectedCriteria === key
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm"
                          )}
                        >
                          {crit?.title || `Criteria ${key}`}
                        </button>
                      )
                    })}
                  </div>
                  
                  {/* JV Members */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-600">JV Members:</span>
                    {bidderNames.map((name, idx) => (
                      <div key={name} className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedBidder(name)}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium transition-all rounded-full",
                            selectedBidder === name
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm"
                          )}
                        >
                          {name}
                        </button>
                        {idx < bidderNames.length - 1 && (
                          <span className="text-slate-400">|</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsNavbarCollapsed(!isNavbarCollapsed)}
                  className="h-9 w-9 rounded-lg hover:bg-slate-100"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {/* Main Content Area - Three Floating Cards */}
        <div className="flex-1 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
          <div className="h-full flex gap-4">
            {/* Card 1 - PDF Viewer */}
            <div 
              className={cn(
                "flex flex-col bg-white rounded-2xl shadow-lg transition-all duration-300",
                isPdfCollapsed ? "w-16" : "flex-1 min-w-[300px]"
              )}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                {!isPdfCollapsed && (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPdfViewMode("bookmarked")}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all rounded-full",
                          pdfViewMode === "bookmarked"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                      >
                        <Bookmark className="h-4 w-4" />
                        Bookmarked
                      </button>
                      <button
                        onClick={() => setPdfViewMode("full")}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all rounded-full",
                          pdfViewMode === "full"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                      >
                        <BookOpen className="h-4 w-4" />
                        Full PDF
                      </button>
                    </div>
                    {pdfViewMode === "full" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          Page {currentPdfPage} of {totalPdfPages}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-slate-100"
                            onClick={() => jumpToPage(currentPdfPage - 1)}
                            disabled={currentPdfPage <= 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-slate-100"
                            onClick={() => jumpToPage(currentPdfPage + 1)}
                            disabled={currentPdfPage >= totalPdfPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-slate-100"
                  onClick={() => setIsPdfCollapsed(!isPdfCollapsed)}
                >
                  {isPdfCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {!isPdfCollapsed && (
                <div 
                  ref={pdfViewerContainerRef}
                  className="flex-1 overflow-auto p-6 bg-slate-50/30"
                >
                  {loadingPdf ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : pdfViewMode === "bookmarked" ? (
                    // Bookmarked Pages View
                    trayPages.length > 0 ? (
                      <div className="space-y-4">
                        {[...trayPages].sort((a, b) => a - b).map((pageNum) => (
                          <div key={pageNum} className="flex flex-col items-center">
                            <div className="mb-2 text-xs text-slate-500 font-medium">
                              Page {pageNum}
                            </div>
                            {renderedPages.has(pageNum) ? (
                              <img
                                src={renderedPages.get(pageNum)}
                                alt={`PDF Page ${pageNum}`}
                                className="max-w-full h-auto shadow-xl rounded-xl border border-slate-200"
                                onClick={() => {
                                  setPdfViewMode("full")
                                  jumpToPage(pageNum)
                                }}
                                style={{ cursor: "pointer" }}
                              />
                            ) : (
                              <div className="w-full h-64 bg-slate-100 rounded-xl flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-slate-400">
                          <Bookmark className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No bookmarked pages</p>
                          <p className="text-xs mt-1">Add pages to bookmarks to view them here</p>
                        </div>
                      </div>
                    )
                  ) : (
                    // Full PDF View
                    renderedPages.has(currentPdfPage) ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={renderedPages.get(currentPdfPage)}
                          alt={`PDF Page ${currentPdfPage}`}
                          className="max-w-full h-auto shadow-xl rounded-xl border border-slate-200"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-slate-400">
                          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Loading PDF page...</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Card 2 - Validation */}
            <div 
              className={cn(
                "flex flex-col bg-white rounded-2xl shadow-lg transition-all duration-300",
                isMiddleCollapsed ? "w-16" : "flex-1 min-w-[400px]"
              )}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                {!isMiddleCollapsed && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Validate information</h3>
                    <p className="text-xs text-slate-600 mt-0.5">{currentCriteria?.title || "Annual turnover"}</p>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-slate-100"
                  onClick={() => setIsMiddleCollapsed(!isMiddleCollapsed)}
                >
                  {isMiddleCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {!isMiddleCollapsed && (
                <div className="flex-1 overflow-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50">
                            <TableHead className="font-semibold text-slate-700">Year</TableHead>
                            {TURNOVER_YEARS.map(year => (
                              <TableHead key={year} className="font-semibold text-slate-700 text-center">
                                {year}
                              </TableHead>
                            ))}
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="hover:bg-slate-50/50">
                            <TableCell className="font-medium text-slate-900">Annual turnover</TableCell>
                            {TURNOVER_YEARS.map(year => {
                              const cellKey = `turnover-${year}`
                              const isApproved = approvedCells.has(cellKey) || approvedRows.has("turnover-row")
                              return (
                                <TableCell
                                  key={year}
                                  className={cn(
                                    "text-center cursor-pointer transition-all rounded-lg",
                                    isApproved && "bg-green-50/80"
                                  )}
                                  onClick={() => handleCellClick(year)}
                                  onDoubleClick={() => handleCellDoubleClick(year)}
                                >
                                  <div className="flex items-center justify-center gap-2">
                                    <span className={cn(
                                      "text-sm",
                                      isApproved ? "text-green-700 font-medium" : "text-slate-600"
                                    )}>
                                      {turnoverData[year] || "-"}
                                    </span>
                                    {isApproved && (
                                      <Check className="h-4 w-4 text-green-600" />
                                    )}
                                  </div>
                                </TableCell>
                              )
                            })}
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-9 w-9 rounded-lg",
                                  approvedRows.has("turnover-row") && "text-green-600 bg-green-50"
                                )}
                                onClick={handleRowApprove}
                              >
                                <Check className={cn(
                                  "h-5 w-5",
                                  approvedRows.has("turnover-row") && "fill-green-600"
                                )} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    
                    <div className="mt-6 p-5 bg-blue-50/50 border border-blue-200/60 rounded-xl">
                      <p className="text-xs text-slate-700 leading-relaxed">
                        <strong className="font-semibold">Info:</strong><br />
                        Please press tick to approve whole row.<br />
                        Clicking on each cell will reference the page in pdf from where it is picked.<br />
                        Double clicking will open approve dialog asking to approve that specific information along with option to edit and showing which page its information is represented in editable number.
                      </p>
                    </div>
                    
                    <div className="mt-6 flex justify-end">
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-md hover:shadow-lg transition-all px-6">
                        Next <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Card 3 - AI Chat */}
            <div 
              className={cn(
                "flex flex-col bg-white rounded-2xl shadow-lg transition-all duration-300",
                isChatCollapsed ? "w-16" : "flex-1 min-w-[300px]"
              )}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                {!isChatCollapsed && (
                  <span className="text-sm font-semibold text-slate-900">BidMitra AI chatbot</span>
                )}
                <div className="flex items-center gap-1">
                  {!isChatCollapsed && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-slate-100"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-slate-100"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:bg-slate-100"
                    onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                  >
                    {isChatCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {!isChatCollapsed && (
                <>
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-xl p-4 text-sm shadow-sm",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground ml-8"
                            : "bg-slate-100 text-slate-900 mr-8 border border-slate-200/60"
                        )}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    ))}
                    <div className="text-xs text-slate-500 text-center mt-4">
                      select any page during our chat to add to bookmarks
                    </div>
                    <div className="flex gap-2 justify-center mt-2 flex-wrap">
                      {trayPages.length > 0 ? (
                        trayPages.map(page => (
                          <button
                            key={page}
                            onClick={() => {
                              setPdfViewMode("full")
                              jumpToPage(page)
                            }}
                            className="w-12 h-16 bg-teal-100 border border-teal-200 rounded-lg text-xs text-teal-700 hover:bg-teal-200 hover:shadow-md transition-all flex items-center justify-center"
                          >
                            {page}
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">No pages bookmarked yet</p>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 p-4">
                    <div className="flex items-center gap-2">
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                        placeholder="Type your question here"
                        className="flex-1 border-slate-300 focus:border-slate-400 rounded-lg"
                      />
                      <Button
                        onClick={handleSendMessage}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-md hover:shadow-lg transition-all"
                        size="icon"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Bottom Tray */}
        {!isTrayMinimized && (
          <div className="border-t border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white backdrop-blur-sm shadow-sm px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Bookmarked Pages</span>
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  {trayPages.map(page => (
                    <button
                      key={page}
                      onClick={() => {
                        setPdfViewMode("full")
                        jumpToPage(page)
                      }}
                      className="w-12 h-16 bg-teal-100 border border-teal-200 rounded-lg text-xs text-teal-700 hover:bg-teal-200 hover:shadow-md transition-all flex items-center justify-center"
                    >
                      {page}
                    </button>
                  ))}
                  <button className="w-12 h-16 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-slate-400 hover:bg-slate-50 transition-all flex items-center justify-center">
                    <span className="text-lg">+</span>
                  </button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTrayMinimized(true)}
                  className="text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  minimize <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        {isTrayMinimized && (
          <div className="border-t border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white backdrop-blur-sm px-6 py-2">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTrayMinimized(false)}
                className="text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <ChevronUp className="mr-1 h-4 w-4" /> Bookmarked Pages
              </Button>
            </div>
          </div>
        )}
        
        {/* Approve Cell Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {selectedCell && (approvedCells.has(selectedCell) || approvedRows.has("turnover-row"))
                  ? "Edit or Remove Approval"
                  : "Approve Information"}
              </DialogTitle>
              <DialogDescription>
                {selectedCell && (approvedCells.has(selectedCell) || approvedRows.has("turnover-row"))
                  ? "This cell is already approved. You can edit the value and page number, or remove the approval."
                  : "Review and approve the cell information. You can edit the value and update the page number."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedCell && (
                <div className={cn(
                  "p-3 rounded-lg border",
                  (approvedCells.has(selectedCell) || approvedRows.has("turnover-row"))
                    ? "bg-green-50 border-green-200"
                    : "bg-slate-50 border-slate-200"
                )}>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Year:</span> {selectedCell.replace("turnover-", "")}
                    {(approvedCells.has(selectedCell) || approvedRows.has("turnover-row")) && (
                      <span className="ml-2 text-green-700 font-medium">✓ Approved</span>
                    )}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Value
                </label>
                <Input
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  className="w-full"
                  placeholder="Enter value"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Page Number
                </label>
                <Input
                  type="number"
                  min="1"
                  max={totalPdfPages || 100}
                  value={editingPageNumber}
                  onChange={(e) => setEditingPageNumber(parseInt(e.target.value) || 1)}
                  className="w-full"
                  placeholder="Enter page number"
                />
                <p className="text-xs text-slate-500">
                  This information is represented on page {editingPageNumber} of the PDF.
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false)
                  setSelectedCell(null)
                }}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              {selectedCell && (approvedCells.has(selectedCell) || approvedRows.has("turnover-row")) && (
                <Button
                  variant="destructive"
                  onClick={handleRemoveApproval}
                  className="w-full sm:w-auto"
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove Approval
                </Button>
              )}
              <Button
                onClick={handleApproveCell}
                className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
              >
                <Check className="mr-2 h-4 w-4" />
                {selectedCell && (approvedCells.has(selectedCell) || approvedRows.has("turnover-row"))
                  ? "Update Approval"
                  : "Approve"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

export default function Bids3CockpitPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    }>
      <Bids3CockpitContent />
    </Suspense>
  )
}

