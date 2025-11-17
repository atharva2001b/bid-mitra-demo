"use client"

import { useState, Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Paperclip, FileText, X, BookOpen, Sparkles, Loader2 } from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Document {
  document_id: string
  document_name: string
  total_pages?: number
  page_count?: number
}

interface SearchResult {
  document_id: string
  document_name?: string
  page_no: number | string
  content: string
  semantic_meaning: string
  similarity_score?: number
  content_types?: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  searchResults?: SearchResult[]
  isLoading?: boolean
}


function BidChatContent() {
  const searchParams = useSearchParams()
  const initialBidParam = searchParams.get("bid")
  const [documents, setDocuments] = useState<Document[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [selectedBid, setSelectedBid] = useState<string | null>(
    initialBidParam || null
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const selectedBidData = selectedBid
    ? documents.find((d) => d.document_id === selectedBid)
    : null

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true)
      const response = await fetch(`${API_BASE_URL}/documents`)
      if (response.ok) {
        const data = await response.json()
        // Map to include both document_name and page_count
        const mappedDocs = (data.documents || []).map((doc: any) => ({
          document_id: doc.document_id,
          document_name: doc.document_name || doc.document_filename || "Bid Document",
          total_pages: doc.total_pages || doc.page_count || 0,
        }))
        setDocuments(mappedDocs)
        
        // Set initial bid if provided
        if (initialBidParam) {
          const foundDoc = mappedDocs.find((d: Document) => d.document_id === initialBidParam)
          if (foundDoc) {
            setSelectedBid(initialBidParam)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching documents:", error)
    } finally {
      setLoadingDocs(false)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedBid) return

    const query = input.trim()
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])

    // Add loading message
    const loadingMessageId = (Date.now() + 1).toString()
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: "assistant",
      content: "Searching documents...",
      isLoading: true,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, loadingMessage])

    setInput("")

    try {
      // Perform search
      const payload: any = {
        query: query,
        n_results: 10,
        document_id: selectedBid,
      }

      const response = await fetch(`${API_BASE_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()
        const results = (data.results || []).map((r: any) => ({
          ...r,
          document_name:
            r.document_name ||
            documents.find((d) => d.document_id === r.document_id)?.document_name ||
            selectedBidData?.document_name ||
            "Bid Document",
        }))

        // Update loading message with results
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  content: results.length > 0
                    ? `Found ${results.length} relevant result${results.length > 1 ? "s" : ""} from the document`
                    : "No results found for your query",
                  isLoading: false,
                  searchResults: results,
                }
              : msg
          )
        )
      } else {
        // Update with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  content: "Error searching documents. Please try again.",
                  isLoading: false,
                }
              : msg
          )
        )
      }
    } catch (error) {
      console.error("Error searching:", error)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                content: "Error searching documents. Please try again.",
                isLoading: false,
              }
            : msg
        )
      )
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <AppLayout>
      <div className="flex h-screen flex-col">
        {/* Header */}
        <div className="border-b bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Bid Chat</h1>
              <p className="text-sm text-muted-foreground">
                Chat with your bid documents using AI
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Select
                value={selectedBid || undefined}
                onValueChange={setSelectedBid}
                disabled={loadingDocs}
              >
                <SelectTrigger className="w-[300px]">
                  <Paperclip className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={loadingDocs ? "Loading documents..." : "Attach a bid document"} />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((doc) => (
                    <SelectItem key={doc.document_id} value={doc.document_id}>
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[250px]">{doc.document_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {doc.total_pages || 0} pages
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Selected Bid Info */}
        {selectedBidData && (
          <div className="border-b bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{selectedBidData.document_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedBidData.total_pages || 0} pages • {selectedBidData.document_id.substring(0, 8)}...
                  </p>
                </div>
                <Badge variant="secondary">{selectedBidData.total_pages || 0} pages</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedBid(null)
                  setMessages([])
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!selectedBid ? (
            <div className="flex h-full items-center justify-center">
              <Card className="w-full max-w-2xl">
                <CardContent className="p-12 text-center">
                  <Paperclip className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No bid attached</h2>
                  <p className="text-muted-foreground mb-6">
                    Select a bid document from the dropdown above to start chatting
                  </p>
                  <Select
                    value={selectedBid || undefined}
                    onValueChange={setSelectedBid}
                    disabled={loadingDocs}
                  >
                    <SelectTrigger className="w-[400px] mx-auto">
                      <Paperclip className="mr-2 h-4 w-4" />
                      <SelectValue placeholder={loadingDocs ? "Loading documents..." : "Attach a bid document"} />
                    </SelectTrigger>
                    <SelectContent>
                      {documents.map((doc) => (
                        <SelectItem key={doc.document_id} value={doc.document_id}>
                          <div className="flex flex-col">
                            <span className="font-medium truncate max-w-[350px]">{doc.document_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {doc.total_pages || 0} pages
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Messages */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-6">
                  <div className="mx-auto max-w-4xl space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        Start chatting about {selectedBidData?.name}
                      </h3>
                      <p className="text-muted-foreground">
                        Ask questions about the bid document, requirements, pricing, or any other
                        details.
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-3 ${
                            message.role === "user"
                              ? "bg-primary/90 text-primary-foreground"
                              : "bg-muted border border-border"
                          }`}
                        >
                          {message.isLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <p className="text-sm">{message.content}</p>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm">{message.content}</p>
                              {message.searchResults && message.searchResults.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs mb-2">Here are your requested results:</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {message.searchResults.map((result, idx) => (
                                      <Card
                                        key={idx}
                                        className="cursor-pointer hover:shadow-sm hover:border-border transition-all bg-card border border-border"
                                        onClick={() => {
                                          setSelectedResult(result)
                                          setIsDialogOpen(true)
                                        }}
                                      >
                                        <CardContent className="p-3">
                                          <div className="flex items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-1.5">
                                                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-xs font-medium">
                                                  Page {result.page_no}
                                                </span>
                                                {result.similarity_score !== undefined && (
                                                  <Badge variant="outline" className="text-xs font-normal ml-auto">
                                                    {(1 - (result.similarity_score || 0)).toFixed(2)}
                                                  </Badge>
                                                )}
                                              </div>
                                              {result.semantic_meaning && (
                                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                  {result.semantic_meaning}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          <p
                            className={`mt-1 text-xs ${
                              message.role === "user"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {message.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  </div>
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t bg-card p-4">
                <div className="mx-auto max-w-4xl">
                  <div className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask a question about the bid..."
                      className="flex-1"
                    />
                    <Button onClick={handleSendMessage} disabled={!input.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Result Detail Modal */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="w-[70vw] sm:max-w-[70vw] md:max-w-[70vw] lg:max-w-[70vw] xl:max-w-[70vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted border border-border">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    Page {selectedResult?.page_no} • {selectedResult?.document_name}
                  </DialogTitle>
                  <DialogDescription className="mt-1.5">
                    <span className="font-mono text-xs">{selectedResult?.document_id}</span>
                    {selectedResult?.content_types && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {selectedResult.content_types}
                      </Badge>
                    )}
                    {selectedResult?.similarity_score !== undefined && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Relevance: {(1 - (selectedResult.similarity_score || 0)).toFixed(3)}
                      </Badge>
                    )}
                  </DialogDescription>
                </div>
                {/* Single close handled by outside click/ESC to avoid duplicate buttons */}
              </div>
            </DialogHeader>

            {selectedResult && (
              <div className="flex-1 overflow-hidden flex">
                {/* Left Column - HTML Rendered Content */}
                <div className="flex-1 overflow-y-auto border-r p-6 bg-muted/30">
                  <div className="flex items-center gap-2 mb-4 sticky top-0 bg-muted/30 pb-2 border-b">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Page Content</h3>
                  </div>
                  <div
                    className="prose prose-sm max-w-none [&_p]:text-sm [&_p]:leading-relaxed [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_table]:text-xs [&_img]:max-w-full [&_img]:rounded [&_table]:border [&_td]:border [&_th]:border [&_td]:p-2 [&_th]:p-2"
                    dangerouslySetInnerHTML={{ __html: selectedResult.content }}
                  />
                </div>

                {/* Right Column - Semantic Meaning */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="flex items-center gap-2 mb-4 sticky top-0 bg-background pb-2 border-b">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Semantic Meaning</h3>
                  </div>
                  <Card className="border-border">
                    <CardContent className="p-4">
                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {selectedResult.semantic_meaning}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

export default function BidChatPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-semibold">Loading...</div>
          </div>
        </div>
      </AppLayout>
    }>
      <BidChatContent />
    </Suspense>
  )
}

