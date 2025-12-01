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
  Send,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  Edit,
  Bookmark,
  BookOpen,
  CheckSquare,
  Minus,
  X,
  Lock,
  BarChart3,
  DollarSign,
  Award,
  FileCheck,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
  Download,
  FileSpreadsheet,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import ExcelJS from "exceljs"
import mockBids from "@/data/mock-bids.json"
import mockTender from "@/data/mock-tender.json"
import mockSearchResults from "@/data/mock-search-results.json"

const TURNOVER_YEARS = ["2019-20", "2020-21", "2021-22", "2022-23", "2023-24"]
const YEAR_LABELS = ["V", "IV", "III", "II", "I"] // Reverse chronological order

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

interface CellMetadata {
  modified_by: "AI" | "user"
  modified_at?: string
}

interface CellData {
  value: string
  page_number: number
  metadata: CellMetadata
}

interface SearchResult {
  document_id: string
  document_name?: string
  page_no: string
  content: string
  semantic_meaning: string
  similarity_score?: number
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  searchResults?: SearchResult[]
  isLoading?: boolean
}

function Bids4CockpitContent() {
  const params = useParams()
  const router = useRouter()
  const bidId = params.id as string
  
  const [bid, setBid] = useState<Bid | null>(null)
  const [tender, setTender] = useState<Tender | null>(null)
  const [criteria, setCriteria] = useState<Record<string, Criteria>>({})
  const [loading, setLoading] = useState(true)
  const [loadingSteps, setLoadingSteps] = useState<Record<string, boolean>>({
    "Loading bid data": false,
    "Fetching evaluation criteria": false,
    "Initializing partner data": false,
    "Setting up PDF viewer": false,
    "Preparing AI chat": false,
    "Loading bookmarks": false,
    "Ready": false,
  })
  
  const [selectedCriteria, setSelectedCriteria] = useState<string>("1")
  const [selectedBidder, setSelectedBidder] = useState<string>("Abhiraj")
  const [evaluationMode, setEvaluationMode] = useState<"submitted_evidence" | "bidder_evaluation">("bidder_evaluation")
  const [isSubmittedEvidenceUnlocked, setIsSubmittedEvidenceUnlocked] = useState(false)
  const [showReports, setShowReports] = useState<"list" | "detail" | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  
  // PDF viewer state
  const [currentPdfPage, setCurrentPdfPage] = useState(1)
  const [totalPdfPages, setTotalPdfPages] = useState(0)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfViewMode, setPdfViewMode] = useState<"bookmarked" | "full">("bookmarked")
  const [loadingPdf, setLoadingPdf] = useState(false)
  const pdfDocumentRef = useRef<any>(null)
  const pdfViewerContainerRef = useRef<HTMLDivElement>(null)
  const [renderedPages, setRenderedPages] = useState<Map<number, string>>(new Map())
  
  // Cell data state - simplified structure
  // Initialize empty - data will be loaded from JSON file
  const [cellData, setCellData] = useState<Record<string, CellData>>({})
  
  // Dialog state for editing cells
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [editingPageNumber, setEditingPageNumber] = useState(1)
  
  // AI Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  
  // Bookmarked pages state
  const [bookmarkedPages, setBookmarkedPages] = useState<number[]>([])
  const [hasInitializedPartner, setHasInitializedPartner] = useState<Record<string, boolean>>({})
  const [isBookmarksMinimized, setIsBookmarksMinimized] = useState(false)
  
  // Panel collapse state
  const [isPdfCollapsed, setIsPdfCollapsed] = useState(false)
  const [isMiddleCollapsed, setIsMiddleCollapsed] = useState(false)
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(false)
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false)
  
  // Extract bidder names
  const getBidderNames = () => {
    if (!bid?.bid_name) return ["Abhiraj", "Shraddha", "Shankar", "J.V."]
    const name = bid.bid_name
    if (name.includes("J.V") || name.includes("Joint Venture")) {
      const match = name.match(/([A-Z][a-z]+)\s*(?:and|&)\s*([A-Z][a-z]+)/i)
      if (match) {
        return [match[1], match[2], "Shankar", "J.V."]
      }
    }
    return ["Abhiraj", "Shraddha", "Shankar", "J.V."]
  }
  
  const bidderNames = getBidderNames()
  
  // Partner data structure - stores data for each partner
  // Initialize empty - data will be loaded from JSON file
  const [partnerData, setPartnerData] = useState<Record<string, Record<string, CellData>>>({})
  
  // J.V. master table data - ALWAYS computed from partner tables
  // Multiplying factors for each year
  const multiplyingFactors: Record<string, string> = {
    "2019-20": "1.50",
    "2020-21": "1.40",
    "2021-22": "1.30",
    "2022-23": "1.20",
    "2023-24": "1.10"
  }
  
  // Function to compute J.V. table from partner data
  const computeJvTableFromPartners = (
    partners: Record<string, Record<string, CellData>>,
    existingJvData?: Record<string, { multiplyingFactor: string }>
  ) => {
    const computed: Record<string, {
      abhiraj: string
      shraddha: string
      ssJadhav: string
      jvTotal: string
      multiplyingFactor: string
      updatedValue: string
      pageNumber: number
    }> = {}
    
    TURNOVER_YEARS.forEach(year => {
      const cellKey = `turnover-${year}`
      const abhirajValue = partners["Abhiraj"]?.[cellKey]?.value || ""
      const shraddhaValue = partners["Shraddha"]?.[cellKey]?.value || ""
      const shankarValue = partners["Shankar"]?.[cellKey]?.value || ""
      
      // Calculate JV Total
      const abhirajVal = parseFloat(abhirajValue || "0")
      const shraddhaVal = parseFloat(shraddhaValue || "0")
      const ssJadhavVal = parseFloat(shankarValue || "0")
      const jvTotal = (abhirajVal + shraddhaVal + ssJadhavVal).toFixed(2)
      
      // Use existing multiplying factor if available, otherwise use default
      const multiplyingFactor = existingJvData?.[year]?.multiplyingFactor || multiplyingFactors[year] || "1.00"
      const updatedValue = (parseFloat(jvTotal) * parseFloat(multiplyingFactor)).toFixed(2)
      
      computed[year] = {
        abhiraj: abhirajValue,
        shraddha: shraddhaValue,
        ssJadhav: shankarValue,
        jvTotal,
        multiplyingFactor,
        updatedValue,
        pageNumber: 111 // Default page for J.V. table
      }
    })
    
    return computed
  }
  
  // Initialize J.V. table - will be computed from partnerData loaded from JSON
  const [jvTableData, setJvTableData] = useState<Record<string, {
    abhiraj: string
    shraddha: string
    ssJadhav: string
    jvTotal: string
    multiplyingFactor: string
    updatedValue: string
    pageNumber: number
  }>>({})
  
  // ALWAYS compute J.V. table from partner tables - partner tables are source of truth
  useEffect(() => {
    // Ensure all partners have data before computing
    const hasAllPartners = ["Abhiraj", "Shraddha", "Shankar"].every(
      partner => partnerData[partner] && Object.keys(partnerData[partner]).length > 0
    )
    
    if (!hasAllPartners) {
      // Don't compute if partners don't have data yet
      return
    }
    
    // Recompute J.V. table from current partner data, preserving multiplying factors
    const computed = computeJvTableFromPartners(partnerData, jvTableData)
    
    // Only update if there are actual changes to avoid infinite loops
    const hasChanges = TURNOVER_YEARS.some(year => {
      const existing = jvTableData[year]
      const newData = computed[year]
      if (!existing) return true
      return (
        existing.abhiraj !== newData.abhiraj ||
        existing.shraddha !== newData.shraddha ||
        existing.ssJadhav !== newData.ssJadhav ||
        existing.jvTotal !== newData.jvTotal ||
        existing.updatedValue !== newData.updatedValue
      )
    })
    
    if (hasChanges) {
      setJvTableData(computed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerData])
  
  // Sync cellData, messages, and bookmarks when selectedBidder changes
  useEffect(() => {
    // Clear bookmarks immediately when partner changes to prevent showing previous partner's bookmarks
    setBookmarkedPages([])
    // Clear messages immediately when partner changes to prevent showing previous partner's messages
    setMessages([])
    
    // Don't change cellData when J.V. is selected - keep showing current partner data
    if (selectedBidder === "J.V.") {
      // For J.V., just load messages and bookmarks (no cellData)
      // loadCellData will be called by the other useEffect
      return
    }
    
    // Always load from partnerData - it's the source of truth
    const partnerTableData = partnerData[selectedBidder]
    
    if (partnerTableData && Object.keys(partnerTableData).length > 0) {
      setCellData(partnerTableData)
      
      // Set PDF to first cell's page when switching partners
      const firstYear = "2019-20"
      const firstCellKey = `turnover-${firstYear}`
      const firstCell = partnerTableData[firstCellKey]
      if (firstCell && firstCell.page_number) {
        setTimeout(() => {
          setCurrentPdfPage(firstCell.page_number)
          setPdfViewMode("full")
        }, 300)
      } else {
        // Use default page for this partner
        const defaultPage = evaluationMode === "bidder_evaluation" 
          ? 27 
          : (selectedBidder === "Abhiraj" ? 111 : selectedBidder === "Shraddha" ? 336 : 808)
        setTimeout(() => {
          setCurrentPdfPage(defaultPage)
          setPdfViewMode("full")
        }, 300)
      }
    }
    // Messages and bookmarks will be loaded by loadCellData in the other useEffect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBidder])
  
  // Update partnerData when cellData changes (for individual partners)
  useEffect(() => {
    if (selectedBidder === "J.V.") return
    
    setPartnerData(prev => {
      const currentPartnerData = prev[selectedBidder]
      
      // Deep comparison to avoid unnecessary updates
      if (!currentPartnerData) {
        return {
          ...prev,
          [selectedBidder]: cellData
        }
      }
      
      // Check if any values actually changed
      const hasChanges = TURNOVER_YEARS.some(year => {
        const cellKey = `turnover-${year}`
        const current = currentPartnerData[cellKey]
        const newCell = cellData[cellKey]
        if (!current && !newCell) return false
        if (!current || !newCell) return true
        return (
          current.value !== newCell.value ||
          current.page_number !== newCell.page_number
        )
      })
      
      if (hasChanges) {
        return {
          ...prev,
          [selectedBidder]: cellData
        }
      }
      return prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellData, selectedBidder])
  
  useEffect(() => {
    fetchBidData()
  }, [bidId])
  
  useEffect(() => {
    if (bid && tender && !hasLoadedInitialData) {
      loadCellData(true)
      setHasLoadedInitialData(true)
    } else if (bid && tender) {
      // When mode changes, reset initialization flags to force reinitialization
      const partnerKey = `${selectedCriteria}-${selectedBidder}-${evaluationMode}`
      setHasInitializedPartner(prev => {
        // Reset all initialization flags for this partner when mode changes
        const newState = { ...prev }
        // Remove old mode flags for this partner to force reinitialization
        Object.keys(newState).forEach(key => {
          if (key.startsWith(`${selectedCriteria}-${selectedBidder}-`) && key !== partnerKey) {
            delete newState[key]
          }
        })
        return newState
      })
      // Clear messages when mode/criteria changes to force reload with new mode-specific data
      // When partner changes, messages are already cleared in the selectedBidder useEffect
      // Only clear here if partner hasn't changed (to avoid double clearing)
      setMessages(prev => {
        // Check if current messages are for a different partner
        let currentBidderInMessages: string | null = null
        for (const msg of prev) {
          // Try to extract bidder name from message content
          if (msg.content) {
            if (msg.content.includes("Abhiraj") && !msg.content.includes("Shraddha") && !msg.content.includes("Shankar")) {
              currentBidderInMessages = "Abhiraj"
              break
            }
            if (msg.content.includes("Shraddha") && !msg.content.includes("Abhiraj") && !msg.content.includes("Shankar")) {
              currentBidderInMessages = "Shraddha"
              break
            }
            if (msg.content.includes("Shankar") && !msg.content.includes("Abhiraj") && !msg.content.includes("Shraddha")) {
              currentBidderInMessages = "Shankar"
              break
            }
          }
        }
        
        // If messages are for a different partner, clear them
        if (currentBidderInMessages && currentBidderInMessages !== selectedBidder) {
          return []
        }
        
        // Only clear if messages don't have a user message (meaning they're stale)
        const hasUserMessage = prev.some((msg: Message) => msg.role === "user")
        if (!hasUserMessage) {
          return []
        }
        return prev
      })
      // Reload cell data when switching between partners, criteria, or modes (including J.V.)
      loadCellData(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCriteria, selectedBidder, evaluationMode, bid, tender])
  
  // Also ensure initialization happens when bid/tender loads and messages are empty
  // This is a fallback in case loadCellData doesn't trigger initialization
  useEffect(() => {
    // Skip initialization for J.V. - keep chat empty for J.V.
    // For both modes, initialize if messages are empty
    if (bid && tender && selectedBidder && selectedBidder !== "J.V." && messages.length === 0 && hasLoadedInitialData) {
      const partnerKey = `${selectedCriteria}-${selectedBidder}-${evaluationMode}`
      // Only initialize if not already initialized for this specific mode
      if (!hasInitializedPartner[partnerKey]) {
        console.log("🔄 Fallback initialization triggered for mode:", evaluationMode)
        // Small delay to ensure loadCellData has finished
        const timer = setTimeout(() => {
          setHasInitializedPartner(prev => ({ ...prev, [partnerKey]: true }))
          initializePartnerData(selectedBidder)
        }, 500)
        return () => clearTimeout(timer)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bid, tender, selectedBidder, selectedCriteria, messages.length, evaluationMode, hasLoadedInitialData])
  
  // Initialize partner with RAG prompt and bookmarks
  const initializePartnerData = async (bidderName: string) => {
    // For bidder_evaluation mode, don't add any default pages - keep bookmarks empty
    let currentBookmarkedPages: number[] = []
    
    if (evaluationMode === "bidder_evaluation") {
      // Keep bookmarks empty for bidder_evaluation mode
      setBookmarkedPages([])
      currentBookmarkedPages = []
    } else {
      // Get required pages for this partner (only for submitted_evidence mode)
      let requiredPages: number[] = []
      if (bidderName === "Abhiraj") {
        requiredPages = [111]
      } else if (bidderName === "Shraddha") {
        requiredPages = [336]
      } else if (bidderName === "Shankar") {
        requiredPages = [808]
      } else if (bidderName === "J.V.") {
        // J.V. needs all partner pages
        requiredPages = [111, 336, 808]
      }
      
      // Start with required pages (will add RAG pages later)
      // Calculate current pages synchronously to avoid race conditions
      // We need to calculate what the pages will be after adding required pages
      const calculatePagesWithRequired = (prev: number[]): number[] => {
        if (requiredPages.length === 0) return prev
        
        // Check if all required pages are already present
        const allPresent = requiredPages.every(page => prev.includes(page))
        if (allPresent) {
          return prev
        }
        
        // Only add pages that aren't already present
        const newPages = [...prev]
        requiredPages.forEach(page => {
          if (!newPages.includes(page)) {
            newPages.push(page)
          }
        })
        
        return newPages.sort((a, b) => a - b)
      }
      
      // Calculate what pages will be after adding required pages
      currentBookmarkedPages = calculatePagesWithRequired(bookmarkedPages)
      
      // Update state
      setBookmarkedPages(currentBookmarkedPages)
    }
    
    // Skip chat initialization for J.V. - keep it empty
    if (bidderName === "J.V.") {
      setMessages([])
      return
    }
    
    // Create initial RAG prompt - mode-specific
    const partnerName = bidderName === "J.V." ? "Joint Venture" : bidderName
    // Get current evaluationMode from state (use the latest value)
    const currentMode = evaluationMode
    console.log("🔍 Initializing partner data - Mode:", currentMode, "Partner:", partnerName)
    const initialPrompt = currentMode === "bidder_evaluation"
      ? `Annual turnover submitted by bidder evaluation sheet for ${partnerName}.`
      : `Annual turnover for ${partnerName} certified by CA`
    console.log("📝 Initial prompt:", initialPrompt)
    
    // Add user message and loading message together to avoid race conditions
    const loadingMessageId = `loading-${Date.now()}`
    const loadingMessageText = evaluationMode === "bidder_evaluation"
      ? "Searching for bidder evaluation sheet information..."
      : "Searching for annual turnover information..."
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: initialPrompt,
      timestamp: new Date(),
    }
    
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: "assistant",
      content: loadingMessageText,
      isLoading: true,
      timestamp: new Date(),
    }
    
    // Set both messages together
    console.log("💬 Setting messages:", { userMessage: userMessage.content, loadingMessage: loadingMessage.content })
    setMessages([userMessage, loadingMessage])
    
    // Send initial RAG query
    if (bidId) {
      try {
        // Use mock search results for demo
        await new Promise(resolve => setTimeout(resolve, 500))
        const data = mockSearchResults
        
        let results: SearchResult[] = []
        results = (data.results || []).map((r: any) => ({
          ...r,
          document_name: bid?.bid_name || "Bid Document",
        }))
          
          // Add RAG result pages to bookmarks (only for submitted_evidence mode)
          // For bidder_evaluation mode, don't auto-bookmark RAG results
          let finalPages: number[] = []
          if (evaluationMode === "bidder_evaluation") {
            // Keep bookmarks empty - user will manually select pages
            setBookmarkedPages([])
            finalPages = []
          } else {
            // Add RAG result pages to bookmarks (only if not already present)
            const ragPages = results.map(r => parseInt(r.page_no) + 1).filter((p, i, arr) => arr.indexOf(p) === i)
            
            // Calculate final pages array: required pages + RAG pages (no duplicates)
            const allPages = [...currentBookmarkedPages]
            ragPages.forEach(page => {
              if (!allPages.includes(page)) {
                allPages.push(page)
              }
            })
            finalPages = allPages.sort((a, b) => a - b)
            
            // Update state with all pages
            setBookmarkedPages(finalPages)
          }
          
          // Update loading message with RAG results - formatted properly
          const successMessage = evaluationMode === "bidder_evaluation"
            ? `Annual turnover submitted by bidder evaluation sheet for ${partnerName}.\n\nFound ${results.length} relevant result${results.length > 1 ? "s" : ""} from the bid document.`
            : `Annual turnover for ${partnerName} certified by CA.\n\nFound ${results.length} relevant result${results.length > 1 ? "s" : ""} from the bid document.`
          setMessages(prev => {
            console.log("📝 Updating messages - current messages:", prev.map((m: Message) => ({ id: m.id, role: m.role, content: m.content.substring(0, 50) })))
            return prev.map((msg: Message) =>
              msg.id === loadingMessageId
                ? {
                    ...msg,
                    content: successMessage,
                    isLoading: false,
                    searchResults: results,
                  }
                : msg
            )
          })
          
          // Save after initialization - pass final pages directly to avoid race condition
          // Pass bidderName explicitly to ensure correct bidder_name is saved
          // For bidder_evaluation, save empty array; for submitted_evidence, save finalPages
          // IMPORTANT: Use longer timeout to ensure messages state is updated
          const pagesToSave = evaluationMode === "bidder_evaluation" ? [] : finalPages
          setTimeout(() => {
            // saveCellData will use the current messages state which includes user message
            saveCellData(bidderName, pagesToSave)
          }, 500)
      } catch (error) {
        console.error("Error initializing partner data:", error)
        // Update loading message with error - formatted properly
        const errorMessage = evaluationMode === "bidder_evaluation"
          ? `Annual turnover submitted by bidder evaluation sheet for ${partnerName}.\n\nError searching documents. Please try again.`
          : `Annual turnover for ${partnerName} certified by CA.\n\nError searching documents. Please try again.`
        setMessages(prev => prev.map((msg: Message) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                content: errorMessage,
                isLoading: false,
                searchResults: [],
              }
            : msg
        ))
        
        // Save after initialization even if RAG fails
        // Pass bidderName explicitly to ensure correct bidder_name is saved
        // For bidder_evaluation, save empty array; for submitted_evidence, use current bookmarked pages
        const pagesToSaveOnError = evaluationMode === "bidder_evaluation" ? [] : currentBookmarkedPages
        setTimeout(() => {
          saveCellData(bidderName, pagesToSaveOnError)
        }, 500)
      }
    } else {
      // If no bidId, still show the query and response
      const fallbackMessage = evaluationMode === "bidder_evaluation"
        ? `Annual turnover submitted by bidder evaluation sheet for ${partnerName}.`
        : `Annual turnover for ${partnerName} certified by CA.`
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: fallbackMessage,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
    }
  }
  
  // Load cell data from JSON
  const loadCellData = async (isInitialLoad: boolean = false) => {
    try {
      const response = await fetch("/api/bid-evaluation")
      if (response.ok) {
        const data = await response.json()
        
        // Get mode-specific data
        let modeData = data[evaluationMode]
        
        // If bidder_evaluation mode doesn't exist, create it from submitted_evidence with empty bookmarks
        if (!modeData && evaluationMode === "bidder_evaluation" && data.submitted_evidence) {
          modeData = {
            ...data.submitted_evidence,
            bookmarked_pages: [],
            chat_messages: []
          }
          // Save the new mode structure
          data[evaluationMode] = modeData
          await fetch("/api/bid-evaluation", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          })
        }
        
        // Fallback to submitted_evidence or root data
        if (!modeData) {
          modeData = data.submitted_evidence || data
        }
        
        // Only update session state on initial load
        if (isInitialLoad) {
          if (modeData.current_selected_criteria) setSelectedCriteria(modeData.current_selected_criteria)
          // Always default to first partner (Abhiraj) on initial load, ignore saved bidder
          // This ensures consistent behavior - first partner always opens by default
          setSelectedBidder("Abhiraj")
          // Set default page for first partner if no saved page exists
          // This will be overridden by first cell's page if cell data exists
          if (!modeData.current_pdf_page) {
            const defaultPage = evaluationMode === "bidder_evaluation" ? 27 : 111
            setCurrentPdfPage(defaultPage)
          } else {
            setCurrentPdfPage(modeData.current_pdf_page)
          }
        }
        
        // Load data for ALL partners, not just selected bidder
        if (modeData.criterias?.[selectedCriteria]?.metadata?.tables) {
          const tables = modeData.criterias[selectedCriteria].metadata.tables
          const partnersToLoad = ["Abhiraj", "Shraddha", "Shankar"]
          
          partnersToLoad.forEach(bidderName => {
            const tableId = `table-${selectedCriteria}-${bidderName}`
            const table = tables[tableId]
            
            if (table?.cells && Object.keys(table.cells).length > 0) {
              const partnerCellData: Record<string, CellData> = {}
              
              Object.entries(table.cells).forEach(([cellKey, cell]: [string, any]) => {
                // Get default page number for this partner
                // For bidder_evaluation mode, always use page 27
                const defaultPage = evaluationMode === "bidder_evaluation" 
                  ? 27 
                  : (bidderName === "Abhiraj" ? 111 : bidderName === "Shraddha" ? 336 : 808)
                // Use cell.page_number if it exists, otherwise use default
                // For bidder_evaluation, always force page 27
                // For submitted_evidence, if page_number is 27 (incorrect), use the correct default
                let pageNumber = evaluationMode === "bidder_evaluation" 
                  ? 27 
                  : (cell.page_number || defaultPage)
                // Correct page 27 values in submitted_evidence mode to proper page numbers
                if (evaluationMode === "submitted_evidence" && pageNumber === 27) {
                  pageNumber = defaultPage
                }
                partnerCellData[cellKey] = {
                  value: cell.value || "",
                  page_number: pageNumber,
                  metadata: {
                    modified_by: cell.metadata?.modified_by || "AI",
                    modified_at: cell.metadata?.modified_at || new Date().toISOString()
                  }
                }
              })
              
              // Update partnerData for this partner
              if (Object.keys(partnerCellData).length > 0) {
                setPartnerData(prev => ({
                  ...prev,
                  [bidderName]: partnerCellData
                }))
                
                // If this is the currently selected bidder, also update cellData
                if (bidderName === selectedBidder && selectedBidder !== "J.V.") {
                  setCellData(partnerCellData)
                  
                  // On initial load, set PDF to first cell's page so it doesn't look empty
                  if (isInitialLoad && Object.keys(partnerCellData).length > 0) {
                    // Get the first cell's page number (first year in TURNOVER_YEARS)
                    const firstYear = "2019-20"
                    const firstCellKey = `turnover-${firstYear}`
                    const firstCell = partnerCellData[firstCellKey]
                    if (firstCell && firstCell.page_number) {
                      // Small delay to ensure PDF is loaded
                      setTimeout(() => {
                        setCurrentPdfPage(firstCell.page_number)
                        setPdfViewMode("full")
                      }, 500)
                    } else {
                      // If first cell doesn't exist, use default page for this partner
                      const defaultPage = evaluationMode === "bidder_evaluation" 
                        ? 27 
                        : (bidderName === "Abhiraj" ? 111 : bidderName === "Shraddha" ? 336 : 808)
                      setTimeout(() => {
                        setCurrentPdfPage(defaultPage)
                        setPdfViewMode("full")
                      }, 500)
                    }
                  }
                }
              }
            }
            // If no saved data exists, partnerData will remain empty for that partner
          })
          
          // Load J.V. multiplying factors
          const jvTableId = `table-${selectedCriteria}-J.V.`
          const jvTable = tables[jvTableId]
          if (jvTable?.cells) {
            setJvTableData(prev => {
              const updated = { ...prev }
              TURNOVER_YEARS.forEach(year => {
                const factorKey = `multiplyingFactor-${year}`
                const factorCell = jvTable.cells[factorKey]
                if (factorCell && updated[year]) {
                  updated[year] = {
                    ...updated[year],
                    multiplyingFactor: factorCell.value || updated[year].multiplyingFactor
                  }
                }
              })
              return updated
            })
          }
        } else {
          // Fallback to old validation structure for migration
          const partnersToLoad = ["Abhiraj", "Shraddha", "Shankar"]
          partnersToLoad.forEach(bidderName => {
            const currentValidation = modeData.validations?.find(
              (v: any) => v.criteria_key === selectedCriteria && 
                          v.bidder_name === bidderName
            )
            
            if (currentValidation && currentValidation.cell_data && Object.keys(currentValidation.cell_data).length > 0) {
              const partnerCellData: Record<string, CellData> = {}
              Object.entries(currentValidation.cell_data || {}).forEach(([key, cell]: [string, any]) => {
                // Get default page number for this partner
                // For bidder_evaluation mode, always use page 27
                const defaultPage = evaluationMode === "bidder_evaluation" 
                  ? 27 
                  : (bidderName === "Abhiraj" ? 111 : bidderName === "Shraddha" ? 336 : 808)
                // Use cell.page_number if it exists, otherwise use default
                // For bidder_evaluation, always force page 27
                // For submitted_evidence, if page_number is 27 (incorrect), use the correct default
                let pageNumber = evaluationMode === "bidder_evaluation" 
                  ? 27 
                  : (cell.page_number || defaultPage)
                // Correct page 27 values in submitted_evidence mode to proper page numbers
                if (evaluationMode === "submitted_evidence" && pageNumber === 27) {
                  pageNumber = defaultPage
                }
                partnerCellData[key] = {
                  value: cell.value || "",
                  page_number: pageNumber,
                  metadata: {
                    modified_by: cell.metadata?.modified_by || "AI",
                    modified_at: cell.metadata?.modified_at || new Date().toISOString()
                  }
                }
              })
              
              setPartnerData(prev => ({
                ...prev,
                [bidderName]: partnerCellData
              }))
              
              if (bidderName === selectedBidder && selectedBidder !== "J.V.") {
                setCellData(partnerCellData)
              }
            }
            // If no saved data exists, partnerData will remain empty for that partner
          })
        }
        
        // Clear bookmarks first to prevent showing previous partner's bookmarks
        setBookmarkedPages([])
        
        // Load bookmarked pages for current criteria and bidder
        // For individual partners: only show their specific bookmarks
        // For J.V.: show combined bookmarks from all partners
        let criteriaBookmarks: any[] = []
        // For bidder_evaluation mode, use empty bookmarks initially
        if (evaluationMode === "bidder_evaluation") {
          criteriaBookmarks = []
        } else if (selectedBidder === "J.V.") {
          // J.V. gets combined bookmarks from all partners
          criteriaBookmarks = (modeData.bookmarked_pages || []).filter(
            (bm: any) => {
              if (bm.criteria_key !== selectedCriteria) return false
              // Include all partner bookmarks (Abhiraj, Shraddha, Shankar) or J.V. specific
              // Ignore old bookmarks without bidder_name
              return bm.bidder_name === "J.V." || 
                     bm.bidder_name === "Abhiraj" || 
                     bm.bidder_name === "Shraddha" || 
                     bm.bidder_name === "Shankar"
            }
          ) || []
        } else {
          // Individual partners: only their specific bookmarks
          criteriaBookmarks = (modeData.bookmarked_pages || []).filter(
            (bm: any) => {
              if (bm.criteria_key !== selectedCriteria) return false
              // Only show bookmarks for this specific partner (ignore old format)
              return bm.bidder_name === selectedBidder
            }
          ) || []
        }
        // Remove duplicates and sort
        const uniquePages = Array.from(new Set(criteriaBookmarks.map((bm: any) => bm.page_number))).sort((a, b) => a - b)
            setBookmarkedPages(uniquePages)
        
        // If no bookmarks found, add required pages immediately (only for submitted_evidence mode)
        if (uniquePages.length === 0 && evaluationMode === "submitted_evidence") {
          const requiredPages = selectedBidder === "Abhiraj" ? [111] 
                           : selectedBidder === "Shraddha" ? [336] 
                           : selectedBidder === "Shankar" ? [808] 
                           : selectedBidder === "J.V." ? [111, 336, 808] 
                           : []
          if (requiredPages.length > 0) {
            setBookmarkedPages(requiredPages)
          }
        } else if (evaluationMode === "bidder_evaluation") {
          // For bidder_evaluation mode, keep bookmarks empty initially
          setBookmarkedPages([])
        }
        
        // Load chat messages for current criteria and bidder
        // Skip loading messages for J.V. - keep chat empty, but still add bookmarks
        if (selectedBidder === "J.V.") {
          setMessages([])
          // J.V. bookmarks are already loaded above (uniquePages), so no need to add again
          // The bookmarks should already include all partner pages from the filter above
        } else {
          // Only load messages that have bidder_name matching current bidder (ignore old format)
          const criteriaMessages = (modeData.chat_messages || []).filter(
            (msg: any) => {
              if (msg.criteria_key !== selectedCriteria) return false
              // Only show messages that have bidder_name matching current bidder
              // Ignore old messages without bidder_name
              const matchesBidder = msg.bidder_name === selectedBidder
              
              // Additional check: verify message content mentions the correct partner
              // This is especially important for bidder_evaluation mode
              if (matchesBidder && msg.content) {
                const content = msg.content.toLowerCase()
                if (selectedBidder === "Abhiraj" && !content.includes("abhiraj")) {
                  return false
                }
                if (selectedBidder === "Shraddha" && !content.includes("shraddha")) {
                  return false
                }
                if (selectedBidder === "Shankar" && !content.includes("shankar")) {
                  return false
                }
              }
              
              return matchesBidder
            }
          ) || []
          
          console.log("🔍 Filtered messages for partner:", selectedBidder, "Mode:", evaluationMode, "Count:", criteriaMessages.length)
          
          // Check if messages exist and if they match the current mode
          // Always reinitialize if mode doesn't match
          const partnerKey = `${selectedCriteria}-${selectedBidder}-${evaluationMode}`
          
          if (criteriaMessages.length > 0) {
            // Check if messages are from a different mode by checking message content
            // Look for mode-specific keywords in the messages
            const hasBidderEvaluationKeyword = criteriaMessages.some((msg: any) => 
              msg.content && msg.content.includes("bidder evaluation sheet")
            )
            const hasSubmittedEvidenceKeyword = criteriaMessages.some((msg: any) => 
              msg.content && msg.content.includes("certified by CA")
            )
            
            // Determine if messages match current mode
            const messagesMatchMode = 
              (evaluationMode === "bidder_evaluation" && hasBidderEvaluationKeyword && !hasSubmittedEvidenceKeyword) ||
              (evaluationMode === "submitted_evidence" && hasSubmittedEvidenceKeyword && !hasBidderEvaluationKeyword)
            
            if (!messagesMatchMode) {
              // Messages exist but are from wrong mode - clear and re-initialize
              console.log("🔄 Messages exist but are from different mode, re-initializing...", {
                currentMode: evaluationMode,
                hasBidderEvaluationKeyword,
                hasSubmittedEvidenceKeyword
              })
              setMessages([])
              setHasInitializedPartner(prev => ({ ...prev, [partnerKey]: false }))
              // Initialize with new mode-specific prompt
              setTimeout(() => {
                initializePartnerData(selectedBidder)
              }, 100)
            } else {
              // Messages are correct for this mode - load them
              console.log("✅ Loading existing messages for mode:", evaluationMode, "Partner:", selectedBidder)
              const loadedMessages = criteriaMessages.map((msg: any, idx: number) => ({
                id: msg.message_id || `msg-${idx}`,
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.created_at || Date.now()),
                searchResults: msg.searchResults || [],
                isLoading: msg.isLoading || false
              }))
              
              // Verify that loaded messages are for the correct partner
              // Check if any message mentions a different partner
              const messagesForCorrectPartner = loadedMessages.every((msg: any) => {
                if (!msg.content) return true
                const content = msg.content.toLowerCase()
                // For user messages, check if they mention the correct partner
                if (msg.role === "user") {
                  if (selectedBidder === "Abhiraj") {
                    // Must include "abhiraj" - "bidder evaluation sheet" alone is not enough
                    return content.includes("abhiraj")
                  }
                  if (selectedBidder === "Shraddha") {
                    // Must include "shraddha" - "bidder evaluation sheet" alone is not enough
                    return content.includes("shraddha")
                  }
                  if (selectedBidder === "Shankar") {
                    // Must include "shankar" - "bidder evaluation sheet" alone is not enough
                    return content.includes("shankar")
                  }
                }
                // For assistant messages, check if they mention wrong partners
                if (msg.role === "assistant") {
                  // If message mentions a different partner, it's wrong
                  if (selectedBidder === "Abhiraj" && (content.includes("shraddha") || content.includes("shankar"))) {
                    return false
                  }
                  if (selectedBidder === "Shraddha" && (content.includes("abhiraj") || content.includes("shankar"))) {
                    return false
                  }
                  if (selectedBidder === "Shankar" && (content.includes("abhiraj") || content.includes("shraddha"))) {
                    return false
                  }
                }
                return true
              })
              
              // Check if user message exists - if not, we need to initialize
              const hasUserMessage = loadedMessages.some((msg: Message) => msg.role === "user")
              
              if (!hasUserMessage || !messagesForCorrectPartner) {
                console.log("⚠️ Messages don't match partner or missing user message, re-initializing...", {
                  hasUserMessage,
                  messagesForCorrectPartner,
                  selectedBidder,
                  loadedMessagesCount: loadedMessages.length
                })
                setMessages([])
                setHasInitializedPartner(prev => ({ ...prev, [partnerKey]: false }))
                // Initialize with new mode-specific prompt
                setTimeout(() => {
                  initializePartnerData(selectedBidder)
                }, 100)
              } else {
                console.log("✅ Loading messages for partner:", selectedBidder, "Count:", loadedMessages.length)
                setMessages(loadedMessages)
                // Mark as initialized to prevent duplicate initialization
                setHasInitializedPartner(prev => ({ ...prev, [partnerKey]: true }))
              }
            }
          } else {
            // No messages found - always initialize
            console.log("🆕 No messages found, initializing for mode:", evaluationMode)
            setHasInitializedPartner(prev => ({ ...prev, [partnerKey]: false }))
            // Initialize immediately - add required pages first, then RAG
            initializePartnerData(selectedBidder)
          }
        }
      }
    } catch (error) {
      console.error("Error loading cell data:", error)
    }
  }
  
  // Save cell data to JSON - saves ALL partner data, not just current bidder
  const saveCellData = async (bidderNameOverride?: string, bookmarkedPagesOverride?: number[]) => {
    try {
      // Use override if provided, otherwise use selectedBidder from state
      const bidderToSave = bidderNameOverride || selectedBidder
      
      // Fetch current data
      const response = await fetch("/api/bid-evaluation")
      const allData = await response.ok ? await response.json() : {}
      
      // Get or create mode-specific data structure
      if (!allData[evaluationMode]) {
        allData[evaluationMode] = {
          bid_id: allData.bid_id || bid?.bid_id || "",
          tender_id: allData.tender_id || tender?.tender_id || "",
          current_selected_criteria: selectedCriteria,
          current_selected_bidder: selectedBidder,
          current_pdf_page: currentPdfPage,
          criterias: {},
          bookmarked_pages: [],
          chat_messages: []
        }
      }
      
      const currentData = allData[evaluationMode]
      
      // Prepare new structure: criterias -> metadata -> tables -> cells
      const criterias = currentData.criterias || {}
      if (!criterias[selectedCriteria]) {
        criterias[selectedCriteria] = {
          metadata: {
            tables: {}
          }
        }
      }
      
      if (!criterias[selectedCriteria].metadata.tables) {
        criterias[selectedCriteria].metadata.tables = {}
      }
      
      // Save data for ALL partners (Abhiraj, Shraddha, Shankar)
      const partnersToSave = ["Abhiraj", "Shraddha", "Shankar"]
      partnersToSave.forEach(bidderName => {
        const tableId = `table-${selectedCriteria}-${bidderName}`
        if (!criterias[selectedCriteria].metadata.tables[tableId]) {
          criterias[selectedCriteria].metadata.tables[tableId] = {
            cells: {}
          }
        }
        
        // Get partner data - use current cellData if it's the selected bidder, otherwise use partnerData
        const dataToSave = bidderName === selectedBidder 
          ? cellData 
          : partnerData[bidderName] || {}
        
        // Update cells for this partner
        // For bidder_evaluation mode, always force page 27
        // For submitted_evidence mode, use correct page numbers (111, 336, 808)
        Object.entries(dataToSave).forEach(([cellKey, cell]) => {
          let pageNumber: number
          if (evaluationMode === "bidder_evaluation") {
            pageNumber = 27
          } else {
            // For submitted_evidence, use correct default if page_number is 27 or missing
            const defaultPage = bidderName === "Abhiraj" ? 111 : bidderName === "Shraddha" ? 336 : 808
            pageNumber = (cell.page_number && cell.page_number !== 27) ? cell.page_number : defaultPage
          }
          criterias[selectedCriteria].metadata.tables[tableId].cells[cellKey] = {
            value: cell.value,
            page_number: pageNumber,
            metadata: {
              modified_by: cell.metadata.modified_by,
              modified_at: cell.metadata.modified_at || new Date().toISOString()
            }
          }
        })
      })
      
      // Also save J.V. table data (multiplying factors)
      const jvTableId = `table-${selectedCriteria}-J.V.`
      if (!criterias[selectedCriteria].metadata.tables[jvTableId]) {
        criterias[selectedCriteria].metadata.tables[jvTableId] = {
          cells: {}
        }
      }
      
      // Save multiplying factors for each year - use current jvTableData state
      TURNOVER_YEARS.forEach(year => {
        const yearData = jvTableData[year]
        if (yearData) {
          // Get existing factor to preserve metadata if it exists
          const existingFactor = criterias[selectedCriteria]?.metadata?.tables?.[jvTableId]?.cells?.[`multiplyingFactor-${year}`]
          
          // If value changed, mark as user-modified, otherwise preserve existing metadata
          const valueChanged = existingFactor?.value !== yearData.multiplyingFactor
          const modifiedBy = valueChanged ? "user" : (existingFactor?.metadata?.modified_by || "AI")
          const modifiedAt = valueChanged ? new Date().toISOString() : (existingFactor?.metadata?.modified_at || new Date().toISOString())
          
          // For bidder_evaluation mode, always use page 27
          const pageNumber = evaluationMode === "bidder_evaluation" ? 27 : (yearData.pageNumber || 111)
          criterias[selectedCriteria].metadata.tables[jvTableId].cells[`multiplyingFactor-${year}`] = {
            value: yearData.multiplyingFactor,
            page_number: pageNumber,
            metadata: {
              modified_by: modifiedBy,
              modified_at: modifiedAt
            }
          }
        }
      })
      
      // Update bookmarked pages for current criteria and bidder
      // Only save bookmarks that belong to this specific bidder
      // bookmarkedPages should already be filtered to only contain this bidder's pages (cleared in loadCellData)
      // For bidder_evaluation mode, start with empty bookmarks
      const existingBookmarkedPages = evaluationMode === "bidder_evaluation" ? [] : (currentData.bookmarked_pages || [])
      const criteriaBookmarks = existingBookmarkedPages.filter(
        (bm: any) => !(bm.criteria_key === selectedCriteria && bm.bidder_name === bidderToSave)
      )
      
      // Use override if provided, otherwise use state
      // bookmarkedPages is cleared when switching partners, so it only contains current partner's pages
      const pagesToSave = bookmarkedPagesOverride || bookmarkedPages
      pagesToSave.forEach(pageNum => {
        criteriaBookmarks.push({
          bookmark_id: `bm-${selectedCriteria}-${bidderToSave}-${pageNum}`,
          bid_evaluation_id: bid?.bid_id || "eval-001",
          criteria_key: selectedCriteria,
          bidder_name: bidderToSave,
          page_number: pageNum,
          created_at: new Date().toISOString()
        })
      })
      
      // Update chat messages for current criteria and bidder
      // Only save messages if they match the current bidder (prevent cross-contamination)
      const chatMessages = currentData.chat_messages || []
      const otherCriteriaMessages = chatMessages.filter(
        (msg: any) => !(msg.criteria_key === selectedCriteria && msg.bidder_name === bidderToSave)
      )
      
      // Only save messages if they are for the correct bidder
      // Check message content to ensure it matches the bidder name
      // IMPORTANT: Don't filter out user messages - they are the initial queries
      const validMessages = messages.filter((msg: Message) => {
        // Always include user messages (they are the queries)
        if (msg.role === "user") {
          return true
        }
        
        const content = msg.content || ""
        // Skip if message content mentions a different partner (only for assistant messages)
        if (bidderToSave === "Abhiraj" && (content.includes("Shraddha") || content.includes("Shankar") || content.includes("Joint Venture"))) {
          return false
        }
        if (bidderToSave === "Shraddha" && (content.includes("Abhiraj") || content.includes("Shankar") || content.includes("Joint Venture"))) {
          return false
        }
        if (bidderToSave === "Shankar" && (content.includes("Abhiraj") || content.includes("Shraddha") || content.includes("Joint Venture"))) {
          return false
        }
        if (bidderToSave === "J.V." && messages.length > 0) {
          // Don't save any messages for J.V.
          return false
        }
        return true
      })
      
      console.log("💾 Saving messages:", validMessages.map(m => ({ role: m.role, content: m.content.substring(0, 50) })))
      
      validMessages.forEach((msg, idx) => {
        otherCriteriaMessages.push({
          message_id: msg.id || `msg-${selectedCriteria}-${bidderToSave}-${idx}`,
          role: msg.role,
          content: msg.content,
          criteria_key: selectedCriteria,
          bidder_name: bidderToSave,
          created_at: msg.timestamp?.toISOString() || new Date().toISOString(),
          searchResults: msg.searchResults || [],
          isLoading: msg.isLoading || false
        })
      })
      
      console.log("💾 Saving messages to JSON:", validMessages.map(m => ({ role: m.role, content: m.content.substring(0, 60) })))
      
      // Prepare updated data for this mode
      const updatedModeData = {
        ...currentData,
        bid_id: bid?.bid_id || currentData.bid_id,
        tender_id: tender?.tender_id || currentData.tender_id,
        current_selected_criteria: selectedCriteria,
        current_selected_bidder: selectedBidder,
        current_pdf_page: currentPdfPage,
        criterias,
        bookmarked_pages: criteriaBookmarks,
        chat_messages: otherCriteriaMessages,
        updated_at: new Date().toISOString()
      }
      
      // Update the mode-specific section in allData
      allData[evaluationMode] = updatedModeData
      
      // Preserve bid_id and tender_id at root level
      allData.bid_id = bid?.bid_id || allData.bid_id || ""
      allData.tender_id = tender?.tender_id || allData.tender_id || ""
      
      // Save to API - save entire structure with both modes
      await fetch("/api/bid-evaluation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(allData)
      })
    } catch (error) {
      console.error("Error saving cell data:", error)
    }
  }
  
  const fetchBidData = async () => {
    try {
      setLoading(true)
      // Reset loading steps
      setLoadingSteps({
        "Loading bid data": false,
        "Fetching evaluation criteria": false,
        "Initializing partner data": false,
        "Setting up PDF viewer": false,
        "Preparing AI chat": false,
        "Loading bookmarks": false,
        "Ready": false,
      })
      
      // Step 1: Loading bid data
      await new Promise(resolve => setTimeout(resolve, 300))
      // Use mock data instead of API call
      const bidData = mockBids.bids.find(b => b.bid_id === bidId) || mockBids.bids[0]
      if (bidData) {
        setBid(bidData)
        setLoadingSteps(prev => ({ ...prev, "Loading bid data": true }))
        
        // Step 2: Fetching evaluation criteria
        await new Promise(resolve => setTimeout(resolve, 400))
        if (bidData.tender_id) {
          // Use mock tender data
          const tenderData = mockTender
          setTender(tenderData)
          
          const criteriaJson = JSON.parse(tenderData.evaluation_criteria_json || "{}")
          setCriteria(criteriaJson)
          setLoadingSteps(prev => ({ ...prev, "Fetching evaluation criteria": true }))
          
          // Set first criteria as selected
          const firstKey = Object.keys(criteriaJson).sort((a, b) => {
            const numA = parseInt(a) || 0
            const numB = parseInt(b) || 0
            return numA - numB
          })[0]
          if (firstKey) setSelectedCriteria(firstKey)
        }
        
        // Step 3: Initializing partner data
        await new Promise(resolve => setTimeout(resolve, 500))
        setLoadingSteps(prev => ({ ...prev, "Initializing partner data": true }))
        
        // Step 4: Setting up PDF viewer
        await new Promise(resolve => setTimeout(resolve, 400))
        loadPdfInfo(bidData.pdf_path)
        setLoadingSteps(prev => ({ ...prev, "Setting up PDF viewer": true }))
        
        // Step 5: Preparing AI chat
        await new Promise(resolve => setTimeout(resolve, 300))
        setLoadingSteps(prev => ({ ...prev, "Preparing AI chat": true }))
        
        // Step 6: Loading bookmarks
        await new Promise(resolve => setTimeout(resolve, 400))
        setLoadingSteps(prev => ({ ...prev, "Loading bookmarks": true }))
        
        // Step 7: Ready
        await new Promise(resolve => setTimeout(resolve, 500))
        setLoadingSteps(prev => ({ ...prev, "Ready": true }))
        
        // Final delay before showing content
        await new Promise(resolve => setTimeout(resolve, 300))
        setLoading(false)
      }
    } catch (error) {
      console.error("Error fetching bid data:", error)
      setLoading(false)
    }
  }
  
  const loadPdfInfo = async (pdfPath: string) => {
    // Use local PDF path from public folder
    const fullUrl = pdfPath.startsWith('http') 
      ? pdfPath 
      : pdfPath.startsWith('/') 
        ? pdfPath 
        : `/${pdfPath}`
    
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
      if (pdfViewMode === "bookmarked" && bookmarkedPages.length > 0) {
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
    if (!pdf || bookmarkedPages.length === 0) return
    
    // Only render pages that haven't been rendered yet
    const pagesToRender = [...bookmarkedPages]
      .filter(pageNum => !renderedPages.has(pageNum))
      .sort((a, b) => a - b)
    
    if (pagesToRender.length === 0) return
    
    for (const pageNum of pagesToRender) {
      await renderPdfPage(pageNum, pdf)
    }
  }
  
  const jumpToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPdfPages) {
      // Switch to full PDF view when jumping to a page
      setPdfViewMode("full")
      setCurrentPdfPage(pageNum)
      // Render will happen automatically via useEffect, but we can trigger it immediately
      if (pdfDocumentRef.current) {
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
  
  // Render bookmarked pages when bookmarkedPages change and PDF is ready
  useEffect(() => {
    if (pdfDocumentRef.current && bookmarkedPages.length > 0 && pdfViewMode === "bookmarked" && !loadingPdf) {
      // Always render bookmarked pages when bookmarkedPages changes (renderBookmarkedPages checks if already rendered)
      renderBookmarkedPages(pdfDocumentRef.current)
    }
  }, [bookmarkedPages, pdfViewMode, loadingPdf])
  
  // Also render bookmarked pages when PDF finishes loading
  useEffect(() => {
    if (!loadingPdf && pdfDocumentRef.current && bookmarkedPages.length > 0 && pdfViewMode === "bookmarked") {
      renderBookmarkedPages(pdfDocumentRef.current)
    } else if (!loadingPdf && pdfDocumentRef.current && pdfViewMode === "full" && !renderedPages.has(currentPdfPage)) {
      renderPdfPage(currentPdfPage)
    }
  }, [loadingPdf, pdfViewMode, currentPdfPage])
  
  const handleSendMessage = async () => {
    if (!input.trim() || !bidId) return
    
    const query = input.trim()
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])

    // Add loading message
    const loadingMessageId = (Date.now() + 1).toString()
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: "assistant",
      content: "Searching bid documents...",
      isLoading: true,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, loadingMessage])

    setInput("")

    try {
      // Use mock search results for demo
      await new Promise(resolve => setTimeout(resolve, 800))
      const data = mockSearchResults

      let results: SearchResult[] = []
      results = (data.results || []).map((r: any) => ({
        ...r,
        document_name: bid?.bid_name || "Bid Document",
      }))

      // Update message with RAG results
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMessageId
          ? {
              ...msg,
              content: results.length > 0
                ? `Found ${results.length} relevant result${results.length > 1 ? "s" : ""} from the bid document`
                : "No results found for your query",
              isLoading: false,
              searchResults: results,
            }
          : msg
      ))

      // Add RAG result pages to bookmarks automatically
      if (results.length > 0) {
        const ragPages = results.map(r => parseInt(r.page_no) + 1).filter((p, i, arr) => arr.indexOf(p) === i)
        setBookmarkedPages(prev => {
          const newPages = [...prev]
          ragPages.forEach(page => {
            if (!newPages.includes(page)) {
              newPages.push(page)
            }
          })
          return newPages.sort((a, b) => a - b)
        })
      }

      // Auto-save after search
      setTimeout(() => saveCellData(), 300)
    } catch (error) {
      console.error("Error searching:", error)
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMessageId
          ? {
              ...msg,
              content: "Error searching documents. Please try again.",
              isLoading: false,
              searchResults: [],
            }
          : msg
      ))
    }
  }
  
  const handleCellClick = (year: string) => {
    // Single click: Navigate to the page where this information is from
    const cellKey = `turnover-${year}`
    const cell = cellData[cellKey]
    if (cell) {
      // For bidder_evaluation mode, always use page 27
      const defaultPage = evaluationMode === "bidder_evaluation" 
        ? 27 
        : (selectedBidder === "Abhiraj" ? 111 : selectedBidder === "Shraddha" ? 336 : 808)
      const pageNumber = evaluationMode === "bidder_evaluation" 
        ? 27 
        : (cell.page_number || defaultPage)
      // Switch to full PDF view and jump to page
      setPdfViewMode("full")
      jumpToPage(pageNumber)
    }
  }
  
  const handleCellDoubleClick = (year: string) => {
    // Double click: Open edit dialog - allow editing even if cell is empty
    const cellKey = `turnover-${year}`
    const cell = cellData[cellKey]
    // For bidder_evaluation mode, always use page 27
    const defaultPage = evaluationMode === "bidder_evaluation" 
      ? 27 
      : (selectedBidder === "Abhiraj" ? 111 : selectedBidder === "Shraddha" ? 336 : 808)
    
    setSelectedCell(cellKey)
    setEditingValue(cell?.value || "")
    // For bidder_evaluation, always force page 27
    const pageNumber = evaluationMode === "bidder_evaluation" 
      ? 27 
      : (cell?.page_number || defaultPage)
    setEditingPageNumber(pageNumber)
    setDialogOpen(true)
  }
  
  // J.V. table cell handlers
  const handleJvCellClick = (year: string, field: "abhiraj" | "shraddha" | "ssJadhav" | "multiplyingFactor") => {
    // Single click: Navigate to the page where this information is from
    const yearData = jvTableData[year]
    if (yearData) {
      let pageNumber = 111
      if (field === "abhiraj") pageNumber = 111
      else if (field === "shraddha") pageNumber = 336
      else if (field === "ssJadhav") pageNumber = 808
      else pageNumber = yearData.pageNumber || 111
      
      setPdfViewMode("full")
      jumpToPage(pageNumber)
    }
  }
  
  const handleJvCellDoubleClick = (year: string, field: "abhiraj" | "shraddha" | "ssJadhav" | "multiplyingFactor") => {
    // Double click: Open edit dialog for J.V. cell - allow editing even if empty
    const yearData = jvTableData[year]
    let value = ""
    let pageNumber = 111
    
    if (field === "abhiraj") {
      value = yearData?.abhiraj || ""
      pageNumber = 111
    } else if (field === "shraddha") {
      value = yearData?.shraddha || ""
      pageNumber = 336
    } else if (field === "ssJadhav") {
      value = yearData?.ssJadhav || ""
      pageNumber = 808
    } else if (field === "multiplyingFactor") {
      value = yearData?.multiplyingFactor || multiplyingFactors[year] || "1.00"
      pageNumber = yearData?.pageNumber || 111
    }
    
    // Store context for saving
    setSelectedCell(`jv-${year}-${field}`)
    setEditingValue(value)
    setEditingPageNumber(pageNumber)
    setDialogOpen(true)
  }
  
  const handleSaveCell = () => {
    if (!selectedCell) return
    
    // For bidder_evaluation mode, always force page 27
    const finalPageNumber = evaluationMode === "bidder_evaluation" ? 27 : editingPageNumber
    
    // Check if this is a J.V. table cell
    if (selectedCell.startsWith("jv-")) {
      // Parse J.V. cell identifier: jv-{year}-{field}
      const parts = selectedCell.split("-")
      if (parts.length === 3) {
        const year = parts[1]
        const field = parts[2] as "abhiraj" | "shraddha" | "ssJadhav" | "multiplyingFactor"
        
        // Update J.V. table
        setJvTableData(prev => {
          const updated = { ...prev }
          if (!updated[year]) {
            updated[year] = {
              abhiraj: "",
              shraddha: "",
              ssJadhav: "",
              jvTotal: "",
              multiplyingFactor: "1.00",
              updatedValue: "",
              pageNumber: finalPageNumber
            }
          }
          
          updated[year] = {
            ...updated[year],
            [field]: editingValue,
            pageNumber: finalPageNumber
          }
          
          // Recalculate JV Total and Updated Value
          if (field === "abhiraj" || field === "shraddha" || field === "ssJadhav") {
            const abhirajVal = parseFloat(field === "abhiraj" ? editingValue : updated[year].abhiraj || "0")
            const shraddhaVal = parseFloat(field === "shraddha" ? editingValue : updated[year].shraddha || "0")
            const ssJadhavVal = parseFloat(field === "ssJadhav" ? editingValue : updated[year].ssJadhav || "0")
            const jvTotal = (abhirajVal + shraddhaVal + ssJadhavVal).toFixed(2)
            
            const multiplyingFactor = parseFloat(updated[year].multiplyingFactor || "1")
            const updatedValue = (parseFloat(jvTotal) * multiplyingFactor).toFixed(2)
            
            updated[year] = {
              ...updated[year],
              jvTotal,
              updatedValue
            }
          } else if (field === "multiplyingFactor") {
            // Recalculate Updated Value when multiplying factor changes
            const jvTotal = parseFloat(updated[year].jvTotal || "0")
            const updatedValue = (jvTotal * parseFloat(editingValue || "1")).toFixed(2)
            updated[year] = {
              ...updated[year],
              updatedValue
            }
          }
          
          return updated
        })
        
        // Update corresponding partner table - this will trigger J.V. recomputation
        if (field === "abhiraj") {
          setPartnerData(prev => {
            const updated = { ...prev }
            if (!updated["Abhiraj"]) updated["Abhiraj"] = {}
            updated["Abhiraj"][`turnover-${year}`] = {
              value: editingValue,
              page_number: finalPageNumber,
              metadata: {
                modified_by: "user",
                modified_at: new Date().toISOString()
              }
            }
            return updated
          })
          // Also update cellData if Abhiraj is currently selected
          if (selectedBidder === "Abhiraj") {
            setCellData(prev => ({
              ...prev,
              [`turnover-${year}`]: {
                value: editingValue,
                page_number: finalPageNumber,
                metadata: {
                  modified_by: "user",
                  modified_at: new Date().toISOString()
                }
              }
            }))
          }
        } else if (field === "shraddha") {
          setPartnerData(prev => {
            const updated = { ...prev }
            if (!updated["Shraddha"]) updated["Shraddha"] = {}
            updated["Shraddha"][`turnover-${year}`] = {
              value: editingValue,
              page_number: finalPageNumber,
              metadata: {
                modified_by: "user",
                modified_at: new Date().toISOString()
              }
            }
            return updated
          })
          // Also update cellData if Shraddha is currently selected
          if (selectedBidder === "Shraddha") {
            setCellData(prev => ({
              ...prev,
              [`turnover-${year}`]: {
                value: editingValue,
                page_number: finalPageNumber,
                metadata: {
                  modified_by: "user",
                  modified_at: new Date().toISOString()
                }
              }
            }))
          }
        } else if (field === "ssJadhav") {
          setPartnerData(prev => {
            const updated = { ...prev }
            if (!updated["Shankar"]) updated["Shankar"] = {}
            updated["Shankar"][`turnover-${year}`] = {
              value: editingValue,
              page_number: finalPageNumber,
              metadata: {
                modified_by: "user",
                modified_at: new Date().toISOString()
              }
            }
            return updated
          })
          // Also update cellData if Shankar is currently selected
          if (selectedBidder === "Shankar") {
            setCellData(prev => ({
              ...prev,
              [`turnover-${year}`]: {
                value: editingValue,
                page_number: finalPageNumber,
                metadata: {
                  modified_by: "user",
                  modified_at: new Date().toISOString()
                }
              }
            }))
          }
        } else if (field === "multiplyingFactor") {
          // Update multiplying factor - this doesn't affect partner tables, just J.V. calculation
          setJvTableData(prev => {
            const updated = { ...prev }
            if (updated[year]) {
              const jvTotal = parseFloat(updated[year].jvTotal || "0")
              const updatedValue = (jvTotal * parseFloat(editingValue || "1")).toFixed(2)
              updated[year] = {
                ...updated[year],
                multiplyingFactor: editingValue,
                updatedValue,
                pageNumber: finalPageNumber
              }
            } else {
              // If year doesn't exist, create it with default values
              updated[year] = {
                abhiraj: "",
                shraddha: "",
                ssJadhav: "",
                jvTotal: "0",
                multiplyingFactor: editingValue,
                updatedValue: "0",
                pageNumber: finalPageNumber
              }
            }
            return updated
          })
        }
      }
    } else {
      // Regular partner table cell - update partnerData (source of truth)
      // This will trigger J.V. table recomputation via useEffect
      setPartnerData(prev => {
        const updated = { ...prev }
        if (!updated[selectedBidder]) updated[selectedBidder] = {}
        updated[selectedBidder][selectedCell] = {
          value: editingValue,
          page_number: finalPageNumber,
          metadata: {
            modified_by: "user",
            modified_at: new Date().toISOString()
          }
        }
        return updated
      })
      
      // Also update cellData for immediate UI update
      setCellData(prev => ({
        ...prev,
        [selectedCell]: {
          value: editingValue,
          page_number: finalPageNumber,
          metadata: {
            modified_by: "user",
            modified_at: new Date().toISOString()
          }
        }
      }))
    }
    
    setDialogOpen(false)
    setSelectedCell(null)
    
    // Auto-save - use a longer timeout to ensure state updates are complete
    setTimeout(() => {
      saveCellData()
    }, 300)
  }
  
  const addPageToBookmarks = (pageNum: number) => {
    if (!bookmarkedPages.includes(pageNum)) {
      setBookmarkedPages(prev => [...prev, pageNum])
      // Auto-save
      setTimeout(() => saveCellData(), 100)
    }
  }
  
  const criteriaKeys = Object.keys(criteria).sort((a, b) => {
    const numA = parseInt(a) || 0
    const numB = parseInt(b) || 0
    return numA - numB
  })
  
  const currentCriteria = criteria[selectedCriteria]
  
  // Get icon for criteria based on title/key
  const getCriteriaIcon = (key: string, title?: string) => {
    const titleLower = (title || "").toLowerCase()
    if (titleLower.includes("turnover") || titleLower.includes("revenue")) {
      return DollarSign
    } else if (titleLower.includes("experience") || titleLower.includes("past")) {
      return Award
    } else if (titleLower.includes("financial") || titleLower.includes("bank")) {
      return BarChart3
    } else if (titleLower.includes("technical") || titleLower.includes("quality")) {
      return FileCheck
    } else if (titleLower.includes("growth") || titleLower.includes("performance")) {
      return TrendingUp
    }
    return FileText // Default icon
  }
  
  const handleNextPartner = () => {
    const currentIndex = bidderNames.indexOf(selectedBidder)
    if (currentIndex < bidderNames.length - 1) {
      setSelectedBidder(bidderNames[currentIndex + 1])
    }
  }
  
  if (loading) {
    const stepKeys = Object.keys(loadingSteps)
    const allStepsComplete = Object.values(loadingSteps).every(step => step === true)
    const currentStep = stepKeys.find((step, index) => {
      if (index === 0) return !loadingSteps[step]
      return loadingSteps[stepKeys[index - 1]] && !loadingSteps[step]
    }) || stepKeys[stepKeys.length - 1]
    
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen bg-slate-50">
          <div className="w-full max-w-md px-8">
            <div className="bg-white rounded-lg shadow-lg p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <FileText className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">Loading Bid Details</h2>
              </div>
              
              {/* Simple Scrolling Text */}
              <div className="mb-6 h-8 overflow-hidden">
                <div className="animate-scroll-text">
                  <p className="text-sm text-slate-600 whitespace-nowrap">
                    {currentStep}... {currentStep}... {currentStep}...
                  </p>
                </div>
              </div>
              
              {/* Simple Checkmarks List */}
              <div className="space-y-2">
                {stepKeys.map((step, index) => {
                  const isComplete = loadingSteps[step]
                  
                  return (
                    <div
                      key={step}
                      className="flex items-center gap-3 text-sm"
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                      )}
                      <span className={isComplete ? "text-green-700" : "text-slate-400"}>
                        {step}
                      </span>
                    </div>
                  )
                })}
              </div>
              
              {/* Completion Message */}
              {allStepsComplete && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-green-600 font-medium">Ready!</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes scroll-text {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-33.333%);
            }
          }
          
          .animate-scroll-text {
            animation: scroll-text 2s linear infinite;
          }
        `}} />
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

  // Generate Excel report for annual turnover evaluation
  const generateExcelReport = async () => {
    try {
      // Create a new workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet("Annual Turnover")
      
      // Title row
      const titleRow = worksheet.addRow(["ANNUAL TURNOVER EVALUATION REPORT"])
      titleRow.height = 30
      titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: "FF1F2937" } }
      titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" }
      worksheet.mergeCells(1, 1, 1, 8)
      
      // Empty row
      worksheet.addRow([])
      
      // Bid and Tender info
      const bidRow = worksheet.addRow(["Bid:", bid?.bid_name || "N/A"])
      bidRow.getCell(1).font = { bold: true, size: 11, color: { argb: "FF4B5563" } }
      bidRow.getCell(2).font = { size: 11, color: { argb: "FF1F2937" } }
      
      const tenderRow = worksheet.addRow(["Tender:", tender?.name || "N/A"])
      tenderRow.getCell(1).font = { bold: true, size: 11, color: { argb: "FF4B5563" } }
      tenderRow.getCell(2).font = { size: 11, color: { argb: "FF1F2937" } }
      
      const dateRow = worksheet.addRow(["Generated:", new Date().toLocaleString()])
      dateRow.getCell(1).font = { bold: true, size: 11, color: { argb: "FF4B5563" } }
      dateRow.getCell(2).font = { size: 11, color: { argb: "FF1F2937" } }
      
      // Empty row
      worksheet.addRow([])
      
      // Header row
      const headerRow = worksheet.addRow([
        "Sr. No.",
        "Financial Year",
        "Abhiraj (40%)",
        "Shraddha (40%)",
        "S.S. Jadhav (20%)",
        "JV Total",
        "Multiplying Factor",
        "Updated Value"
      ])
      headerRow.height = 25
      headerRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" }
        }
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
        cell.border = {
          top: { style: "thin", color: { argb: "FF1E40AF" } },
          bottom: { style: "thin", color: { argb: "FF1E40AF" } },
          left: { style: "thin", color: { argb: "FF1E40AF" } },
          right: { style: "thin", color: { argb: "FF1E40AF" } }
        }
      })
      
      // Data rows
      TURNOVER_YEARS.forEach((year, index) => {
        const yearData = jvTableData[year]
        const yearLabel = YEAR_LABELS[index]
        const isEvenRow = index % 2 === 0
        
        const dataRow = worksheet.addRow([
          yearLabel,
          year,
          yearData?.abhiraj || "-",
          yearData?.shraddha || "-",
          yearData?.ssJadhav || "-",
          yearData?.jvTotal || "-",
          yearData?.multiplyingFactor || "1.00",
          yearData?.updatedValue || "-"
        ])
        dataRow.height = 22
        
        dataRow.eachCell((cell, colNumber) => {
          const isNumeric = colNumber >= 3 && colNumber <= 8 && cell.value !== "-" && cell.value !== null
          
          cell.font = { 
            size: 11, 
            color: { argb: isEvenRow ? "FF1F2937" : "FF374151" } 
          }
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isEvenRow ? "FFF9FAFB" : "FFFFFFFF" }
          }
          cell.alignment = { 
            horizontal: colNumber <= 2 ? "center" : "right",
            vertical: "middle"
          }
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } }
          }
          
          if (isNumeric && typeof cell.value === "number") {
            cell.numFmt = "#,##0.00"
          }
        })
      })
      
      // Empty row
      worksheet.addRow([])
      
      // Summary row
      const summaryRow = worksheet.addRow([
        "Maximum Annual Turnover Value of 'A' (Rs lakhs)",
        "",
        "",
        "",
        "",
        "",
        "",
        jvTableData["2023-24"]?.updatedValue || "20026.11"
      ])
      summaryRow.height = 28
      
      // Format summary label (merged cells A-H)
      const summaryLabelCell = summaryRow.getCell(1)
      summaryLabelCell.font = { bold: true, size: 12, color: { argb: "FF1F2937" } }
      summaryLabelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFF6FF" }
      }
      summaryLabelCell.alignment = { horizontal: "left", vertical: "middle" }
      summaryLabelCell.border = {
        top: { style: "medium", color: { argb: "FF2563EB" } },
        bottom: { style: "medium", color: { argb: "FF2563EB" } },
        left: { style: "medium", color: { argb: "FF2563EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } }
      }
      worksheet.mergeCells(summaryRow.number, 1, summaryRow.number, 7)
      
      // Format summary value
      const summaryValueCell = summaryRow.getCell(8)
      summaryValueCell.font = { bold: true, size: 13, color: { argb: "FF2563EB" } }
      summaryValueCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFF6FF" }
      }
      summaryValueCell.alignment = { horizontal: "right", vertical: "middle" }
      summaryValueCell.border = {
        top: { style: "medium", color: { argb: "FF2563EB" } },
        bottom: { style: "medium", color: { argb: "FF2563EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "medium", color: { argb: "FF2563EB" } }
      }
      if (typeof summaryValueCell.value === "number") {
        summaryValueCell.numFmt = "#,##0.00"
      }
      
      // Set column widths
      worksheet.columns = [
        { width: 12 }, // Sr. No.
        { width: 16 }, // Financial Year
        { width: 20 }, // Abhiraj
        { width: 20 }, // Shraddha
        { width: 20 }, // S.S. Jadhav
        { width: 16 }, // JV Total
        { width: 20 }, // Multiplying Factor
        { width: 20 }  // Updated Value
      ]
      
      // Generate filename
      const bidName = (bid?.bid_name || "Bid Evaluation").replace(/[^a-zA-Z0-9]/g, "_")
      const filename = `${bidName}_Annual_Turnover_${new Date().toISOString().split('T')[0]}.xlsx`
      
      // Write and download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error generating Excel report:", error)
      alert("Error generating Excel report. Please try again.")
    }
  }

  // Loading animation for report generation
  if (isGeneratingReport) {
    return (
      <AppLayout>
        <div className="h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto"></div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-slate-900">Generating Report...</p>
              <p className="text-sm text-slate-600">Please wait while we create your evaluation report</p>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Reports List View
  if (showReports === "list") {
    // Mock reports list - in production, fetch from API
    const reports = [
      {
        id: selectedReportId || `report-${bidId}-${Date.now()}`,
        bidId: bidId,
        bidName: bid?.bid_name || "Bid Evaluation",
        tenderName: tender?.name || "N/A",
        type: "Annual Turnover Evaluation",
        generatedAt: new Date().toLocaleString(),
        status: "completed"
      }
    ]

    return (
      <AppLayout>
        <div className="h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
          {/* Header */}
          <div className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-sm px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
                <p className="text-sm text-slate-600 mt-1">View and manage evaluation reports</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setShowReports("list")
                  setSelectedCriteria("")
                }}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Reports
              </Button>
            </div>
          </div>

          {/* Reports List */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto">
              <div className="space-y-4">
                {reports.map((report) => (
                  <Card
                    key={report.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => {
                      setSelectedReportId(report.id)
                      setShowReports("detail")
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <FileSpreadsheet className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold text-slate-900">{report.type}</h3>
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              {report.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-1">
                            <span className="font-medium">Bid:</span> {report.bidName}
                          </p>
                          <p className="text-sm text-slate-600 mb-1">
                            <span className="font-medium">Tender:</span> {report.tenderName}
                          </p>
                          <p className="text-xs text-slate-500">
                            Generated: {report.generatedAt}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Report Detail View
  if (showReports === "detail") {
    return (
      <AppLayout>
        <div className="h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
          {/* Header */}
          <div className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-sm px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Annual Turnover Evaluation Report</h1>
                <p className="text-sm text-slate-600 mt-1">{bid?.bid_name || "Bid Evaluation"}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowReports("list")}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Reports
                </Button>
                <Button
                  onClick={generateExcelReport}
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export to Excel
                </Button>
              </div>
            </div>
          </div>

          {/* Report Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Joint Venture Annual Turnover Evaluation</h2>
                    <p className="text-sm text-slate-600">Bid: {bid?.bid_name || "N/A"}</p>
                    <p className="text-sm text-slate-600">Tender: {tender?.name || "N/A"}</p>
                    <p className="text-sm text-slate-600">Generated: {new Date().toLocaleString()}</p>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-100">
                          <TableHead className="font-semibold text-center text-slate-900">Sr. No.</TableHead>
                          <TableHead className="font-semibold text-center text-slate-900">Financial Year</TableHead>
                          <TableHead className="font-semibold text-center text-slate-900">Abhiraj (40%)</TableHead>
                          <TableHead className="font-semibold text-center text-slate-900">Shraddha (40%)</TableHead>
                          <TableHead className="font-semibold text-center text-slate-900">S.S. Jadhav (20%)</TableHead>
                          <TableHead className="font-semibold text-center text-slate-900">JV Total</TableHead>
                          <TableHead className="font-semibold text-center text-slate-900">Multiplying Factor</TableHead>
                          <TableHead className="font-semibold text-center text-slate-900">Updated Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {TURNOVER_YEARS.map((year, index) => {
                          const yearData = jvTableData[year]
                          const yearLabel = YEAR_LABELS[index]
                          return (
                            <TableRow key={year} className="hover:bg-slate-50">
                              <TableCell className="font-medium text-center">{yearLabel}</TableCell>
                              <TableCell className="font-medium text-center">{year}</TableCell>
                              <TableCell className="text-center">{yearData?.abhiraj || "-"}</TableCell>
                              <TableCell className="text-center">{yearData?.shraddha || "-"}</TableCell>
                              <TableCell className="text-center">{yearData?.ssJadhav || "-"}</TableCell>
                              <TableCell className="text-center font-medium">{yearData?.jvTotal || "-"}</TableCell>
                              <TableCell className="text-center">{yearData?.multiplyingFactor || "1.00"}</TableCell>
                              <TableCell className="text-center font-semibold text-primary">{yearData?.updatedValue || "-"}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-semibold text-slate-900">
                      Maximum annual Turnover Value of "A" (Rs lakhs) = <span className="text-primary text-lg">{jvTableData["2023-24"]?.updatedValue || "20026.11"}</span> Lakhs
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }
  
  return (
    <AppLayout>
      <div className="h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
        {/* Top Header */}
        <div className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-sm">
          {/* Mode Selector */}
          <div className="px-6 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 mr-2">Mode:</span>
              <button
                onClick={() => setEvaluationMode("bidder_evaluation")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-all rounded-lg",
                  evaluationMode === "bidder_evaluation"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                Bidder Evaluation
              </button>
              <button
                onClick={() => {
                  if (isSubmittedEvidenceUnlocked) {
                    setEvaluationMode("submitted_evidence")
                  }
                }}
                disabled={!isSubmittedEvidenceUnlocked}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-all rounded-lg",
                  !isSubmittedEvidenceUnlocked
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
                    : evaluationMode === "submitted_evidence"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
                title={!isSubmittedEvidenceUnlocked ? "Complete bidder evaluation first" : "Switch to submitted evidence mode"}
              >
                Submitted Evidence {!isSubmittedEvidenceUnlocked && "🔒"}
              </button>
            </div>
          </div>
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
                  {/* Criteria Filters */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {criteriaKeys.map((key) => {
                      const crit = criteria[key]
                      const isSelected = selectedCriteria === key && !showReports
                      const isLocked = !isSelected
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (!isLocked) {
                              setSelectedCriteria(key)
                              setShowReports(null)
                            }
                          }}
                          className={cn(
                            "px-4 py-2 text-sm font-medium transition-all rounded-full flex items-center gap-2",
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm"
                          )}
                          style={isLocked ? { cursor: 'not-allowed', opacity: 1 } : {}}
                        >
                          {isLocked && <Lock className="h-4 w-4 text-amber-500" />}
                          {crit?.title || `Criteria ${key}`}
                        </button>
                      )
                    })}
                    {/* Reports Tab */}
                    <button
                      onClick={() => {
                        if (showReports === "detail") {
                          setShowReports("list")
                        } else {
                          setShowReports("list")
                        }
                        setSelectedCriteria("")
                      }}
                      className={cn(
                        "px-4 py-2 text-sm font-medium transition-all rounded-full flex items-center gap-2",
                        showReports
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm"
                      )}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Reports
                      {showReports && <span className="ml-1 text-xs">●</span>}
                    </button>
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
              <div className={cn(
                "border-b border-slate-100",
                isPdfCollapsed ? "px-3 py-3" : "px-5 py-3"
              )}>
                {isPdfCollapsed ? (
                  <div className="flex flex-col items-center gap-2 w-full">
                    <BookOpen className="h-5 w-5 text-slate-400" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg hover:bg-slate-100"
                      onClick={() => setIsPdfCollapsed(!isPdfCollapsed)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg hover:bg-slate-100"
                      onClick={() => setIsPdfCollapsed(!isPdfCollapsed)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                )}
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
                    bookmarkedPages.length > 0 ? (
                      <div className="space-y-4">
                        {[...bookmarkedPages].sort((a, b) => a - b).map((pageNum) => (
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

            {/* Card 2 - Criteria Evaluation (Uncollapsable) */}
            <div 
              className={cn(
                "flex flex-col bg-white rounded-2xl shadow-lg transition-all duration-300",
                "flex-1 min-w-[400px]"
              )}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Criteria Evaluation</h3>
                  <p className="text-xs text-slate-600 mt-0.5">{currentCriteria?.title || "Annual turnover"}</p>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 flex flex-col">
                <div className="max-w-6xl mx-auto flex-1 flex flex-col">
                    {selectedBidder === "J.V." ? (
                      // J.V. Master Table
                      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/50">
                              <TableHead className="font-semibold text-slate-700">No. of Year</TableHead>
                              <TableHead className="font-semibold text-slate-700">Financial Year</TableHead>
                              <TableHead className="font-semibold text-slate-700 text-center">Abhiraj (40%)</TableHead>
                              <TableHead className="font-semibold text-slate-700 text-center">Shraddha (40%)</TableHead>
                              <TableHead className="font-semibold text-slate-700 text-center">S.S.Jadhav (20%)</TableHead>
                              <TableHead className="font-semibold text-slate-700 text-center">JV Total</TableHead>
                              <TableHead className="font-semibold text-slate-700 text-center">Multiplying Factor</TableHead>
                              <TableHead className="font-semibold text-slate-700 text-center">Updated Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {TURNOVER_YEARS.map((year, index) => {
                              const yearData = jvTableData[year]
                              const yearLabel = YEAR_LABELS[index]
                              return (
                                <TableRow key={year} className="hover:bg-slate-50/50">
                                  <TableCell className="font-medium text-slate-900">{yearLabel}</TableCell>
                                  <TableCell className="font-medium text-slate-900">{year}</TableCell>
                                  <TableCell 
                                    className="text-center cursor-pointer transition-all rounded-lg group hover:bg-slate-100/50"
                                    onClick={() => handleJvCellClick(year, "abhiraj")}
                                    onDoubleClick={() => handleJvCellDoubleClick(year, "abhiraj")}
                                    title="Click to navigate • Double-click to edit"
                                  >
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-sm text-slate-600">{yearData?.abhiraj || "-"}</span>
                                      <span className="text-xs text-slate-400">Pg {evaluationMode === "bidder_evaluation" ? 27 : (partnerData["Abhiraj"]?.[`turnover-${year}`]?.page_number || 111)}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell 
                                    className="text-center cursor-pointer transition-all rounded-lg group hover:bg-slate-100/50"
                                    onClick={() => handleJvCellClick(year, "shraddha")}
                                    onDoubleClick={() => handleJvCellDoubleClick(year, "shraddha")}
                                    title="Click to navigate • Double-click to edit"
                                  >
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-sm text-slate-600">{yearData?.shraddha || "-"}</span>
                                      <span className="text-xs text-slate-400">Pg {evaluationMode === "bidder_evaluation" ? 27 : (partnerData["Shraddha"]?.[`turnover-${year}`]?.page_number || 336)}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell 
                                    className="text-center cursor-pointer transition-all rounded-lg group hover:bg-slate-100/50"
                                    onClick={() => handleJvCellClick(year, "ssJadhav")}
                                    onDoubleClick={() => handleJvCellDoubleClick(year, "ssJadhav")}
                                    title="Click to navigate • Double-click to edit"
                                  >
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-sm text-slate-600">{yearData?.ssJadhav || "-"}</span>
                                      <span className="text-xs text-slate-400">Pg {evaluationMode === "bidder_evaluation" ? 27 : (partnerData["Shankar"]?.[`turnover-${year}`]?.page_number || 808)}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center font-medium text-slate-900 bg-slate-50/30">
                                    {yearData?.jvTotal || "-"}
                                  </TableCell>
                                  <TableCell 
                                    className="text-center cursor-pointer transition-all rounded-lg group hover:bg-slate-100/50"
                                    onClick={() => handleJvCellClick(year, "multiplyingFactor")}
                                    onDoubleClick={() => handleJvCellDoubleClick(year, "multiplyingFactor")}
                                    title="Click to navigate • Double-click to edit"
                                  >
                                    {yearData?.multiplyingFactor || "-"}
                                  </TableCell>
                                  <TableCell className="text-center font-semibold text-slate-900 bg-slate-50/30">
                                    {yearData?.updatedValue || "-"}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                        <div className="p-4 bg-slate-50/50 border-t border-slate-200">
                          <p className="text-sm font-semibold text-slate-900">
                            Maximum annual Turnover Value of "A" Rs lakhs = {jvTableData["2023-24"]?.updatedValue || "20026.11"} Lakhs
                          </p>
                        </div>
                      </div>
                    ) : (
                      // Individual Partner Table
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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="hover:bg-slate-50/50">
                              <TableCell className="font-medium text-slate-900">Annual turnover</TableCell>
                              {TURNOVER_YEARS.map(year => {
                                const cellKey = `turnover-${year}`
                                const cell = cellData[cellKey]
                                return (
                                  <TableCell
                                    key={year}
                                    className="text-center cursor-pointer transition-all rounded-lg group"
                                    onClick={() => handleCellClick(year)}
                                    onDoubleClick={() => handleCellDoubleClick(year)}
                                    title={`Page ${evaluationMode === "bidder_evaluation" ? 27 : (cell?.page_number || (selectedBidder === "Abhiraj" ? 111 : selectedBidder === "Shraddha" ? 336 : 808))} • Modified by ${cell?.metadata?.modified_by || "AI"}`}
                                  >
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-sm text-slate-600">
                                        {cell?.value || "-"}
                                      </span>
                                      <div className="flex items-center gap-1 text-xs text-slate-400">
                                        <span>Pg {evaluationMode === "bidder_evaluation" ? 27 : (cell?.page_number || (selectedBidder === "Abhiraj" ? 111 : selectedBidder === "Shraddha" ? 336 : 808))}</span>
                                        <span className={cn(
                                          "px-1.5 py-0.5 rounded text-xs",
                                          cell?.metadata?.modified_by === "user"
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-slate-100 text-slate-600"
                                        )}>
                                          {cell?.metadata?.modified_by === "user" ? "User" : "AI"}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    
                    <div className="mt-6 p-5 bg-blue-50/50 border border-blue-200/60 rounded-xl">
                      <p className="text-xs text-slate-700 leading-relaxed">
                        <strong className="font-semibold">Info:</strong><br />
                        {selectedBidder === "J.V." ? (
                          <>
                            Click on a cell to navigate to its page reference in the PDF.<br />
                            Double-click to edit the cell value. Changes in J.V. table automatically update partner tables and vice versa.<br />
                            JV Total and Updated Value are automatically calculated from partner values.
                          </>
                        ) : (
                          <>
                            Click on a cell to navigate to its page reference in the PDF.<br />
                            Double-click to edit the cell value and page number. Changes are tracked with metadata showing who modified it (AI or User).<br />
                            Changes in partner tables automatically update the J.V. master table.
                          </>
                        )}
                      </p>
                    </div>
                </div>
              </div>
              <div className="border-t border-slate-100 px-6 py-4">
                <div className="max-w-4xl mx-auto flex justify-end">
                  {selectedBidder === "J.V." ? (
                    <Button 
                      onClick={() => {
                        // Save current data first
                        saveCellData()
                        if (evaluationMode === "bidder_evaluation") {
                          // Unlock submitted evidence mode
                          setIsSubmittedEvidenceUnlocked(true)
                          // Switch to submitted_evidence mode
                          setEvaluationMode("submitted_evidence")
                          // Reset to first partner (Abhiraj) in submitted evidence mode
                          setSelectedBidder("Abhiraj")
                        } else if (evaluationMode === "submitted_evidence") {
                          // Generate report and show it
                          setIsGeneratingReport(true)
                          setTimeout(() => {
                            const reportId = `report-${bidId}-${Date.now()}`
                            setSelectedReportId(reportId)
                            setIsGeneratingReport(false)
                            setShowReports("detail")
                            setSelectedCriteria("")
                          }, 1500) // Simulate report generation
                        }
                      }}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-md hover:shadow-lg transition-all px-6"
                    >
                      Submit and Approve for Evaluation <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleNextPartner}
                      disabled={bidderNames.indexOf(selectedBidder) >= bidderNames.length - 1}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-md hover:shadow-lg transition-all px-6"
                    >
                      Approve and Next <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Card 3 - AI Chat */}
            <div 
              className={cn(
                "flex flex-col bg-white rounded-2xl shadow-lg transition-all duration-300",
                isChatCollapsed ? "w-16" : "flex-1 min-w-[300px]"
              )}
            >
              <div className={cn(
                "border-b border-slate-100",
                isChatCollapsed ? "px-3 py-3" : "px-5 py-3"
              )}>
                {isChatCollapsed ? (
                  <div className="flex flex-col items-center gap-2 w-full">
                    <MessageSquare className="h-5 w-5 text-slate-400" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg hover:bg-slate-100"
                      onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">BidMitra AI chatbot</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg hover:bg-slate-100"
                      onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {!isChatCollapsed && (
                <>
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-slate-400 py-12">
                        <p className="text-sm">Start a conversation</p>
                        <p className="text-xs mt-1">Ask questions about this bid document</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        console.log("🎨 Rendering message:", { id: msg.id, role: msg.role, content: msg.content.substring(0, 50) })
                        return (
                        <div
                          key={msg.id}
                          className={cn(
                            "rounded-xl p-4 text-sm shadow-sm",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground ml-8"
                              : "bg-slate-100 text-slate-900 mr-8 border border-slate-200/60"
                          )}
                        >
                          {msg.isLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>{msg.content}</span>
                            </div>
                          ) : (
                            <>
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                              {msg.searchResults && msg.searchResults.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs font-medium mb-2 text-slate-600">
                                    {msg.searchResults.length} result{msg.searchResults.length > 1 ? "s" : ""} found:
                                  </p>
                                  <div className="grid grid-cols-1 gap-2">
                                    {msg.searchResults.map((result, idx) => {
                                      // CSV page_no is 0-indexed, PDF pages are 1-indexed
                                      const pdfPageNum = parseInt(result.page_no) + 1
                                      const isBookmarked = bookmarkedPages.includes(pdfPageNum)
                                      
                                      return (
                                        <Card
                                          key={idx}
                                          className="cursor-pointer hover:bg-slate-50 transition-colors"
                                          onClick={() => {
                                            setPdfViewMode("full")
                                            jumpToPage(pdfPageNum)
                                          }}
                                        >
                                          <CardContent className="p-3">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 flex-1">
                                                <div
                                                  className="flex items-center"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                  }}
                                                >
                                                  <Checkbox
                                                    checked={isBookmarked}
                                                    onCheckedChange={(checked) => {
                                                      if (checked) {
                                                        if (!bookmarkedPages.includes(pdfPageNum)) {
                                                          setBookmarkedPages(prev => [...prev, pdfPageNum])
                                                        }
                                                      } else {
                                                        setBookmarkedPages(prev => prev.filter(p => p !== pdfPageNum))
                                                      }
                                                      setTimeout(() => saveCellData(), 100)
                                                    }}
                                                  />
                                                </div>
                                                <p className="text-xs font-medium">
                                                  Page {pdfPageNum}
                                                </p>
                                              </div>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                              {result.semantic_meaning.substring(0, 150)}...
                                            </p>
                                          </CardContent>
                                        </Card>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )
                      })
                    )}
                    <div className="text-xs text-slate-500 text-center mt-4">
                      Check pages from search results to add them to bookmarks
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
                        placeholder="Ask questions about the bid document..."
                        className="flex-1 border-slate-300 focus:border-slate-400 rounded-lg"
                        disabled={!bidId}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!input.trim() || !bidId}
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
        {!isBookmarksMinimized && (
          <div className="border-t border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white backdrop-blur-sm shadow-sm px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Bookmarked Pages</span>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex gap-2 overflow-x-auto flex-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 px-2 py-1" style={{ scrollbarWidth: 'thin' }}>
                  {bookmarkedPages.map((page, idx) => (
                    <div key={`bookmark-${page}-${idx}`} className="relative flex-shrink-0 scale-95">
                      <button
                        onClick={() => {
                          setPdfViewMode("full")
                          jumpToPage(page)
                        }}
                        className="w-10 h-12 bg-teal-100 border border-teal-200 rounded-lg text-xs text-teal-700 hover:bg-teal-200 hover:shadow-md transition-all flex items-center justify-center"
                      >
                        {page}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setBookmarkedPages(prev => prev.filter((p, i) => i !== idx))
                          setTimeout(() => saveCellData(), 100)
                        }}
                        className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 border border-red-600 rounded-full text-white hover:bg-red-600 transition-all flex items-center justify-center shadow-sm"
                        title="Remove bookmark"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsBookmarksMinimized(true)}
                  className="text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  minimize <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        {isBookmarksMinimized && (
          <div className="border-t border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white backdrop-blur-sm px-6 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 px-2 py-1" style={{ scrollbarWidth: 'thin' }}>
                {bookmarkedPages.length > 0 ? (
                  bookmarkedPages.map((page, idx) => (
                    <span
                      key={`minimized-bookmark-${page}-${idx}`}
                      className="text-xs text-teal-700 bg-teal-50 px-2 py-1 rounded border border-teal-200 flex-shrink-0 scale-95"
                    >
                      {page}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">No bookmarks</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsBookmarksMinimized(false)}
                className="text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <ChevronUp className="mr-1 h-4 w-4" /> Bookmarked Pages
              </Button>
            </div>
          </div>
        )}
        
        {/* Edit Cell Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Cell Information</DialogTitle>
              <DialogDescription>
                Update the cell value and page number. Changes will be tracked with metadata.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedCell && (
                <div className="p-3 rounded-lg border bg-slate-50 border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Cell:</span> {
                      selectedCell.startsWith("jv-") 
                        ? (() => {
                            const parts = selectedCell.split("-")
                            if (parts.length === 3) {
                              const year = parts[1]
                              const field = parts[2]
                              const fieldLabel = field === "abhiraj" ? "Abhiraj" : field === "shraddha" ? "Shraddha" : field === "ssJadhav" ? "S.S.Jadhav" : "Multiplying Factor"
                              return `${fieldLabel} - ${year}`
                            }
                            return selectedCell
                          })()
                        : selectedCell.replace("turnover-", "")
                    }
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
              <Button
                onClick={handleSaveCell}
                className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
              >
                <Edit className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

export default function Bids4CockpitPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    }>
      <Bids4CockpitContent />
    </Suspense>
  )
}

