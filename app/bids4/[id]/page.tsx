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
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
  
  // Page tray state
  const [trayPages, setTrayPages] = useState<number[]>([])
  const [hasInitializedPartner, setHasInitializedPartner] = useState<Record<string, boolean>>({})
  const [isTrayMinimized, setIsTrayMinimized] = useState(false)
  
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
      // Reload cell data when switching between partners or criteria (including J.V.)
      loadCellData(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCriteria, selectedBidder, bid, tender])
  
  // Also ensure initialization happens when bid/tender loads and messages are empty
  useEffect(() => {
    // Skip initialization for J.V. - keep chat empty
    if (bid && tender && selectedBidder && selectedBidder !== "J.V." && messages.length === 0) {
      // Always initialize if messages are empty, regardless of hasInitializedPartner flag
      const partnerKey = `${selectedCriteria}-${selectedBidder}`
      // Small delay to ensure loadCellData has finished
      const timer = setTimeout(() => {
        setHasInitializedPartner(prev => ({ ...prev, [partnerKey]: true }))
        initializePartnerData(selectedBidder)
      }, 500)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bid, tender, selectedBidder, selectedCriteria, messages.length])
  
  // Initialize partner with RAG prompt and bookmarks
  const initializePartnerData = async (bidderName: string) => {
    // Get required pages for this partner
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
    
    // Add required pages to bookmarks IMMEDIATELY (before RAG)
    // Only add if they're not already present (to avoid duplicates)
    // Use a functional update to ensure we're working with the latest state
    if (requiredPages.length > 0) {
      setTrayPages(prev => {
        // Check if all required pages are already present
        const allPresent = requiredPages.every(page => prev.includes(page))
        if (allPresent) {
          return prev // No need to update if all pages are already there
        }
        
        // Only add pages that aren't already present
        const newPages = [...prev]
        let hasNewPages = false
        requiredPages.forEach(page => {
          if (!newPages.includes(page)) {
            newPages.push(page)
            hasNewPages = true
          }
        })
        
        if (!hasNewPages) {
          return prev // No new pages to add
        }
        
        const sorted = newPages.sort((a, b) => a - b)
        // Save bookmarks immediately - pass bidderName to ensure correct bidder_name
        setTimeout(() => saveCellData(bidderName), 100)
        return sorted
      })
    }
    
    // Skip chat initialization for J.V. - keep it empty
    if (bidderName === "J.V.") {
      setMessages([])
      return
    }
    
    // Create initial RAG prompt
    const partnerName = bidderName === "J.V." ? "Joint Venture" : bidderName
    const initialPrompt = `Annual turnover for ${partnerName} certified by CA`
    
    // Add user message first (the query)
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: initialPrompt,
      timestamp: new Date(),
    }
    setMessages([userMessage])
    
    // Add loading message
    const loadingMessageId = `loading-${Date.now()}`
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: "assistant",
      content: "Searching for annual turnover information...",
      isLoading: true,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, loadingMessage])
    
    // Send initial RAG query
    if (bidId) {
      try {
        const response = await fetch(`${API_BASE_URL}/bids/${bidId}/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: initialPrompt,
            n_results: 10,
          }),
        })
        
        let results: SearchResult[] = []
        if (response.ok) {
          const data = await response.json()
          results = (data.results || []).map((r: any) => ({
            ...r,
            document_name: bid?.bid_name || "Bid Document",
          }))
          
          // Add RAG result pages to bookmarks (only if not already present)
          const ragPages = results.map(r => parseInt(r.page_no) + 1).filter((p, i, arr) => arr.indexOf(p) === i)
          setTrayPages(prev => {
            // Check if any new pages need to be added
            const newPagesToAdd = ragPages.filter(page => !prev.includes(page))
            if (newPagesToAdd.length === 0) {
              return prev // No new pages to add
            }
            
            const newPages = [...prev]
            newPagesToAdd.forEach(page => {
              newPages.push(page)
            })
            return newPages.sort((a, b) => a - b)
          })
          
          // Update loading message with RAG results - formatted properly
          setMessages(prev => prev.map(msg =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  content: `Annual turnover for ${partnerName} certified by CA.\n\nFound ${results.length} relevant result${results.length > 1 ? "s" : ""} from the bid document.`,
                  isLoading: false,
                  searchResults: results,
                }
              : msg
          ))
          
          // Save after initialization (with a delay to ensure state is updated)
          // Pass bidderName explicitly to ensure correct bidder_name is saved
          setTimeout(() => {
            saveCellData(bidderName)
          }, 1000)
        }
      } catch (error) {
        console.error("Error initializing partner data:", error)
        // Update loading message with error - formatted properly
        setMessages(prev => prev.map(msg =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                content: `Annual turnover for ${partnerName} certified by CA.\n\nError searching documents. Please try again.`,
                isLoading: false,
                searchResults: [],
              }
            : msg
        ))
        
        // Save after initialization even if RAG fails
        // Pass bidderName explicitly to ensure correct bidder_name is saved
        setTimeout(() => {
          saveCellData(bidderName)
        }, 500)
      }
    } else {
      // If no bidId, still show the query and response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `Annual turnover for ${partnerName} certified by CA.`,
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
        
        // Only update session state on initial load
        if (isInitialLoad) {
          if (data.current_selected_criteria) setSelectedCriteria(data.current_selected_criteria)
          // Always default to first partner (Abhiraj) on initial load, ignore saved bidder
          // This ensures consistent behavior - first partner always opens by default
          setSelectedBidder("Abhiraj")
          if (data.current_pdf_page) setCurrentPdfPage(data.current_pdf_page)
        }
        
        // Load data for ALL partners, not just selected bidder
        if (data.criterias?.[selectedCriteria]?.metadata?.tables) {
          const tables = data.criterias[selectedCriteria].metadata.tables
          const partnersToLoad = ["Abhiraj", "Shraddha", "Shankar"]
          
          partnersToLoad.forEach(bidderName => {
            const tableId = `table-${selectedCriteria}-${bidderName}`
            const table = tables[tableId]
            
            if (table?.cells && Object.keys(table.cells).length > 0) {
              const partnerCellData: Record<string, CellData> = {}
              
              Object.entries(table.cells).forEach(([cellKey, cell]: [string, any]) => {
                partnerCellData[cellKey] = {
                  value: cell.value || "",
                  page_number: cell.page_number || (bidderName === "Abhiraj" ? 111 : bidderName === "Shraddha" ? 336 : 808),
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
            const currentValidation = data.validations?.find(
              (v: any) => v.criteria_key === selectedCriteria && 
                          v.bidder_name === bidderName
            )
            
            if (currentValidation && currentValidation.cell_data && Object.keys(currentValidation.cell_data).length > 0) {
              const partnerCellData: Record<string, CellData> = {}
              Object.entries(currentValidation.cell_data || {}).forEach(([key, cell]: [string, any]) => {
                partnerCellData[key] = {
                  value: cell.value || "",
                  page_number: cell.page_number || (bidderName === "Abhiraj" ? 111 : bidderName === "Shraddha" ? 336 : 808),
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
        setTrayPages([])
        
        // Load bookmarked pages for current criteria and bidder
        // For individual partners: only show their specific bookmarks
        // For J.V.: show combined bookmarks from all partners
        let criteriaBookmarks: any[] = []
        if (selectedBidder === "J.V.") {
          // J.V. gets combined bookmarks from all partners
          criteriaBookmarks = (data.bookmarked_pages || []).filter(
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
          criteriaBookmarks = (data.bookmarked_pages || []).filter(
            (bm: any) => {
              if (bm.criteria_key !== selectedCriteria) return false
              // Only show bookmarks for this specific partner (ignore old format)
              return bm.bidder_name === selectedBidder
            }
          ) || []
        }
        // Remove duplicates and sort
        const uniquePages = Array.from(new Set(criteriaBookmarks.map((bm: any) => bm.page_number))).sort((a, b) => a - b)
        setTrayPages(uniquePages)
        
        // If no bookmarks found, add required pages immediately
        if (uniquePages.length === 0) {
          const requiredPages = selectedBidder === "Abhiraj" ? [111] 
                           : selectedBidder === "Shraddha" ? [336] 
                           : selectedBidder === "Shankar" ? [808] 
                           : selectedBidder === "J.V." ? [111, 336, 808] 
                           : []
          if (requiredPages.length > 0) {
            setTrayPages(requiredPages)
          }
        }
        
        // Load chat messages for current criteria and bidder
        // Skip loading messages for J.V. - keep chat empty, but still add bookmarks
        if (selectedBidder === "J.V.") {
          setMessages([])
          // J.V. bookmarks are already loaded above (uniquePages), so no need to add again
          // The bookmarks should already include all partner pages from the filter above
        } else {
          // Only load messages that have bidder_name matching current bidder (ignore old format)
          const criteriaMessages = (data.chat_messages || []).filter(
            (msg: any) => {
              if (msg.criteria_key !== selectedCriteria) return false
              // Only show messages that have bidder_name matching current bidder
              // Ignore old messages without bidder_name
              return msg.bidder_name === selectedBidder
            }
          ) || []
          
          if (criteriaMessages.length > 0) {
            setMessages(criteriaMessages.map((msg: any, idx: number) => ({
              id: msg.message_id || `msg-${idx}`,
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.created_at || Date.now()),
              searchResults: msg.searchResults || []
            })))
          } else {
            // No messages found - always initialize (clear flag to allow re-initialization)
            const partnerKey = `${selectedCriteria}-${selectedBidder}`
            // Always initialize if no messages exist, regardless of hasInitializedPartner flag
            setHasInitializedPartner(prev => ({ ...prev, [partnerKey]: true }))
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
  const saveCellData = async (bidderNameOverride?: string) => {
    try {
      // Use override if provided, otherwise use selectedBidder from state
      const bidderToSave = bidderNameOverride || selectedBidder
      
      // Fetch current data
      const response = await fetch("/api/bid-evaluation")
      const currentData = await response.ok ? await response.json() : {}
      
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
        Object.entries(dataToSave).forEach(([cellKey, cell]) => {
          criterias[selectedCriteria].metadata.tables[tableId].cells[cellKey] = {
            value: cell.value,
            page_number: cell.page_number,
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
          
          criterias[selectedCriteria].metadata.tables[jvTableId].cells[`multiplyingFactor-${year}`] = {
            value: yearData.multiplyingFactor,
            page_number: yearData.pageNumber || 111,
            metadata: {
              modified_by: modifiedBy,
              modified_at: modifiedAt
            }
          }
        }
      })
      
      // Update bookmarked pages for current criteria and bidder
      // Only save bookmarks that belong to this specific bidder
      // trayPages should already be filtered to only contain this bidder's pages (cleared in loadCellData)
      const bookmarkedPages = currentData.bookmarked_pages || []
      const criteriaBookmarks = bookmarkedPages.filter(
        (bm: any) => !(bm.criteria_key === selectedCriteria && bm.bidder_name === bidderToSave)
      )
      
      // Save all pages in trayPages for this bidder
      // trayPages is cleared when switching partners, so it only contains current partner's pages
      trayPages.forEach(pageNum => {
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
      const validMessages = messages.filter(msg => {
        const content = msg.content || ""
        // Skip if message content mentions a different partner
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
      
      validMessages.forEach((msg, idx) => {
        otherCriteriaMessages.push({
          message_id: msg.id || `msg-${selectedCriteria}-${bidderToSave}-${idx}`,
          role: msg.role,
          content: msg.content,
          criteria_key: selectedCriteria,
          bidder_name: bidderToSave,
          created_at: msg.timestamp?.toISOString() || new Date().toISOString(),
          searchResults: msg.searchResults || []
        })
      })
      
      // Prepare updated data
      const updatedData = {
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
      
      // Save to API
      await fetch("/api/bid-evaluation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData)
      })
    } catch (error) {
      console.error("Error saving cell data:", error)
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
    
    // Only render pages that haven't been rendered yet
    const pagesToRender = [...trayPages]
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
  
  // Render bookmarked pages when trayPages change and PDF is ready
  useEffect(() => {
    if (pdfDocumentRef.current && trayPages.length > 0 && pdfViewMode === "bookmarked" && !loadingPdf) {
      // Always render bookmarked pages when trayPages changes (renderBookmarkedPages checks if already rendered)
      renderBookmarkedPages(pdfDocumentRef.current)
    }
  }, [trayPages, pdfViewMode, loadingPdf])
  
  // Also render bookmarked pages when PDF finishes loading
  useEffect(() => {
    if (!loadingPdf && pdfDocumentRef.current && trayPages.length > 0 && pdfViewMode === "bookmarked") {
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
      // RAG Search
      const response = await fetch(`${API_BASE_URL}/bids/${bidId}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query,
          n_results: 10,
        }),
      })

      let results: SearchResult[] = []
      if (response.ok) {
        const data = await response.json()
        results = (data.results || []).map((r: any) => ({
          ...r,
          document_name: bid?.bid_name || "Bid Document",
        }))
      }

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
        setTrayPages(prev => {
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
      const pageNumber = cell.page_number || (selectedBidder === "Abhiraj" ? 111 : selectedBidder === "Shraddha" ? 336 : 808)
      // Switch to full PDF view and jump to page
      setPdfViewMode("full")
      jumpToPage(pageNumber)
    }
  }
  
  const handleCellDoubleClick = (year: string) => {
    // Double click: Open edit dialog - allow editing even if cell is empty
    const cellKey = `turnover-${year}`
    const cell = cellData[cellKey]
    const defaultPage = selectedBidder === "Abhiraj" ? 111 : selectedBidder === "Shraddha" ? 336 : 808
    
    setSelectedCell(cellKey)
    setEditingValue(cell?.value || "")
    setEditingPageNumber(cell?.page_number || defaultPage)
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
              pageNumber: editingPageNumber
            }
          }
          
          updated[year] = {
            ...updated[year],
            [field]: editingValue,
            pageNumber: editingPageNumber
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
              page_number: editingPageNumber,
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
                page_number: editingPageNumber,
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
              page_number: editingPageNumber,
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
                page_number: editingPageNumber,
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
              page_number: editingPageNumber,
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
                page_number: editingPageNumber,
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
                pageNumber: editingPageNumber
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
                pageNumber: editingPageNumber
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
          page_number: editingPageNumber,
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
          page_number: editingPageNumber,
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
  
  const addPageToTray = (pageNum: number) => {
    if (!trayPages.includes(pageNum)) {
      setTrayPages(prev => [...prev, pageNum])
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
  
  const handleNextCriteria = () => {
    const currentIndex = criteriaKeys.indexOf(selectedCriteria)
    if (currentIndex < criteriaKeys.length - 1) {
      setSelectedCriteria(criteriaKeys[currentIndex + 1])
    }
  }
  
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
                      const isSelected = selectedCriteria === key
                      const isLocked = !isSelected
                      return (
                        <button
                          key={key}
                          onClick={() => !isLocked && setSelectedCriteria(key)}
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
                                      <span className="text-xs text-slate-400">Pg {partnerData["Abhiraj"]?.[`turnover-${year}`]?.page_number || 111}</span>
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
                                      <span className="text-xs text-slate-400">Pg {partnerData["Shraddha"]?.[`turnover-${year}`]?.page_number || 336}</span>
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
                                      <span className="text-xs text-slate-400">Pg {partnerData["Shankar"]?.[`turnover-${year}`]?.page_number || 808}</span>
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
                                    title={`Page ${cell?.page_number || (selectedBidder === "Abhiraj" ? 111 : selectedBidder === "Shraddha" ? 336 : 808)} • Modified by ${cell?.metadata?.modified_by || "AI"}`}
                                  >
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-sm text-slate-600">
                                        {cell?.value || "-"}
                                      </span>
                                      <div className="flex items-center gap-1 text-xs text-slate-400">
                                        <span>Pg {cell?.page_number || (selectedBidder === "Abhiraj" ? 111 : selectedBidder === "Shraddha" ? 336 : 808)}</span>
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
                  <Button 
                    onClick={handleNextCriteria}
                    disabled={criteriaKeys.indexOf(selectedCriteria) >= criteriaKeys.length - 1}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-md hover:shadow-lg transition-all px-6"
                  >
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
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
                      messages.map((msg) => (
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
                                      const isBookmarked = trayPages.includes(pdfPageNum)
                                      
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
                                                        if (!trayPages.includes(pdfPageNum)) {
                                                          setTrayPages(prev => [...prev, pdfPageNum])
                                                        }
                                                      } else {
                                                        setTrayPages(prev => prev.filter(p => p !== pdfPageNum))
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
                      ))
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
        {!isTrayMinimized && (
          <div className="border-t border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white backdrop-blur-sm shadow-sm px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Bookmarked Pages</span>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex gap-2 overflow-x-auto flex-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 px-2 py-1" style={{ scrollbarWidth: 'thin' }}>
                  {trayPages.map((page, idx) => (
                    <div key={`tray-bookmark-${page}-${idx}`} className="relative flex-shrink-0 scale-95">
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
                          setTrayPages(prev => prev.filter((p, i) => i !== idx))
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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 px-2 py-1" style={{ scrollbarWidth: 'thin' }}>
                {trayPages.length > 0 ? (
                  trayPages.map((page, idx) => (
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
                onClick={() => setIsTrayMinimized(false)}
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

