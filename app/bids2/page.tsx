"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  FileText, 
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getLLMConfig, isLLMConfigured } from "@/lib/llm-config"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// Configurable years for annual turnover table
const TURNOVER_YEARS = ["2019-20", "2020-21", "2021-22", "2022-23", "2023-24"]

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

function Bids2Page() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const bidIdParam = searchParams.get("bid")
  const bidderParam = searchParams.get("bidder") || "Abhiraj"
  
  const [phase, setPhase] = useState<"selection" | "self-evaluation" | "scrutiny">("selection")
  const [bid, setBid] = useState<Bid | null>(null)
  const [tender, setTender] = useState<Tender | null>(null)
  const [criteria, setCriteria] = useState<Record<string, Criteria>>({})
  const [loading, setLoading] = useState(true)
  const [bids, setBids] = useState<Bid[]>([])
  const [showBidSelector, setShowBidSelector] = useState(!bidIdParam)
  
  // PDF viewer state
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [currentPdfPage, setCurrentPdfPage] = useState(1)
  const [pdfPageImage, setPdfPageImage] = useState<string | null>(null)
  const [loadingPdfPage, setLoadingPdfPage] = useState(false)
  const [pdfZoom, setPdfZoom] = useState(100)
  const [pdfRotation, setPdfRotation] = useState(0)
  const [totalPdfPages, setTotalPdfPages] = useState(0)
  const [pageThumbnails, setPageThumbnails] = useState<Record<number, string>>({})
  
  // Cache PDF document and rendered pages for performance
  const pdfDocumentRef = useRef<any>(null)
  const renderedPagesCache = useRef<Record<string, string>>({})
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Bid data chunks for fetching OCR content
  const [bidDataChunks, setBidDataChunks] = useState<any[]>([])
  
  // Annual turnover table state
  const [turnoverData, setTurnoverData] = useState(() => {
    const initialData: Record<string, string> = {}
    TURNOVER_YEARS.forEach(year => {
      initialData[year] = ""
    })
    return initialData
  })
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [hasInitialQuery, setHasInitialQuery] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Progress/timeline state
  const [activeCriteriaIndex, setActiveCriteriaIndex] = useState(0)
  const [selectedBidder, setSelectedBidder] = useState<string>(bidderParam)
  
  // Resizable divider state between PDF and Table
  const [pdfTableDivider, setPdfTableDivider] = useState(50) // Percentage, default 50%
  const [isResizingDivider, setIsResizingDivider] = useState(false)
  const mainContentRef = useRef<HTMLDivElement>(null)
  
  // Extract bidder names from bid name
  const getBidderNames = () => {
    if (!bid?.bid_name) return ["Abhiraj", "Shraddha", "Shankar"]
    const name = bid.bid_name
    if (name.includes("J.V") || name.includes("Joint Venture")) {
      const match = name.match(/([A-Z][a-z]+)\s*(?:and|&)\s*([A-Z][a-z]+)/i)
      if (match) {
        return [match[1], match[2], "Shankar"]
      }
    }
    return ["Abhiraj", "Shraddha", "Shankar"]
  }
  
  const bidderNames = getBidderNames()

  useEffect(() => {
    fetchAllBids()
    if (bidIdParam) {
      fetchBidData(bidIdParam)
      setShowBidSelector(false)
    } else {
      setShowBidSelector(true)
    }
  }, [bidIdParam])

  // Update selectedBidder when bidderParam changes
  useEffect(() => {
    if (bidderParam) {
      setSelectedBidder(bidderParam)
    }
  }, [bidderParam])

  // Reset initial query state when criteria changes
  useEffect(() => {
    setHasInitialQuery(false)
    setSelectedPages(new Set())
  }, [activeCriteriaIndex])

  const fetchAllBids = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/bids`)
      if (response.ok) {
        const data = await response.json()
        setBids(data.bids || [])
      }
    } catch (error) {
      console.error("Error fetching bids:", error)
    }
  }

  const fetchBidData = async (bidId: string) => {
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
          }
        }
        
        // Fetch bid data chunks for OCR content
        fetchBidDataChunks(bidId)
        
        // Show selection screen to choose between self-evaluation and scrutiny
        // setPhase("self-evaluation")
      }
    } catch (error) {
      console.error("Error fetching bid data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch all bid data chunks for OCR content
  const fetchBidDataChunks = async (bidId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/bids/${bidId}/data`)
      if (response.ok) {
        const data = await response.json()
        const chunks = Array.isArray(data.chunks) ? data.chunks : []
        setBidDataChunks(chunks)
      }
    } catch (error) {
      console.error("Error fetching bid data chunks:", error)
    }
  }

  // Load PDF and get total pages
  useEffect(() => {
    if (bid && phase === "self-evaluation") {
      loadPdfInfo()
    }
  }, [bid, phase])

  const loadPdfInfo = async () => {
    if (!bid) return
    
    const pdfUrl = bid.pdf_path.startsWith('http') 
      ? bid.pdf_path 
      : `${API_BASE_URL}/${bid.pdf_path}`
    
    try {
      if (!(window as any).pdfjsLib) {
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'
        script.onload = () => {
          const pdfjsLib = (window as any).pdfjsLib
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
          loadPdfPages(pdfUrl, pdfjsLib)
        }
        document.head.appendChild(script)
      } else {
        loadPdfPages(pdfUrl, (window as any).pdfjsLib)
      }
    } catch (error) {
      console.error("Error loading PDF:", error)
    }
  }

  const loadPdfPages = async (url: string, pdfjsLib: any) => {
    try {
      // Cache the PDF document
      const loadingTask = pdfjsLib.getDocument(url)
      const pdf = await loadingTask.promise
      pdfDocumentRef.current = pdf
      setTotalPdfPages(pdf.numPages)
      
      // Clear cache when loading new PDF
      renderedPagesCache.current = {}
      
      // Generate thumbnails for first 20 pages (lazy load rest)
      const thumbnails: Record<number, string> = {}
      const pagesToLoad = Math.min(20, pdf.numPages)
      
      // Generate thumbnails in batches for better performance
      const batchSize = 5
      for (let batchStart = 1; batchStart <= pagesToLoad; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, pagesToLoad)
        const batchPromises = []
        
        for (let i = batchStart; i <= batchEnd; i++) {
          batchPromises.push(
            (async () => {
              try {
                const page = await pdf.getPage(i)
                const scale = 0.3
                const viewport = page.getViewport({ scale })
                
                const canvas = document.createElement('canvas')
                const context = canvas.getContext('2d')
                if (!context) return null
                
                canvas.height = viewport.height
                canvas.width = viewport.width
                
                await page.render({
                  canvasContext: context,
                  viewport: viewport
                }).promise
                
                return { pageNum: i, dataUrl: canvas.toDataURL('image/png') }
              } catch (err) {
                console.error(`Error generating thumbnail for page ${i}:`, err)
                return null
              }
            })()
          )
        }
        
        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach(result => {
          if (result) {
            thumbnails[result.pageNum] = result.dataUrl
          }
        })
        
        // Update thumbnails progressively
        setPageThumbnails({ ...thumbnails })
      }
      
      // Load first page in viewer
      if (currentPdfPage === 1) {
        renderPdfPage(1)
      }
    } catch (error) {
      console.error("Error loading PDF pages:", error)
    }
  }

  const renderPdfPage = async (pageNum: number, zoom?: number, rotation?: number) => {
    if (!pdfDocumentRef.current) return
    
    // Use provided values or current state
    const currentZoom = zoom ?? pdfZoom
    const currentRotation = rotation ?? pdfRotation
    
    // Create cache key based on page, zoom, and rotation
    const cacheKey = `${pageNum}-${currentZoom}-${currentRotation}`
    
    // Check cache first
    if (renderedPagesCache.current[cacheKey]) {
      setPdfPageImage(renderedPagesCache.current[cacheKey])
      return
    }
    
    try {
      setLoadingPdfPage(true)
      
      // Use requestAnimationFrame for smoother rendering
      await new Promise(resolve => requestAnimationFrame(resolve))
      
      const pdf = pdfDocumentRef.current
      const page = await pdf.getPage(pageNum)
      
      // Calculate scale: 1.0 = 100%, so zoom/100 gives us the multiplier
      // Base scale of 1.5 for good quality, multiplied by zoom percentage
      const baseScale = 1.5
      const scale = (currentZoom / 100) * baseScale
      const viewport = page.getViewport({ scale, rotation: currentRotation })
      
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { alpha: false }) // Disable alpha for better performance
      if (!context) return
      
      // Set canvas size
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      // Render with optimized settings
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }
      
      await page.render(renderContext).promise
      
      // Convert to data URL and cache
      const dataUrl = canvas.toDataURL('image/png', 0.95) // 0.95 quality for good balance
      renderedPagesCache.current[cacheKey] = dataUrl
      
      // Limit cache size to prevent memory issues (keep last 10 rendered pages)
      const cacheKeys = Object.keys(renderedPagesCache.current)
      if (cacheKeys.length > 10) {
        const oldestKey = cacheKeys[0]
        delete renderedPagesCache.current[oldestKey]
      }
      
      setPdfPageImage(dataUrl)
    } catch (error) {
      console.error("Error rendering PDF page:", error)
    } finally {
      setLoadingPdfPage(false)
    }
  }

  // Debounced zoom handler - reduced debounce for better responsiveness
  useEffect(() => {
    if (pdfDocumentRef.current && currentPdfPage > 0 && phase === "self-evaluation") {
      // Clear existing timeout
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current)
      }
      
      // Debounce zoom changes (wait 150ms after last zoom change for better responsiveness)
      zoomTimeoutRef.current = setTimeout(() => {
        renderPdfPage(currentPdfPage, pdfZoom, pdfRotation)
      }, 150)
      
      return () => {
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current)
        }
      }
    }
  }, [pdfZoom, pdfRotation, currentPdfPage, phase])
  
  // Handle page changes (no debounce needed)
  useEffect(() => {
    if (pdfDocumentRef.current && currentPdfPage > 0 && phase === "self-evaluation") {
      renderPdfPage(currentPdfPage)
    }
  }, [currentPdfPage, phase])

  // Single click = view page, Double click = select page
  const handlePageClick = (pageNum: number) => {
    setCurrentPdfPage(pageNum)
    // renderPdfPage will be called by useEffect when currentPdfPage changes
  }

  const handlePageDoubleClick = (pageNum: number) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum)
      } else {
        newSet.add(pageNum)
      }
      return newSet
    })
  }

  const handleSaveTurnover = () => {
    setToastMessage("Annual turnover data saved successfully!")
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const handleRefreshTurnover = async () => {
    if (!bidIdParam || !bid) {
      setToastMessage("No bid selected")
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
      return
    }

    if (!isLLMConfigured()) {
      setToastMessage("Please configure LLM settings first")
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
      return
    }

    try {
      setIsRefreshing(true)
      setToastMessage(hasInitialQuery ? "Refreshing data..." : "Starting search...")
      setShowToast(true)

      // Get current criteria (should be annual turnover)
      const criteriaKeysSorted = Object.keys(criteria).sort((a, b) => {
        const numA = parseInt(a) || 0
        const numB = parseInt(b) || 0
        return numA - numB
      })
      const currentCriteria = criteriaKeysSorted[activeCriteriaIndex]
      const crit = criteria[currentCriteria]
      const query = crit?.description || "5 year anual turnover ca certified."

      let selectedPagesContent: string[] = []
      let ragResults: any[] = []

      // Step 1: If first time (Start), do RAG search
      if (!hasInitialQuery) {
        setToastMessage("Searching bid documents...")
        setShowToast(true)

        // RAG Search
        const searchResponse = await fetch(`${API_BASE_URL}/bids/${bidIdParam}/search`, {
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
          ragResults = data.results || []

          // Mark all RAG result pages as selected (convert 0-indexed to 1-indexed)
          if (ragResults.length > 0) {
            const newSelectedPages = new Set<number>()
            ragResults.forEach((result: any) => {
              const pageNo = parseInt(result.page_no || "0") + 1 // Convert to 1-indexed
              newSelectedPages.add(pageNo)
            })
            setSelectedPages(newSelectedPages)
          }
        }

        // Collect top 5 from RAG results
        if (ragResults.length > 0) {
          const topResults = ragResults.slice(0, 5)
          topResults.forEach((result: any) => {
            const pageNum = parseInt(result.page_no || "0") + 1
            selectedPagesContent.push(`Page ${pageNum}:\n${result.content || ""}\n\nSemantic Meaning: ${result.semantic_meaning || ""}`)
          })
        }

        setHasInitialQuery(true)
      } else {
        // Step 2: Subsequent clicks - use selected pages
        if (selectedPages.size === 0) {
          setToastMessage("Please select at least one page")
          setShowToast(true)
          setTimeout(() => setShowToast(false), 2000)
          setIsRefreshing(false)
          return
        }

        const sortedPageNos = Array.from(selectedPages).sort((a, b) => a - b)

        for (const pageNum of sortedPageNos) {
          // Find chunks for this page (page_no is 0-indexed in backend, but we use 1-indexed)
          const pageChunks = bidDataChunks.filter(chunk => {
            const chunkPageNo = parseInt(chunk.page_no || "0")
            return chunkPageNo === (pageNum - 1) // Convert 1-indexed to 0-indexed
          })

          if (pageChunks.length > 0) {
            const pageContent = pageChunks.map(chunk => 
              `Page ${pageNum}:\n${chunk.content || ""}\n\nSemantic Meaning: ${chunk.semantic_meaning || ""}`
            ).join("\n\n---\n\n")
            selectedPagesContent.push(pageContent)
          }
        }
      }

      if (selectedPagesContent.length === 0) {
        setToastMessage("No OCR content found")
        setShowToast(true)
        setTimeout(() => setShowToast(false), 2000)
        setIsRefreshing(false)
        return
      }

      setToastMessage("Generating response with Gemini...")
      setShowToast(true)

      const contextContent = selectedPagesContent.join("\n\n==========\n\n")

      // Create prompt for Gemini to extract annual turnover values
      const prompt = `You are an AI assistant helping with bid document evaluation. Based on the following OCR content from selected pages of the bid document, extract the annual turnover values for the last 5 years.

${contextContent}

Query: ${query}

Please extract the annual turnover values for the following years and return ONLY a valid JSON object in this exact format:
{
${TURNOVER_YEARS.map(year => `  "${year}": <value>`).join(",\n")}
}

Where <value> is the numeric turnover value for that year. If a value is not found, use null. Return ONLY the JSON object, no other text.`

      const llmConfig = getLLMConfig()
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
            generatedText = llmData.response || ""
          } else {
            const errorData = await llmResponse.json().catch(() => ({ detail: "Unknown error" }))
            if (llmResponse.status === 503) {
              throw new Error("Gemini API is temporarily overloaded. Please try again in a few moments.")
            }
            throw new Error(`Gemini API error: ${errorData.detail || "Unknown error"}`)
          }
        } else {
          throw new Error("Gemini API key not configured")
        }
      } else if (llmConfig.provider === "cdac") {
        if ((llmConfig as any).cdacApiKey) {
          const llmResponse = await fetch(`${API_BASE_URL}/llm/generate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              provider: "cdac",
              api_key: (llmConfig as any).cdacApiKey,
              prompt: prompt,
              max_tokens: 1024,
            }),
          })

          if (llmResponse.ok) {
            const llmData = await llmResponse.json()
            generatedText = llmData.response || ""
          } else {
            const errorData = await llmResponse.json().catch(() => ({ detail: "Unknown error" }))
            if (llmResponse.status === 503) {
              throw new Error("CDAC API is temporarily unavailable. Please try again in a few moments.")
            }
            throw new Error(`CDAC API error: ${errorData.detail || "Unknown error"}`)
          }
        } else {
          throw new Error("CDAC API key not configured")
        }
      } else {
        throw new Error("Unknown LLM provider")
      }

      // Parse JSON response
      if (generatedText) {
        try {
          // Extract JSON from response (in case there's extra text)
          const jsonMatch = generatedText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const jsonStr = jsonMatch[0]
            const parsedData = JSON.parse(jsonStr)
            
            // Update turnover data
            const updatedData: Record<string, string> = {}
            TURNOVER_YEARS.forEach(year => {
              updatedData[year] = parsedData[year]?.toString() || ""
            })
            setTurnoverData(updatedData)

            setToastMessage("Data refreshed successfully!")
            setShowToast(true)
            setTimeout(() => setShowToast(false), 3000)
          } else {
            throw new Error("No JSON found in response")
          }
        } catch (parseError) {
          console.error("Error parsing JSON:", parseError)
          setToastMessage("Error parsing response. Please try again.")
          setShowToast(true)
          setTimeout(() => setShowToast(false), 3000)
        }
      } else {
        setToastMessage("Failed to get response from LLM")
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      }
    } catch (error) {
      console.error("Error refreshing turnover:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setToastMessage(errorMessage.includes("overloaded") || errorMessage.includes("unavailable") 
        ? errorMessage 
        : "Error refreshing data. Please try again.")
      setShowToast(true)
      setTimeout(() => setShowToast(false), 5000) // Show longer for error messages
    } finally {
      setIsRefreshing(false)
    }
  }

  // Resizable divider handlers
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingDivider(true)
  }, [])

  const handleDividerMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingDivider || !mainContentRef.current) return
      
      const container = mainContentRef.current
      const rect = container.getBoundingClientRect()
      const mouseXRelativeToContainer = e.clientX - rect.left
      const newDividerPosition = (mouseXRelativeToContainer / rect.width) * 100
      
      // Constrain between 20% and 80%
      const constrainedPosition = Math.max(20, Math.min(80, newDividerPosition))
      setPdfTableDivider(constrainedPosition)
    },
    [isResizingDivider]
  )

  const handleDividerMouseUp = useCallback(() => {
    setIsResizingDivider(false)
  }, [])

  useEffect(() => {
    if (isResizingDivider) {
      document.addEventListener("mousemove", handleDividerMouseMove)
      document.addEventListener("mouseup", handleDividerMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      return () => {
        document.removeEventListener("mousemove", handleDividerMouseMove)
        document.removeEventListener("mouseup", handleDividerMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
  }, [isResizingDivider, handleDividerMouseMove, handleDividerMouseUp])

  const criteriaKeys = Object.keys(criteria).sort((a, b) => {
    const numA = parseInt(a) || 0
    const numB = parseInt(b) || 0
    return numA - numB
  })

  if (loading && bidIdParam) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    )
  }

  // Bid list if no bid selected
  if (showBidSelector) {
    return (
      <AppLayout>
        <div className="p-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Bids</h1>
              <p className="text-sm text-muted-foreground">
                {bids.length} {bids.length === 1 ? "Bid" : "Bids"}
              </p>
            </div>
          </div>

          {/* Bids Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sr. No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Bid ID</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bids.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <p className="text-sm text-muted-foreground">No bids found. Upload your first bid to get started.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    bids.map((b, index) => (
                      <TableRow 
                        key={b.bid_id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          router.push(`/bids2?bid=${b.bid_id}`)
                        }}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">{b.bid_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">{b.bid_id}</div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/bids2?bid=${b.bid_id}`)
                            }}
                          >
                            Select
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    )
  }

  // Initial selection screen
  if (phase === "selection") {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="grid grid-cols-2 gap-8 max-w-4xl">
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setPhase("self-evaluation")}
            >
              <CardContent className="p-12 text-center">
                <h2 className="text-2xl font-bold mb-4">Bidder Self Evaluation</h2>
                <p className="text-muted-foreground">Evaluate bid documents and fill evaluation criteria</p>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setPhase("scrutiny")}
            >
              <CardContent className="p-12 text-center">
                <h2 className="text-2xl font-bold mb-4">Scrutiny Corner</h2>
                <p className="text-muted-foreground">Review and validate bid evaluations</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Scrutiny Corner (placeholder)
  if (phase === "scrutiny") {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="mb-6">
            <Button variant="outline" onClick={() => setPhase("selection")}>
              ← Back
            </Button>
          </div>
          <Card>
            <CardContent className="p-12 text-center">
              <h2 className="text-2xl font-bold mb-4">Scrutiny Corner</h2>
              <p className="text-muted-foreground">Scrutiny form coming soon...</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    )
  }

  // Bidder Self Evaluation
  const currentCriteria = criteriaKeys[activeCriteriaIndex]
  const currentCriteriaTitle = currentCriteria ? criteria[currentCriteria]?.title : ""
  
  return (
    <AppLayout>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="flex-shrink-0 p-4 border-b bg-background">
          <div className="flex items-center justify-between">
            {/* Left: Project Info */}
            <div>
              <h1 className="text-xl font-bold">{tender?.name || "Kukadi Irrigation project"}</h1>
              <p className="text-sm text-muted-foreground">{bid?.bid_name || "Abhiraj and Shraddha J.V"}</p>
              {currentCriteriaTitle && (
                <p className="text-sm font-medium mt-1">
                  {currentCriteriaTitle} : {selectedBidder}
                </p>
              )}
              <Button
                variant="link"
                className="p-0 h-auto mt-2 text-sm"
                onClick={() => {
                  router.push(`/bid-chat?bid=${bid?.bid_id}`)
                }}
              >
                Switch to Chat mode →
              </Button>
            </div>
            
            {/* Right: Progress Bar */}
            {criteriaKeys.length > 0 && (
              <div className="flex items-center gap-2">
                {criteriaKeys.map((key, index) => {
                  const crit = criteria[key]
                  const isActive = index === activeCriteriaIndex
                  const isCompleted = index < activeCriteriaIndex
                  
                  return (
                    <TooltipProvider key={key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all cursor-pointer ${
                                isActive
                                  ? "bg-primary text-primary-foreground scale-110"
                                  : isCompleted
                                  ? "bg-primary/50 text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                              onClick={() => setActiveCriteriaIndex(index)}
                            >
                              {key}
                            </div>
                            {index < criteriaKeys.length - 1 && (
                              <div
                                className={`h-1 w-12 ${
                                  isCompleted ? "bg-primary" : "bg-muted"
                                }`}
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{crit.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div ref={mainContentRef} className="flex-1 flex overflow-hidden">
          {/* Left Section - Page Selection + PDF Viewer (50% by default) */}
          <div 
            className="flex overflow-hidden flex-shrink-0"
            style={{ width: `${pdfTableDivider}%` }}
          >
            {/* Left - Vertical Page Selection */}
            <div className="w-64 border-r bg-background overflow-y-auto flex-shrink-0">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-sm">Page selection</h3>
              </div>
              <ScrollArea className="h-full">
                <div className="p-2 space-y-2">
                  {Array.from({ length: totalPdfPages || 50 }, (_, i) => i + 1).map((pageNum) => {
                    const isSelected = selectedPages.has(pageNum)
                    const thumbnail = pageThumbnails[pageNum]
                    return (
                      <div
                        key={pageNum}
                        onClick={() => handlePageClick(pageNum)}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          handlePageDoubleClick(pageNum)
                        }}
                        className={`p-2 border-2 rounded cursor-pointer transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : currentPdfPage === pageNum
                            ? "border-primary bg-primary/5"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        <div className="flex flex-col gap-2">
                          {thumbnail ? (
                            <img
                              src={thumbnail}
                              alt={`Page ${pageNum} thumbnail`}
                              className="w-full h-auto rounded"
                            />
                          ) : (
                            <div className="w-full aspect-[3/4] bg-muted rounded border flex items-center justify-center">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex items-center justify-center">
                            <span className="text-xs font-medium">Page {pageNum}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Center - PDF Viewer */}
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
            {/* PDF Viewer Controls */}
            <div className="flex-shrink-0 flex items-center justify-between p-2 border-b">
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
                  Page {currentPdfPage} of {totalPdfPages || 0}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPdfPage(prev => prev + 1)}
                  disabled={currentPdfPage >= (totalPdfPages || 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPdfZoom(prev => Math.max(50, prev - 25))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium w-16 text-center">{pdfZoom}%</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPdfZoom(prev => Math.min(200, prev + 25))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPdfRotation(prev => (prev + 90) % 360)}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* PDF Display */}
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
                  style={{ 
                    maxHeight: '100%',
                    transform: `rotate(${pdfRotation}deg)`
                  }}
                />
              ) : (
                <div className="text-center text-muted-foreground p-4">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No PDF loaded</p>
                </div>
              )}
            </div>
          </div>
          </div>

          {/* Resizable Divider */}
          <div
            onMouseDown={handleDividerMouseDown}
            className={`w-1 bg-border hover:bg-primary cursor-col-resize transition-colors flex-shrink-0 ${
              isResizingDivider ? "bg-primary" : ""
            }`}
            style={{ cursor: "col-resize" }}
          />

          {/* Right - Table Section */}
          <div 
            className="bg-background flex flex-col flex-shrink-0"
            style={{ width: `${100 - pdfTableDivider}%` }}
          >
            <div className="flex-1 overflow-y-auto p-6">
              {/* Show table only for current active criteria */}
              {currentCriteria && criteria[currentCriteria]?.title?.toLowerCase().includes("annual turnover") ? (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-4">Last 5 year turnover</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Year</TableHead>
                          {TURNOVER_YEARS.map(year => (
                            <TableHead key={year}>{year}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Annual turnover</TableCell>
                          {TURNOVER_YEARS.map((year) => (
                            <TableCell key={year}>
                              {editingCell === year ? (
                                <Input
                                  value={turnoverData[year as keyof typeof turnoverData]}
                                  onChange={(e) => setTurnoverData(prev => ({
                                    ...prev,
                                    [year]: e.target.value
                                  }))}
                                  onBlur={() => setEditingCell(null)}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      setEditingCell(null)
                                    }
                                  }}
                                  className="w-24"
                                  autoFocus
                                />
                              ) : (
                                <div
                                  onClick={() => setEditingCell(year)}
                                  className="cursor-pointer hover:bg-muted/50 p-2 rounded min-w-[100px]"
                                >
                                  {turnoverData[year as keyof typeof turnoverData] || "-"}
                                </div>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                    <div className="flex gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        onClick={handleRefreshTurnover}
                        disabled={isRefreshing || (!hasInitialQuery && !isLLMConfigured()) || (hasInitialQuery && selectedPages.size === 0)}
                      >
                        {isRefreshing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {hasInitialQuery ? "Refreshing..." : "Starting..."}
                          </>
                        ) : hasInitialQuery ? (
                          "Refresh"
                        ) : (
                          "Start"
                        )}
                      </Button>
                      <Button onClick={handleSaveTurnover}>
                        Save
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Click to edit values manually
                    </p>
                  </CardContent>
                </Card>
              ) : currentCriteria ? (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-4">{criteria[currentCriteria]?.title || "Criteria"}</h3>
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Table for {criteria[currentCriteria]?.title || "this criteria"}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
            
            {/* Selected Pages List - Bottom */}
            {selectedPages.size > 0 && (
              <div className="flex-shrink-0 border-t bg-muted/30 p-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Selected Pages:</span>
                  <div className="flex-1 overflow-x-auto overflow-y-hidden">
                    <div className="flex gap-1.5 px-1 min-w-max">
                      {Array.from(selectedPages).sort((a, b) => a - b).map((pageNum) => (
                        <div
                          key={pageNum}
                          onClick={() => handlePageClick(pageNum)}
                          className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded text-xs font-semibold flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors"
                          title={`Page ${pageNum} - Click to view`}
                        >
                          {pageNum}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-bottom-5">
            {toastMessage}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default function Bids2PageWrapper() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    }>
      <Bids2Page />
    </Suspense>
  )
}
