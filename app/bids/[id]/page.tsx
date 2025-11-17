"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Loader2, BookOpen, Sparkles, FileText, X, ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, Sparkles as SparklesIcon, MessageSquare, MessageSquareOff, RefreshCw } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getLLMConfig, getCDACEndpoint, isLLMConfigured } from "@/lib/llm-config"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
  subPoints?: Record<string, { title: string; value: string; description?: string }>
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  searchResults?: SearchResult[]
  isLoading?: boolean
}

interface SearchResult {
  document_id: string
  document_name?: string
  page_no: string
  content: string
  semantic_meaning: string
  similarity_score?: number
}

export default function BidDetailPage() {
  const params = useParams()
  const bidId = params.id as string
  
  const [bid, setBid] = useState<Bid | null>(null)
  const [tender, setTender] = useState<Tender | null>(null)
  const [loading, setLoading] = useState(true)
  const [criteria, setCriteria] = useState<Record<string, Criteria>>({})
  const [selectedCriteria, setSelectedCriteria] = useState<string | null>(null)
  
  // Chat state - per criteria
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [input, setInput] = useState("")
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // PDF view state
  const [showPdfView, setShowPdfView] = useState(true) // Show by default
  const [currentPdfPage, setCurrentPdfPage] = useState(1)
  const [pdfPageImage, setPdfPageImage] = useState<string | null>(null)
  const [loadingPdfPage, setLoadingPdfPage] = useState(false)
  
  // PDF view width state (for horizontal resizing)
  const [pdfViewWidth, setPdfViewWidth] = useState(60) // Percentage, default 60%
  const [isResizingPdf, setIsResizingPdf] = useState(false)
  const pdfViewContainerRef = useRef<HTMLDivElement>(null)
  
  // Bid data chunks - for page navigation
  const [bidDataChunks, setBidDataChunks] = useState<SearchResult[]>([])
  
  // Considered pages state - keyed by criteria key
  const [consideredPages, setConsideredPages] = useState<Record<string, Set<string>>>({})
  
  // LLM generation state
  const [generatingCriteria, setGeneratingCriteria] = useState<string | null>(null)
  const [queryDialogOpen, setQueryDialogOpen] = useState(false)
  const [queryInput, setQueryInput] = useState("")
  const [criteriaValues, setCriteriaValues] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Resizable pane state
  const [leftWidth, setLeftWidth] = useState(30) // Percentage
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  
  // Chat mode state: "search" for RAG only, "llm" for RAG + LLM
  const [chatMode, setChatMode] = useState<"search" | "llm">("llm")
  
  // Show/hide chat and considered pages
  const [showChatAndPages, setShowChatAndPages] = useState(false)

  useEffect(() => {
    fetchBidData()
    fetchBidDataChunks()
  }, [bidId])

  // Simple markdown to HTML converter
  const markdownToHtml = (markdown: string): string => {
    if (!markdown) return ""
    
    // Split by lines to process list items properly
    const lines = markdown.split('\n')
    const htmlLines: string[] = []
    let inList = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()
      
      // Check if this is a list item
      if (trimmedLine.startsWith('* ')) {
        if (!inList) {
          htmlLines.push('<ul>')
          inList = true
        }
        const content = trimmedLine.substring(2)
        // Process bold in list item
        const processedContent = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        htmlLines.push(`<li>${processedContent}</li>`)
      } else {
        if (inList) {
          htmlLines.push('</ul>')
          inList = false
        }
        
        if (trimmedLine) {
          // Process bold
          let processedLine = trimmedLine.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          htmlLines.push(processedLine)
        } else {
          htmlLines.push('<br />')
        }
      }
    }
    
    // Close list if still open
    if (inList) {
      htmlLines.push('</ul>')
    }
    
    return htmlLines.join('')
  }

  // Manual query trigger function
  const handleQueryCriteria = async (key: string) => {
    if (!bidId || !bid) return

    const crit = criteria[key]
    const query = crit.description || getDefaultDescription(crit.title)
    
    if (!query.trim()) return

    // Show chat and pages
    setShowChatAndPages(true)
    setSelectedCriteria(key)

    // Create user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: new Date(),
    }

    setMessages((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), userMessage],
    }))

    // Add loading message
    const loadingMessageId = (Date.now() + 1).toString()
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: "assistant",
      content: "Searching bid documents...",
      isLoading: true,
      timestamp: new Date(),
    }
    setMessages((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), loadingMessage],
    }))

    try {
      // Step 1: RAG Search
      const searchResponse = await fetch(`${API_BASE_URL}/bids/${bidId}/search`, {
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
      if (searchResponse.ok) {
        const data = await searchResponse.json()
        results = (data.results || []).map((r: any) => ({
          ...r,
          document_name: bid?.bid_name || "Bid Document",
        }))
      }

      // Mark all initial search result pages as considered/selected
      if (results.length > 0) {
        setConsideredPages(prev => {
          const newPages = { ...prev }
          if (!newPages[key]) {
            newPages[key] = new Set()
          }
          newPages[key] = new Set(newPages[key])
          
          results.forEach(result => {
            const pageKey = `${result.page_no}`
            newPages[key].add(pageKey)
          })
          
          return newPages
        })
      }

      // Update message with search results
      setMessages((prev) => ({
        ...prev,
        [key]: (prev[key] || []).map((msg) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                content: "Generating response...",
                isLoading: true,
                searchResults: results,
              }
            : msg
        ),
      }))

      // Step 2: LLM Generation (if configured)
      if (isLLMConfigured()) {
        const llmConfig = getLLMConfig()
        
        // Collect top 5 pages from RAG search results
        const ragContent: string[] = []
        if (results.length > 0) {
          const topResults = results.slice(0, 5)
          topResults.forEach((result) => {
            ragContent.push(`Page ${parseInt(result.page_no) + 1}:\n${result.content}\n\nSemantic Meaning: ${result.semantic_meaning}`)
          })
        }

        // Collect ALL considered pages (including those from previous queries)
        const consideredPagesForCriteria = consideredPages[key]
        const consideredPagesContent: string[] = []
        if (consideredPagesForCriteria && consideredPagesForCriteria.size > 0) {
          const sortedPageNos = Array.from(consideredPagesForCriteria).sort((a, b) => {
            const numA = parseInt(a) || 0
            const numB = parseInt(b) || 0
            return numA - numB
          })

          for (const pageNo of sortedPageNos) {
            const pageChunk = bidDataChunks.find(chunk => chunk.page_no === pageNo)
            if (pageChunk) {
              // Only add if not already in current RAG results
              const alreadyInRag = results.some(r => r.page_no === pageNo)
              if (!alreadyInRag) {
                consideredPagesContent.push(`Page ${parseInt(pageNo) + 1}:\n${pageChunk.content}\n\nSemantic Meaning: ${pageChunk.semantic_meaning}`)
              }
            }
          }
        }

        // Build context content
        const contextParts: string[] = []
        if (ragContent.length > 0) {
          contextParts.push("=== CURRENT SEARCH RESULTS (Top 5) ===\n" + ragContent.join("\n\n---\n\n"))
        }
        if (consideredPagesContent.length > 0) {
          contextParts.push("=== ALL CONSIDERED PAGES ===\n" + consideredPagesContent.join("\n\n---\n\n"))
        }

        const contextContent = contextParts.join("\n\n")

        const prompt = `You are an AI assistant helping with bid document evaluation. Based on the following context from the bid document, answer the query/question. Extract the specific value or information requested.

${contextContent}

Query: ${query}

Please provide a clear, comprehensive answer with the specific value or information. Format your response with markdown if needed (use **bold** for emphasis, * for lists). If the information is not available in the context, please state "N/A".`

        try {
          let generatedText = ""
          if (llmConfig.provider === "gemini") {
            if (llmConfig.geminiApiKey) {
              const llmResponse = await fetch(`${API_BASE_URL}/llm/generate`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  provider: "gemini",
                  api_key: llmConfig.geminiApiKey,
                  prompt: prompt,
                  max_tokens: 1024,
                }),
              })

              if (llmResponse.ok) {
                const llmData = await llmResponse.json()
                generatedText = llmData.response || "N/A"
              } else {
                generatedText = "N/A"
              }
            } else {
              generatedText = "N/A"
            }
          } else if (llmConfig.provider === "cdac") {
            if (llmConfig.cdacApiKey) {
              const llmResponse = await fetch(`${API_BASE_URL}/llm/generate`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  provider: "cdac",
                  api_key: llmConfig.cdacApiKey,
                  prompt: prompt,
                  max_tokens: 1024,
                }),
              })

              if (llmResponse.ok) {
                const llmData = await llmResponse.json()
                generatedText = llmData.response || "N/A"
              } else {
                generatedText = "N/A"
              }
            } else {
              generatedText = "N/A"
            }
          } else {
            generatedText = "N/A"
          }

          // Update criteria value
          setCriteriaValues(prev => ({
            ...prev,
            [key]: generatedText
          }))

          // Mark all RAG result pages as considered for initial query
          if (results.length > 0) {
            setConsideredPages(prev => {
              const newPages = { ...prev }
              if (!newPages[key]) {
                newPages[key] = new Set()
              }
              newPages[key] = new Set(newPages[key])
              
              results.forEach(result => {
                newPages[key].add(result.page_no)
              })
              
              return newPages
            })
          }

          // Update message with LLM response
          setMessages((prev) => ({
            ...prev,
            [key]: (prev[key] || []).map((msg) =>
              msg.id === loadingMessageId
                ? {
                    ...msg,
                    content: generatedText,
                    isLoading: false,
                    searchResults: results,
                  }
                : msg
            ),
          }))
        } catch (llmError) {
          console.error(`Error in LLM generation for criteria ${key}:`, llmError)
          setCriteriaValues(prev => ({
            ...prev,
            [key]: "N/A"
          }))
          setMessages((prev) => ({
            ...prev,
            [key]: (prev[key] || []).map((msg) =>
              msg.id === loadingMessageId
                ? {
                    ...msg,
                    content: "N/A",
                    isLoading: false,
                    searchResults: results,
                  }
                : msg
            ),
          }))
        }
      } else {
        // LLM not configured, just show RAG results
        setCriteriaValues(prev => ({
          ...prev,
          [key]: "N/A"
        }))
        setMessages((prev) => ({
          ...prev,
          [key]: (prev[key] || []).map((msg) =>
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
          ),
        }))
      }
    } catch (error) {
      console.error(`Error querying criteria ${key}:`, error)
      setCriteriaValues(prev => ({
        ...prev,
        [key]: "N/A"
      }))
      setMessages((prev) => ({
        ...prev,
        [key]: (prev[key] || []).map((msg) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                content: "Error processing query. Please try again.",
                isLoading: false,
                searchResults: [],
              }
            : msg
        ),
      }))
    }
  }

  // Fetch all bid data chunks for page navigation
  const fetchBidDataChunks = async () => {
    if (!bidId) return
    try {
      const response = await fetch(`${API_BASE_URL}/bids/${bidId}/data`)
      if (response.ok) {
        const data = await response.json()
        const chunks = Array.isArray(data.chunks) ? data.chunks : []
        // Map chunks to SearchResult format
        const mappedChunks: SearchResult[] = chunks.map((chunk: any) => ({
          document_id: chunk.id || chunk.document_id || "",
          document_name: chunk.document_name || "Bid Document",
          page_no: chunk.page_no?.toString() || "0",
          content: chunk.content || "",
          semantic_meaning: chunk.semantic_meaning || "",
        }))
        setBidDataChunks(mappedChunks)
      }
    } catch (err) {
      console.error("Error fetching bid data chunks:", err)
    }
  }

  // Auto-scroll chat to bottom when new messages arrive for current criteria
  useEffect(() => {
    if (chatMessagesRef.current && selectedCriteria) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [messages, selectedCriteria])

  // Clear input when switching criteria tabs
  useEffect(() => {
    setInput("")
  }, [selectedCriteria])

  // Sync PDF page when selected result changes
  useEffect(() => {
    if (selectedResult && isDialogOpen) {
      // CSV page_no is 0-indexed, PDF pages are 1-indexed, so add 1
      const csvPageNo = parseInt(selectedResult.page_no) || 0
      setCurrentPdfPage(csvPageNo + 1)
    }
  }, [selectedResult, isDialogOpen])

  // Update content and semantic meaning when PDF page changes
  useEffect(() => {
    if (showPdfView && bidDataChunks.length > 0) {
      // currentPdfPage is 1-indexed (for PDF), CSV page_no is 0-indexed, so subtract 1
      const csvPageNo = currentPdfPage - 1
      const pageChunk = bidDataChunks.find(
        chunk => parseInt(chunk.page_no) === csvPageNo
      )
      if (pageChunk) {
        setSelectedResult(pageChunk)
      }
    }
  }, [currentPdfPage, showPdfView, bidDataChunks])

  // Load and render PDF page as image using PDF.js from CDN
  useEffect(() => {
    if (showPdfView && bid && currentPdfPage > 0 && isDialogOpen) {
      setLoadingPdfPage(true)
      setPdfPageImage(null)
      
      const pdfUrl = bid.pdf_path.startsWith('http') 
        ? bid.pdf_path 
        : `${API_BASE_URL}/${bid.pdf_path}`
      
      // Load PDF.js from CDN via script tag
      const loadPdfPage = () => {
        // Check if PDF.js is already loaded
        if ((window as any).pdfjsLib || (window as any).pdfjs) {
          const pdfjsLib = (window as any).pdfjsLib || (window as any).pdfjs
          renderPdfPage(pdfjsLib, pdfUrl)
          return
        }
        
        // Load PDF.js script from unpkg (better UMD support)
        const existingScript = document.querySelector('script[src*="pdf.js"]')
        if (existingScript) {
          // Script already exists, wait a bit and try again
          setTimeout(() => {
            const pdfjsLib = (window as any).pdfjsLib || (window as any).pdfjs
            if (pdfjsLib) {
              renderPdfPage(pdfjsLib, pdfUrl)
            } else {
              setLoadingPdfPage(false)
            }
          }, 100)
          return
        }
        
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'
        script.onload = () => {
          // PDF.js from unpkg exposes as pdfjsLib
          const pdfjsLib = (window as any).pdfjsLib
          if (pdfjsLib) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
            renderPdfPage(pdfjsLib, pdfUrl)
          } else {
            console.error('PDF.js not found on window object')
            setLoadingPdfPage(false)
          }
        }
        script.onerror = () => {
          console.error('Failed to load PDF.js')
          setLoadingPdfPage(false)
        }
        document.head.appendChild(script)
      }
      
      const renderPdfPage = async (pdfjsLib: any, url: string) => {
        try {
          // Load the PDF
          const loadingTask = pdfjsLib.getDocument(url)
          const pdf = await loadingTask.promise
          
          // Get the specific page (PDF pages are 1-indexed)
          const page = await pdf.getPage(currentPdfPage)
          
          // Set scale for rendering
          const scale = 2.0
          const viewport = page.getViewport({ scale })
          
          // Create canvas
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) {
            throw new Error('Could not get canvas context')
          }
          
          canvas.height = viewport.height
          canvas.width = viewport.width
          
          // Render the page
          const renderContext = {
            canvasContext: context,
            viewport: viewport
          }
          
          await page.render(renderContext).promise
          
          // Convert canvas to image data URL
          const imageDataUrl = canvas.toDataURL('image/png')
          setPdfPageImage(imageDataUrl)
        } catch (error) {
          console.error('Error rendering PDF page:', error)
          setPdfPageImage(null)
        } finally {
          setLoadingPdfPage(false)
        }
      }
      
      loadPdfPage()
    }
  }, [showPdfView, currentPdfPage, bid, isDialogOpen])

  // Get default description for criteria based on title
  const getDefaultDescription = (title: string): string => {
    const titleLower = title.toLowerCase()
    if (titleLower.includes("annual turnover")) {
      return "5 year anual turnover ca certified."
    } else if (titleLower.includes("bid capacity")) {
      return "bid capacity calculation page"
    } else if (titleLower.includes("similar type of work") || titleLower.includes("completed similar")) {
      return "similar type of work done."
    } else if (titleLower.includes("quantities") || titleLower.includes("executed")) {
      return "general exprience table maximum amount of quantities executed table."
    }
    return ""
  }

  const fetchBidData = async () => {
    try {
      setLoading(true)
      
      // Fetch bid
      const bidResponse = await fetch(`${API_BASE_URL}/bids/${bidId}`)
      if (bidResponse.ok) {
        const bidData = await bidResponse.json()
        setBid(bidData)
        
        // Fetch tender if tender_id exists - this is required for evaluation criteria
        if (bidData.tender_id) {
          const tenderResponse = await fetch(`${API_BASE_URL}/tenders/${bidData.tender_id}`)
          if (tenderResponse.ok) {
            const tenderData = await tenderResponse.json()
            setTender(tenderData)
            
            // Parse evaluation criteria from tender and add default descriptions if missing
            const criteriaJson = JSON.parse(tenderData.evaluation_criteria_json || "{}")
            const enrichedCriteria: Record<string, Criteria> = {}
            
            for (const [key, crit] of Object.entries(criteriaJson)) {
              const criteria = crit as Criteria
              enrichedCriteria[key] = {
                ...criteria,
                description: criteria.description || getDefaultDescription(criteria.title)
              }
            }
            
            setCriteria(enrichedCriteria)
            
            // Set first criteria as selected
            const firstCriteriaKey = Object.keys(enrichedCriteria).sort((a, b) => {
              const numA = parseInt(a) || 0
              const numB = parseInt(b) || 0
              return numA - numB
            })[0]
            if (firstCriteriaKey) {
              setSelectedCriteria(firstCriteriaKey)
            }
          } else {
            console.error("Failed to fetch tender:", await tenderResponse.text())
          }
        } else {
          console.warn("Bid has no tender_id - cannot load evaluation criteria")
        }
      } else {
        console.error("Failed to fetch bid:", await bidResponse.text())
      }
    } catch (err) {
      console.error("Error fetching bid data:", err)
    } finally {
      setLoading(false)
    }
  }

  // Resizable pane handlers (vertical divider for left column)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return
      
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100
      
      // Constrain between 20% and 60%
      const constrainedWidth = Math.max(20, Math.min(60, newLeftWidth))
      setLeftWidth(constrainedWidth)
    },
    [isResizing]
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Horizontal resizing handlers for PDF view divider
  const handlePdfResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingPdf(true)
  }, [])

  const handlePdfResizeMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingPdf || !pdfViewContainerRef.current) return
      
      const container = pdfViewContainerRef.current
      const rect = container.getBoundingClientRect()
      const newPdfWidth = ((e.clientX - rect.left) / rect.width) * 100
      
      // Constrain between 30% and 80%
      const constrainedWidth = Math.max(30, Math.min(80, newPdfWidth))
      setPdfViewWidth(constrainedWidth)
    },
    [isResizingPdf]
  )

  const handlePdfResizeMouseUp = useCallback(() => {
    setIsResizingPdf(false)
  }, [])

  useEffect(() => {
    if (isResizingPdf) {
      document.addEventListener("mousemove", handlePdfResizeMouseMove)
      document.addEventListener("mouseup", handlePdfResizeMouseUp)
      return () => {
        document.removeEventListener("mousemove", handlePdfResizeMouseMove)
        document.removeEventListener("mouseup", handlePdfResizeMouseUp)
      }
    }
  }, [isResizingPdf, handlePdfResizeMouseMove, handlePdfResizeMouseUp])

  const handleSendMessage = async () => {
    if (!input.trim() || !bidId || !selectedCriteria) return

    const query = input.trim()
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: new Date(),
    }

    setMessages((prev) => ({
      ...prev,
      [selectedCriteria]: [...(prev[selectedCriteria] || []), userMessage],
    }))

    // Add loading message
    const loadingMessageId = (Date.now() + 1).toString()
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: "assistant",
      content: "Searching bid documents...",
      isLoading: true,
      timestamp: new Date(),
    }
    setMessages((prev) => ({
      ...prev,
      [selectedCriteria]: [...(prev[selectedCriteria] || []), loadingMessage],
    }))

    setInput("")

    let results: SearchResult[] = []

    try {
      // Step 1: RAG Search
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

      if (response.ok) {
        const data = await response.json()
        results = (data.results || []).map((r: any) => ({
          ...r,
          document_name: bid?.bid_name || "Bid Document",
        }))
      }

      // Check if this is the second message or later (has previous assistant responses)
      const existingMessages = messages[selectedCriteria] || []
      const hasPreviousAssistantResponse = existingMessages.some(
        msg => msg.role === "assistant" && !msg.isLoading
      )

      // Step 2: LLM Generation (only from second message onwards and if LLM mode is selected)
      if (chatMode === "llm" && hasPreviousAssistantResponse && isLLMConfigured()) {
        // Update message to show generating status
        setMessages((prev) => ({
          ...prev,
          [selectedCriteria]: (prev[selectedCriteria] || []).map((msg) =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  content: "Generating response...",
                  isLoading: true,
                  searchResults: results,
                }
              : msg
          ),
        }))

        const llmConfig = getLLMConfig()

        // Get conversation history (last 5 messages, including current user message)
        const currentMessages = messages[selectedCriteria] || []
        const allMessages = [...currentMessages, userMessage]
        const conversationHistory = allMessages.slice(-5).map(msg => ({
          role: msg.role,
          content: msg.content
        }))

        // Collect top 5 pages from current RAG search results
        const ragContent: string[] = []
        if (results.length > 0) {
          const topResults = results.slice(0, 5)
          topResults.forEach((result) => {
            ragContent.push(`Page ${parseInt(result.page_no) + 1}:\n${result.content}\n\nSemantic Meaning: ${result.semantic_meaning}`)
          })
        }

        // Collect ALL previously selected/bookmarked pages
        const consideredPagesForCriteria = consideredPages[selectedCriteria]
        const consideredPagesContent: string[] = []
        if (consideredPagesForCriteria && consideredPagesForCriteria.size > 0) {
          const sortedPageNos = Array.from(consideredPagesForCriteria).sort((a, b) => {
            const numA = parseInt(a) || 0
            const numB = parseInt(b) || 0
            return numA - numB
          })

          for (const pageNo of sortedPageNos) {
            const pageChunk = bidDataChunks.find(chunk => chunk.page_no === pageNo)
            if (pageChunk) {
              // Only add if not already in current RAG results (to avoid duplicates)
              const alreadyInCurrentRag = results.some(r => r.page_no === pageNo)
              if (!alreadyInCurrentRag) {
                consideredPagesContent.push(`Page ${parseInt(pageNo) + 1}:\n${pageChunk.content}\n\nSemantic Meaning: ${pageChunk.semantic_meaning}`)
              }
            }
          }
        }

        // Build context content
        const contextParts: string[] = []
        if (ragContent.length > 0) {
          contextParts.push("=== CURRENT SEARCH RESULTS (Top 5) ===\n" + ragContent.join("\n\n---\n\n"))
        }
        if (consideredPagesContent.length > 0) {
          contextParts.push("=== PREVIOUSLY SELECTED PAGES ===\n" + consideredPagesContent.join("\n\n---\n\n"))
        }

        const contextContent = contextParts.join("\n\n")

        // Build conversation history string
        const historyString = conversationHistory.length > 0
          ? "\n\n=== CONVERSATION HISTORY ===\n" + conversationHistory.map(msg => 
              `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
            ).join("\n")
          : ""

        // Build prompt
        const prompt = `You are an AI assistant helping with bid document evaluation. Based on the following context from the bid document, answer the user's question.

${contextContent}${historyString}

Current Question: ${query}

Please provide a clear, comprehensive answer based on the information provided. If the information is not available in the context, please state that clearly.`

        // Call LLM (prefer Gemini, fallback to CDAC)
        let generatedText = ""
        try {
          if (llmConfig.provider === "gemini") {
            if (!llmConfig.geminiApiKey) {
              throw new Error("Gemini API key not configured")
            }

            const llmResponse = await fetch(`${API_BASE_URL}/llm/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                provider: "gemini",
                api_key: llmConfig.geminiApiKey,
                prompt: prompt,
                max_tokens: 1024,
              }),
            })

            if (!llmResponse.ok) {
              const errorText = await llmResponse.text()
              throw new Error(`LLM API request failed: ${llmResponse.status} - ${errorText}`)
            }

            const llmData = await llmResponse.json()
            generatedText = llmData.response || "No response generated"
          } else if (llmConfig.provider === "cdac") {
            if (!llmConfig.cdacApiKey) {
              throw new Error("CDAC API key not configured")
            }

            const llmResponse = await fetch(`${API_BASE_URL}/llm/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                provider: "cdac",
                api_key: llmConfig.cdacApiKey,
                prompt: prompt,
                max_tokens: 1024,
              }),
            })

            if (!llmResponse.ok) {
              const errorText = await llmResponse.text()
              throw new Error(`LLM API request failed: ${llmResponse.status} - ${errorText}`)
            }

            const llmData = await llmResponse.json()
            generatedText = llmData.response || "No response generated"
          } else {
            throw new Error("LLM provider not configured")
          }

          // Update message with LLM response
          setMessages((prev) => ({
            ...prev,
            [selectedCriteria]: (prev[selectedCriteria] || []).map((msg) =>
              msg.id === loadingMessageId
                ? {
                    ...msg,
                    content: generatedText,
                    isLoading: false,
                    searchResults: results,
                  }
                : msg
            ),
          }))
        } catch (llmError) {
          console.error("Error in LLM generation:", llmError)
          // Fallback to showing RAG results if LLM fails
        setMessages((prev) => ({
          ...prev,
          [selectedCriteria]: (prev[selectedCriteria] || []).map((msg) =>
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
          ),
        }))
        }
      } else {
        // First message or LLM not configured: just show RAG results
        setMessages((prev) => ({
          ...prev,
          [selectedCriteria]: (prev[selectedCriteria] || []).map((msg) =>
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
          ),
        }))
      }
    } catch (error) {
      console.error("Error searching:", error)
      setMessages((prev) => ({
        ...prev,
        [selectedCriteria]: (prev[selectedCriteria] || []).map((msg) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                content: "Error searching documents. Please try again.",
                isLoading: false,
                searchResults: results || [],
              }
            : msg
        ),
      }))
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleGenerateResponse = async () => {
    if (!generatingCriteria || !queryInput.trim()) {
      alert("Please enter a query before generating")
      return
    }

    if (isGenerating) {
      return // Prevent multiple simultaneous requests
    }

    setIsGenerating(true)
    const criteriaKey = generatingCriteria
    const consideredPagesForCriteria = consideredPages[criteriaKey]
    
    if (!consideredPagesForCriteria || consideredPagesForCriteria.size === 0) {
      alert("No considered pages selected for this criteria")
      return
    }

    try {
      // Collect content from all considered pages
      const pageContents: string[] = []
      const sortedPageNos = Array.from(consideredPagesForCriteria).sort((a, b) => {
        const numA = parseInt(a) || 0
        const numB = parseInt(b) || 0
        return numA - numB
      })

      for (const pageNo of sortedPageNos) {
        const pageChunk = bidDataChunks.find(chunk => chunk.page_no === pageNo)
        if (pageChunk) {
          pageContents.push(`Page ${parseInt(pageNo) + 1}:\n${pageChunk.content}\n\nSemantic Meaning: ${pageChunk.semantic_meaning}`)
        }
      }

      if (pageContents.length === 0) {
        alert("Could not find content for the considered pages")
        return
      }

      // Prepare the prompt with considered pages content
      const contextContent = pageContents.join("\n\n---\n\n")
      const prompt = `Based on the following documents from the considered pages, answer the query/question:

${contextContent}

Query: ${queryInput}

Please provide a clear, concise answer based on the information in these documents.`

      // Get LLM configuration
      const llmConfig = getLLMConfig()
      
      if (llmConfig.provider === "cdac") {
        if (!llmConfig.cdacApiKey) {
          alert("CDAC API key not configured. Please set it in Settings.")
          setIsGenerating(false)
          return
        }

        // Call backend proxy endpoint to avoid CORS issues
        const response = await fetch(`${API_BASE_URL}/llm/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: "cdac",
            api_key: llmConfig.cdacApiKey,
            prompt: prompt,
            max_tokens: 512,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`API request failed: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        const generatedText = data.response || "No response generated"

        // Update the criteria value
        setCriteriaValues(prev => ({
          ...prev,
          [criteriaKey]: generatedText
        }))

        setQueryDialogOpen(false)
        setQueryInput("")
        setGeneratingCriteria(null)
        setIsGenerating(false)
      } else if (llmConfig.provider === "gemini") {
        if (!llmConfig.geminiApiKey) {
          alert("Gemini API key not configured. Please set it in Settings.")
          setIsGenerating(false)
          return
        }

        // Call backend proxy endpoint for Gemini
        const response = await fetch(`${API_BASE_URL}/llm/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: "gemini",
            api_key: llmConfig.geminiApiKey,
            prompt: prompt,
            max_tokens: 512,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`API request failed: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        const generatedText = data.response || "No response generated"

        // Update the criteria value
        setCriteriaValues(prev => ({
          ...prev,
          [criteriaKey]: generatedText
        }))

        setQueryDialogOpen(false)
        setQueryInput("")
        setGeneratingCriteria(null)
        setIsGenerating(false)
      } else {
        alert("Unknown LLM provider. Please configure CDAC or Gemini in Settings.")
        setIsGenerating(false)
      }
    } catch (error) {
      console.error("Error generating response:", error)
      alert(`Error generating response: ${error instanceof Error ? error.message : "Unknown error"}`)
      setGeneratingCriteria(null)
      setIsGenerating(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    )
  }

  if (!bid) {
    return (
      <AppLayout>
        <div className="p-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-red-600">Bid not found</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    )
  }

  const criteriaKeys = Object.keys(criteria).sort((a, b) => {
    const numA = parseInt(a) || 0
    const numB = parseInt(b) || 0
    return numA - numB
  })

  return (
    <AppLayout>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b bg-background">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Bid Evaluation</p>
              <h1 className="text-3xl font-bold">{bid.bid_name}</h1>
              <div className="mt-1 space-y-1">
                <p className="text-sm text-muted-foreground">Bid ID: {bidId.slice(0, 8)}...</p>
                {tender && (
                  <p className="text-sm text-muted-foreground">
                    Tender: <span className="font-medium">{tender.name}</span>
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const fullUrl = bid.pdf_path.startsWith('http') 
                  ? bid.pdf_path 
                  : `${API_BASE_URL}/${bid.pdf_path}`
                window.open(fullUrl, '_blank')
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              View PDF
            </Button>
          </div>
        </div>

        {/* Tabs for Criteria - from Tender */}
        {criteriaKeys.length > 0 ? (
          <Tabs 
            value={selectedCriteria || criteriaKeys[0]} 
            onValueChange={setSelectedCriteria}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-shrink-0 border-b px-6 bg-background">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Evaluation Criteria from: {tender?.name || "Tender"}
                  </p>
                </div>
                <TabsList className="inline-flex max-w-full overflow-x-auto">
                  {criteriaKeys.map((key) => {
                    const title = criteria[key].title || "Criteria"
                    const fullText = `${key}. ${title}`
                    const maxLength = 20
                    const displayText = fullText.length > maxLength 
                      ? `${fullText.substring(0, maxLength)}...` 
                      : fullText
                    return (
                      <TabsTrigger key={key} value={key} className="px-4 flex-shrink-0" title={fullText}>
                        {displayText}
                    </TabsTrigger>
                    )
                  })}
                  <TabsTrigger value="result-sheet" className="px-4 flex-shrink-0">
                    Result Sheet
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Content Area with Resizable Panes */}
            {criteriaKeys.map((key) => (
              <TabsContent 
                key={key} 
                value={key} 
                className="flex-1 flex overflow-hidden m-0 p-0 data-[state=active]:flex"
              >
                <div ref={containerRef} className="flex-1 flex overflow-hidden">
                  {/* Left Column - Criteria Info */}
                  <div 
                    className={`${showChatAndPages ? "border-r" : ""} bg-muted/30 overflow-y-auto`}
                    style={{ width: showChatAndPages ? `${leftWidth}%` : "100%" }}
                  >
                    <div className="p-6 space-y-6">
                      {/* Criteria Name and Value */}
                      <Card>
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <h3 className="font-semibold text-lg">{criteria[key].title}</h3>
                            <div className="pt-2 border-t">
                              <p className="text-sm text-muted-foreground mb-2">Value</p>
                              <div 
                                className="text-base font-medium prose prose-sm max-w-none [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:ml-4 [&_li]:mb-1 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm"
                                dangerouslySetInnerHTML={{ 
                                  __html: markdownToHtml(criteriaValues[key] || criteria[key].value || "N/A") 
                                }}
                              />
                            </div>
                            <div className="pt-2 space-y-2">
                              <Button
                                variant="default"
                                size="sm"
                                className="w-full"
                                onClick={() => handleQueryCriteria(key)}
                                disabled={!bidId || !bid}
                              >
                                <SparklesIcon className="h-4 w-4 mr-2" />
                                Query with Gemini
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  if (!isLLMConfigured()) {
                                    alert("Please configure LLM settings in Settings page first")
                                    return
                                  }
                                  if (!consideredPages[key] || consideredPages[key].size === 0) {
                                    alert("Please select at least one considered page before generating a response")
                                    return
                                  }
                                  setQueryInput("")
                                  setGeneratingCriteria(key)
                                  setIsGenerating(false)
                                  setQueryDialogOpen(true)
                                }}
                                disabled={!consideredPages[key] || consideredPages[key].size === 0 || (generatingCriteria !== null && generatingCriteria !== key)}
                              >
                                {generatingCriteria === key ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <SparklesIcon className="h-4 w-4 mr-2" />
                                    Generate Response
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Toggle Chat and Pages */}
                      <Card>
                        <CardContent className="p-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={async () => {
                              if (!showChatAndPages) {
                                // Opening chat - trigger initial query
                                const query = criteria[key].description || getDefaultDescription(criteria[key].title)
                                if (query.trim() && bidId) {
                                  // Create initial message
                                  const userMessage: Message = {
                                    id: Date.now().toString(),
                                    role: "user",
                                    content: query,
                                    timestamp: new Date(),
                                  }

                                  setMessages((prev) => ({
                                    ...prev,
                                    [key]: [...(prev[key] || []), userMessage],
                                  }))

                                  // Perform search
                                  try {
                                    const searchResponse = await fetch(`${API_BASE_URL}/bids/${bidId}/search`, {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        query: query,
                                        n_results: 10,
                                      }),
                                    })

                                    if (searchResponse.ok) {
                                      const data = await searchResponse.json()
                                      const results = (data.results || []).map((r: any) => ({
                                        ...r,
                                        document_name: bid?.bid_name || "Bid Document",
                                      }))

                                      const assistantMessage: Message = {
                                        id: (Date.now() + 1).toString(),
                                        role: "assistant",
                                        content: results.length > 0
                                          ? `Found ${results.length} relevant result${results.length > 1 ? "s" : ""} from the bid document`
                                          : "No results found for your query",
                                        timestamp: new Date(),
                                        searchResults: results,
                                      }

                                      setMessages((prev) => ({
                                        ...prev,
                                        [key]: [...(prev[key] || []), assistantMessage],
                                      }))
                                    }
                                  } catch (error) {
                                    console.error("Error performing initial search:", error)
                                  }
                                }
                              }
                              setShowChatAndPages(!showChatAndPages)
                            }}
                          >
                            {showChatAndPages ? (
                              <>
                                <MessageSquareOff className="h-4 w-4 mr-2" />
                                Hide Chat & Pages
                              </>
                            ) : (
                              <>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Show Chat & Pages
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Sub-Points */}
                      {criteria[key].subPoints && Object.keys(criteria[key].subPoints || {}).length > 0 && (
                        <Card>
                          <CardContent className="p-4">
                            <h3 className="font-semibold text-sm mb-3">Sub-Points</h3>
                            <div className="space-y-3">
                              {Object.entries(criteria[key].subPoints || {}).map(([subKey, subPoint]) => (
                                <div key={subKey} className="p-3 rounded border bg-background">
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium">{subPoint.title}</p>
                                    {subPoint.description && (
                                      <p className="text-xs text-muted-foreground">{subPoint.description}</p>
                                    )}
                                    <div className="pt-1 border-t">
                                      <p className="text-xs text-muted-foreground">Value</p>
                                      <p className="text-sm font-medium">
                                        {subPoint.value || "N/A"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Considered Pages */}
                      {showChatAndPages && (
                      <Card>
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-sm mb-3">Considered Pages</h3>
                          {consideredPages[key] && consideredPages[key].size > 0 ? (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {Array.from(consideredPages[key]).sort((a, b) => {
                                const numA = parseInt(a) || 0
                                const numB = parseInt(b) || 0
                                return numA - numB
                              }).map((pageNo) => (
                                <div
                                  key={pageNo}
                                  className="flex items-center justify-between p-2 rounded border bg-background hover:bg-muted/50 transition-colors cursor-pointer group"
                                  onClick={() => {
                                    // Find the result for this page from bidDataChunks (all pages, not just search results)
                                    // pageNo in consideredPages is CSV page_no (0-indexed)
                                    const pageChunk = bidDataChunks.find(
                                      chunk => chunk.page_no === pageNo
                                    )
                                    if (pageChunk) {
                                      setSelectedResult(pageChunk)
                                      // CSV page_no is 0-indexed, PDF pages are 1-indexed, so add 1
                                      setCurrentPdfPage(parseInt(pageNo) + 1 || 1)
                                      setShowPdfView(true) // Keep PDF view open
                                      setIsDialogOpen(true)
                                    } else {
                                      console.warn(`Page ${pageNo} not found in bid data chunks`)
                                    }
                                  }}
                                >
                                  <span className="text-sm font-medium">Page {parseInt(pageNo) + 1}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setConsideredPages(prev => {
                                        const newPages = { ...prev }
                                        if (!newPages[key]) newPages[key] = new Set()
                                        newPages[key] = new Set(newPages[key])
                                        newPages[key].delete(pageNo)
                                        if (newPages[key].size === 0) {
                                          delete newPages[key]
                                        }
                                        return newPages
                                      })
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No pages selected yet. Check pages from search results to add them.</p>
                          )}
                        </CardContent>
                      </Card>
                      )}
                    </div>
                  </div>

                  {/* Resizable Border - only show if chat is visible */}
                  {showChatAndPages && (
                  <div
                    className="w-1 bg-border cursor-col-resize hover:bg-primary/50 transition-colors flex-shrink-0"
                    onMouseDown={handleMouseDown}
                  />
                  )}

                  {/* Right Column - Chat */}
                  {showChatAndPages && (
                  <div 
                    className="flex-1 flex flex-col overflow-hidden bg-background"
                    style={{ width: `${100 - leftWidth}%` }}
                  >
                    {/* Chat Header with Mode Toggle */}
                    <div className="flex-shrink-0 flex items-center justify-end gap-2 border-b p-2 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Button
                          variant={chatMode === "search" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setChatMode("search")}
                          className="text-xs h-7"
                        >
                          Search Mode
                        </Button>
                        <Button
                          variant={chatMode === "llm" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setChatMode("llm")}
                          className="text-xs h-7"
                        >
                          LLM Mode
                        </Button>
                      </div>
                    </div>
                    
                    {/* Chat Messages */}
                    <div 
                      ref={chatMessagesRef}
                      className="flex-1 overflow-y-auto p-6"
                    >
                      <div className="space-y-4">
                        {(!selectedCriteria || !messages[selectedCriteria] || messages[selectedCriteria].length === 0) && (
                          <div className="text-center text-muted-foreground py-12">
                            <p className="text-lg font-medium mb-2">Start a conversation</p>
                            <p className="text-sm">Ask questions about this bid document for {criteria[key]?.title || "this criteria"}</p>
                          </div>
                        )}
                        {selectedCriteria && messages[selectedCriteria] && messages[selectedCriteria].map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg p-4 ${
                                message.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              {message.isLoading ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>{message.content}</span>
                                </div>
                              ) : (
                                <>
                                  <div 
                                    className="text-sm prose prose-sm max-w-none [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:ml-4 [&_li]:mb-1 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs"
                                    dangerouslySetInnerHTML={{ 
                                      __html: markdownToHtml(message.content) 
                                    }}
                                  />
                                  {message.searchResults && message.searchResults.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs font-medium mb-2 text-muted-foreground">
                                        {message.searchResults.length} result{message.searchResults.length > 1 ? "s" : ""} found:
                                      </p>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {message.searchResults.map((result, idx) => {
                                          const pageKey = `${result.page_no}`
                                          const isChecked = selectedCriteria 
                                            ? (consideredPages[selectedCriteria]?.has(pageKey) || false)
                                            : false
                                          
                                          return (
                                            <Card
                                              key={idx}
                                              className="cursor-pointer hover:bg-muted/80 transition-colors"
                                              onClick={(e) => {
                                                // Only show dialog if clicking on card, not checkbox
                                                if ((e.target as HTMLElement).closest('.checkbox-container')) {
                                                  return
                                                }
                                                setSelectedResult(result)
                                                // CSV page_no is 0-indexed, PDF pages are 1-indexed, so add 1
                                                const csvPageNo = parseInt(result.page_no) || 0
                                                setCurrentPdfPage(csvPageNo + 1)
                                                setShowPdfView(true)
                                                setIsDialogOpen(true)
                                              }}
                                            >
                                              <CardContent className="p-3">
                                                <div className="space-y-1">
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 flex-1">
                                                      <div
                                                        className="checkbox-container"
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          if (selectedCriteria) {
                                                            setConsideredPages(prev => {
                                                              const newPages = { ...prev }
                                                              if (!newPages[selectedCriteria]) {
                                                                newPages[selectedCriteria] = new Set()
                                                              }
                                                              newPages[selectedCriteria] = new Set(newPages[selectedCriteria])
                                                              
                                                              if (isChecked) {
                                                                newPages[selectedCriteria].delete(pageKey)
                                                              } else {
                                                                newPages[selectedCriteria].add(pageKey)
                                                              }
                                                              
                                                              if (newPages[selectedCriteria].size === 0) {
                                                                delete newPages[selectedCriteria]
                                                              }
                                                              
                                                              return newPages
                                                            })
                                                          }
                                                        }}
                                                      >
                                                        <Checkbox
                                                          checked={isChecked}
                                                          onCheckedChange={(checked) => {
                                                            if (selectedCriteria) {
                                                              setConsideredPages(prev => {
                                                                const newPages = { ...prev }
                                                                if (!newPages[selectedCriteria]) {
                                                                  newPages[selectedCriteria] = new Set()
                                                                }
                                                                newPages[selectedCriteria] = new Set(newPages[selectedCriteria])
                                                                
                                                                if (checked) {
                                                                  newPages[selectedCriteria].add(pageKey)
                                                                } else {
                                                                  newPages[selectedCriteria].delete(pageKey)
                                                                }
                                                                
                                                                if (newPages[selectedCriteria].size === 0) {
                                                                  delete newPages[selectedCriteria]
                                                                }
                                                                
                                                                return newPages
                                                              })
                                                            }
                                                          }}
                                                        />
                                                      </div>
                                                      <p className="text-xs font-medium">
                                                        Page {parseInt(result.page_no) + 1}
                                                      </p>
                                                    </div>
                                                  </div>
                                                  <p className="text-xs text-muted-foreground line-clamp-3">
                                                    {result.semantic_meaning.substring(0, 150)}...
                                                  </p>
                                                </div>
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
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Criteria Description Prompt Card */}
                    {selectedCriteria && criteria[key]?.description && (
                      <div className="flex-shrink-0 border-t bg-muted/30 p-4">
                        <div className="mx-auto max-w-4xl">
                          <div className="flex items-start gap-3 p-3 bg-background border rounded-lg shadow-sm">
                            <div className="flex-shrink-0 mt-0.5">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <SparklesIcon className="h-4 w-4 text-primary" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground mb-1">
                                {criteria[key].title}
                              </p>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {criteria[key].description}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Chat Input */}
                    <div className="flex-shrink-0 border-t p-4 bg-background">
                      <div className="mx-auto max-w-4xl">
                        <div className="flex gap-2">
                          <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={selectedCriteria ? `Ask about this bid for ${criteria[key]?.title || "this criteria"}...` : "Select a criteria to start chatting"}
                            className="flex-1"
                            disabled={!selectedCriteria}
                          />
                          <Button onClick={handleSendMessage} disabled={!input.trim() || !selectedCriteria}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              </TabsContent>
            ))}
            
            {/* Result Sheet Tab */}
            <TabsContent 
              value="result-sheet" 
              className="flex-1 flex overflow-hidden m-0 p-0 data-[state=active]:flex"
            >
              <div className="flex-1 flex flex-col overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">Result Sheet of {bid?.bid_name || "Bid Evaluation"}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Evaluation Results
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!bidId || !bid) return
                        
                        // Refresh all criteria queries with all considered pages
                        for (const key of criteriaKeys) {
                          const crit = criteria[key]
                          const query = crit.description || getDefaultDescription(crit.title)
                          
                          if (!query.trim()) continue

                          // Get all considered pages for this criteria
                          const consideredPagesForCriteria = consideredPages[key]
                          
                          try {
                            // Step 1: RAG Search
                            const searchResponse = await fetch(`${API_BASE_URL}/bids/${bidId}/search`, {
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
                            if (searchResponse.ok) {
                              const data = await searchResponse.json()
                              results = (data.results || []).map((r: any) => ({
                                ...r,
                                document_name: bid?.bid_name || "Bid Document",
                              }))
                              
                              // Mark all RAG result pages as considered
                              setConsideredPages(prev => {
                                const newPages = { ...prev }
                                if (!newPages[key]) {
                                  newPages[key] = new Set()
                                }
                                newPages[key] = new Set(newPages[key])
                                
                                results.forEach(result => {
                                  newPages[key].add(result.page_no)
                                })
                                
                                return newPages
                              })
                            }

                            // Step 2: LLM Generation with all considered pages
                            if (isLLMConfigured()) {
                              const llmConfig = getLLMConfig()
                              
                              // Collect top 5 from RAG
                              const ragContent: string[] = []
                              if (results.length > 0) {
                                const topResults = results.slice(0, 5)
                                topResults.forEach((result) => {
                                  ragContent.push(`Page ${parseInt(result.page_no) + 1}:\n${result.content}\n\nSemantic Meaning: ${result.semantic_meaning}`)
                                })
                              }

                              // Collect ALL considered pages
                              const consideredPagesContent: string[] = []
                              if (consideredPagesForCriteria && consideredPagesForCriteria.size > 0) {
                                const sortedPageNos = Array.from(consideredPagesForCriteria).sort((a, b) => {
                                  const numA = parseInt(a) || 0
                                  const numB = parseInt(b) || 0
                                  return numA - numB
                                })

                                for (const pageNo of sortedPageNos) {
                                  const pageChunk = bidDataChunks.find(chunk => chunk.page_no === pageNo)
                                  if (pageChunk) {
                                    const alreadyInRag = results.some(r => r.page_no === pageNo)
                                    if (!alreadyInRag) {
                                      consideredPagesContent.push(`Page ${parseInt(pageNo) + 1}:\n${pageChunk.content}\n\nSemantic Meaning: ${pageChunk.semantic_meaning}`)
                                    }
                                  }
                                }
                              }

                              const contextParts: string[] = []
                              if (ragContent.length > 0) {
                                contextParts.push("=== CURRENT SEARCH RESULTS (Top 5) ===\n" + ragContent.join("\n\n---\n\n"))
                              }
                              if (consideredPagesContent.length > 0) {
                                contextParts.push("=== ALL CONSIDERED PAGES ===\n" + consideredPagesContent.join("\n\n---\n\n"))
                              }

                              const contextContent = contextParts.join("\n\n")

                              const prompt = `You are an AI assistant helping with bid document evaluation. Based on the following context from the bid document, answer the query/question. Extract the specific value or information requested.

${contextContent}

Query: ${query}

Please provide a clear, comprehensive answer with the specific value or information. Format your response with markdown if needed (use **bold** for emphasis, * for lists). If the information is not available in the context, please state "N/A".`

                              try {
                                let generatedText = ""
                                if (llmConfig.provider === "gemini" && llmConfig.geminiApiKey) {
                                  const llmResponse = await fetch(`${API_BASE_URL}/llm/generate`, {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      provider: "gemini",
                                      api_key: llmConfig.geminiApiKey,
                                      prompt: prompt,
                                      max_tokens: 1024,
                                    }),
                                  })

                                  if (llmResponse.ok) {
                                    const llmData = await llmResponse.json()
                                    generatedText = llmData.response || "N/A"
                                  } else {
                                    generatedText = "N/A"
                                  }
                                } else if (llmConfig.provider === "cdac" && llmConfig.cdacApiKey) {
                                  const llmResponse = await fetch(`${API_BASE_URL}/llm/generate`, {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      provider: "cdac",
                                      api_key: llmConfig.cdacApiKey,
                                      prompt: prompt,
                                      max_tokens: 1024,
                                    }),
                                  })

                                  if (llmResponse.ok) {
                                    const llmData = await llmResponse.json()
                                    generatedText = llmData.response || "N/A"
                                  } else {
                                    generatedText = "N/A"
                                  }
                                } else {
                                  generatedText = "N/A"
                                }

                                setCriteriaValues(prev => ({
                                  ...prev,
                                  [key]: generatedText
                                }))
                              } catch (llmError) {
                                console.error(`Error in LLM generation for criteria ${key}:`, llmError)
                                setCriteriaValues(prev => ({
                                  ...prev,
                                  [key]: "N/A"
                                }))
                              }
                            }
                          } catch (error) {
                            console.error(`Error refreshing criteria ${key}:`, error)
                          }
                        }
                      }}
                      disabled={!bidId || !bid}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh All
                    </Button>
                    <Button
                      variant="default"
                      onClick={async () => {
                        if (!isLLMConfigured()) {
                          alert("Please configure LLM settings in Settings page first")
                          return
                        }
                        
                        // Generate final result sheet with all criteria and considered pages
                        const llmConfig = getLLMConfig()
                        const allCriteriaData: string[] = []
                        
                        for (const key of criteriaKeys) {
                          const crit = criteria[key]
                          const value = criteriaValues[key] || "N/A"
                          const consideredPagesForCriteria = consideredPages[key]
                          
                          let pagesContent = ""
                          if (consideredPagesForCriteria && consideredPagesForCriteria.size > 0) {
                            const sortedPageNos = Array.from(consideredPagesForCriteria).sort((a, b) => {
                              const numA = parseInt(a) || 0
                              const numB = parseInt(b) || 0
                              return numA - numB
                            })
                            
                            const pageContents: string[] = []
                            for (const pageNo of sortedPageNos) {
                              const pageChunk = bidDataChunks.find(chunk => chunk.page_no === pageNo)
                              if (pageChunk) {
                                pageContents.push(`Page ${parseInt(pageNo) + 1}:\n${pageChunk.content}\n\nSemantic Meaning: ${pageChunk.semantic_meaning}`)
                              }
                            }
                            pagesContent = pageContents.join("\n\n---\n\n")
                          }
                          
                          allCriteriaData.push(`Criteria ${key}: ${crit.title}\nRequirement: ${crit.value || "N/A"}\nBidder Value: ${value}\n\nConsidered Pages:\n${pagesContent || "No pages considered"}`)
                        }
                        
                        const prompt = `Based on the following evaluation criteria and bidder values, generate a comprehensive result sheet summary:

${allCriteriaData.join("\n\n==========\n\n")}

Please provide a summary of the evaluation results.`

                        try {
                          if (llmConfig.provider === "gemini" && llmConfig.geminiApiKey) {
                            const response = await fetch(`${API_BASE_URL}/llm/generate`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                provider: "gemini",
                                api_key: llmConfig.geminiApiKey,
                                prompt: prompt,
                                max_tokens: 2048,
                              }),
                            })
                            
                            if (response.ok) {
                              const data = await response.json()
                              alert(data.response || "Result sheet generated")
                            }
                          }
                        } catch (error) {
                          console.error("Error generating result sheet:", error)
                        }
                      }}
                      disabled={!isLLMConfigured()}
                    >
                      <SparklesIcon className="h-4 w-4 mr-2" />
                      Generate with Gemini
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-16 font-semibold">Sr No</TableHead>
                            <TableHead className="font-semibold">Criteria</TableHead>
                            <TableHead className="w-32 font-semibold">Unit</TableHead>
                            <TableHead className="w-40 font-semibold">Bidder Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {criteriaKeys.flatMap((key) => {
                            const crit = criteria[key]
                            const bidderValue = criteriaValues[key] || crit.value || "N/A"
                            // Extract unit from criteria value (e.g., "Rs lakhs", "Cum", "MT")
                            const unit = crit.value || ""
                            let displayUnit = ""
                            if (unit.toLowerCase().includes("lakhs")) {
                              displayUnit = "Rs lakhs"
                            } else if (unit.toLowerCase().includes("cum")) {
                              displayUnit = "Cum"
                            } else if (unit.toLowerCase().includes("mt")) {
                              displayUnit = "MT"
                            } else if (unit) {
                              displayUnit = unit
                            }
                            
                            return [
                              <TableRow key={key} className="hover:bg-muted/30">
                                <TableCell className="font-semibold">{key}</TableCell>
                                <TableCell className="font-medium">{crit.title}</TableCell>
                                <TableCell>{displayUnit || "-"}</TableCell>
                                <TableCell className="font-medium">
                                  <div 
                                    className="prose prose-sm max-w-none [&_strong]:font-bold [&_ul]:list-disc [&_ul]:ml-4 [&_li]:mb-1"
                                    dangerouslySetInnerHTML={{ 
                                      __html: markdownToHtml(bidderValue) 
                                    }}
                                  />
                                </TableCell>
                              </TableRow>,
                              ...(crit.subPoints ? Object.entries(crit.subPoints).map(([subKey, subPoint]) => {
                                const subPointValue = criteriaValues[`${key}-${subKey}`] || subPoint.value || "N/A"
                                return (
                                  <TableRow key={`${key}-${subKey}`} className="bg-muted/30">
                                    <TableCell className="pl-8 font-medium text-muted-foreground">
                                      {key}.{subKey}
                                    </TableCell>
                                    <TableCell className="pl-4 text-muted-foreground">{subPoint.title}</TableCell>
                                    <TableCell className="text-muted-foreground">{subPoint.value || "-"}</TableCell>
                                    <TableCell className="font-medium text-muted-foreground">
                                      <div 
                                        className="prose prose-sm max-w-none [&_strong]:font-bold [&_ul]:list-disc [&_ul]:ml-4 [&_li]:mb-1"
                                        dangerouslySetInnerHTML={{ 
                                          __html: markdownToHtml(subPointValue) 
                                        }}
                                      />
                                    </TableCell>
                                  </TableRow>
                                )
                              }) : [])
                            ]
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">No evaluation criteria found for this tender</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Query Dialog for LLM Generation */}
        <Dialog open={queryDialogOpen} onOpenChange={setQueryDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Generate Response for {generatingCriteria && criteria[generatingCriteria]?.title}</DialogTitle>
              <DialogDescription>
                Enter a query/question to analyze the considered pages and generate a response.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium mb-2">Query</label>
                <Input
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="e.g., What is the annual turnover mentioned in the documents?"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleGenerateResponse()
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setQueryDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleGenerateResponse}
                  disabled={!queryInput.trim() || generatingCriteria === null || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Result Detail Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            // Reset PDF view width when dialog closes (but keep showPdfView true for next time)
            setPdfViewWidth(60)
          }
        }}>
          <DialogContent className="!w-[70vw] !max-w-[70vw] h-[90vh] max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Page {selectedResult ? parseInt(selectedResult.page_no) + 1 : 0} • {selectedResult?.document_name}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedResult?.document_id}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {selectedResult && bid && (
              <div ref={pdfViewContainerRef} className="flex-1 overflow-hidden flex">
                    {/* Left Column - PDF Viewer */}
                    <div 
                      className="flex flex-col overflow-hidden bg-muted/30"
                      style={{ width: `${pdfViewWidth}%` }}
                    >
                      {/* PDF Navigation Controls */}
                      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b bg-background">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPdfPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPdfPage <= 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-medium px-3">
                            Page {currentPdfPage}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPdfPage(prev => prev + 1)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          variant={selectedCriteria && consideredPages[selectedCriteria]?.has((currentPdfPage - 1).toString()) ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            if (selectedCriteria) {
                              setConsideredPages(prev => {
                                const newPages = { ...prev }
                                if (!newPages[selectedCriteria]) {
                                  newPages[selectedCriteria] = new Set()
                                }
                                newPages[selectedCriteria] = new Set(newPages[selectedCriteria])
                                
                                // currentPdfPage is 1-indexed, but we store CSV page_no (0-indexed)
                                const pageKey = (currentPdfPage - 1).toString()
                                if (newPages[selectedCriteria].has(pageKey)) {
                                  newPages[selectedCriteria].delete(pageKey)
                                } else {
                                  newPages[selectedCriteria].add(pageKey)
                                }
                                
                                if (newPages[selectedCriteria].size === 0) {
                                  delete newPages[selectedCriteria]
                                }
                                
                                return newPages
                              })
                            }
                          }}
                        >
                          {selectedCriteria && consideredPages[selectedCriteria]?.has((currentPdfPage - 1).toString()) ? (
                            <>
                              <BookmarkCheck className="h-4 w-4 mr-2" />
                              Bookmarked
                            </>
                          ) : (
                            <>
                              <Bookmark className="h-4 w-4 mr-2" />
                              Bookmark
                            </>
                          )}
                        </Button>
                      </div>
                      {/* PDF viewer - single page as image */}
                      <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-4">
                        {loadingPdfPage ? (
                          <div className="flex flex-col items-center gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Loading page {currentPdfPage}...</p>
                          </div>
                        ) : pdfPageImage ? (
                          <img
                            src={pdfPageImage}
                            alt={`PDF Page ${currentPdfPage}`}
                            className="max-w-full h-auto shadow-lg rounded"
                            style={{ maxHeight: '100%' }}
                          />
                        ) : (
                          <div className="text-center text-muted-foreground p-4">
                            <p>Unable to load PDF page</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => {
                                const pdfUrl = bid.pdf_path.startsWith('http') 
                                  ? bid.pdf_path 
                                  : `${API_BASE_URL}/${bid.pdf_path}`
                                window.open(`${pdfUrl}#page=${currentPdfPage}`, '_blank')
                              }}
                            >
                              Open in new tab
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resizable Divider */}
                    <div
                      className="w-1 bg-border cursor-col-resize hover:bg-primary/50 transition-colors flex-shrink-0"
                      onMouseDown={handlePdfResizeMouseDown}
                    />

                {/* Right Column - Content */}
                    <div 
                  className="flex-1 overflow-y-auto p-6 bg-background"
                      style={{ width: `${100 - pdfViewWidth}%` }}
                    >
                  <div className="flex items-center gap-2 mb-4 sticky top-0 bg-background pb-2 border-b">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">Page Content</h3>
                      </div>
                      <div
                        className="prose prose-sm max-w-none [&_p]:text-sm [&_p]:leading-relaxed [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_table]:text-xs [&_img]:max-w-full [&_img]:rounded [&_table]:border [&_td]:border [&_th]:border [&_td]:p-2 [&_th]:p-2"
                        dangerouslySetInnerHTML={{ __html: selectedResult.content }}
                      />
                    </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
