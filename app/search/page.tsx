"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Search, FileText, BookOpen, X, Sparkles, Loader2 } from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Document {
  document_id: string
  document_name: string
  total_pages: number
}

interface SearchResult {
  document_id: string
  document_name: string
  page_no: number
  content: string
  semantic_meaning: string
  similarity_score: number
  content_types: string
}

export default function SearchPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

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
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error("Error fetching documents:", error)
    } finally {
      setLoadingDocs(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const payload: any = {
        query: searchQuery,
        n_results: 10,
      }

      if (selectedDocument && selectedDocument !== "all") {
        payload.document_id = selectedDocument
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
        setResults(
          data.results?.map((r: any) => ({
            ...r,
            document_name:
              r.document_name ||
              documents.find((d) => d.document_id === r.document_id)?.document_name ||
              "Unknown",
          })) || []
        )
      } else {
        console.error("Search failed:", await response.text())
      }
    } catch (error) {
      console.error("Error searching:", error)
    } finally {
      setLoading(false)
    }
  }

  const selectedDocData = documents.find((d) => d.document_id === selectedDocument)

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Document Search</h1>
          <p className="text-muted-foreground">
            Search through documents using semantic search powered by ChromaDB
          </p>
        </div>

        {/* Search Controls */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Document Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Document <span className="text-muted-foreground">(Optional)</span>
                </label>
                <Select
                  value={selectedDocument}
                  onValueChange={setSelectedDocument}
                  disabled={loadingDocs}
                >
                  <SelectTrigger className="w-full">
                    <FileText className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="All documents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Documents</SelectItem>
                    {documents.map((doc) => (
                      <SelectItem key={doc.document_id} value={doc.document_id}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className="truncate text-sm">
                            {doc.document_name || doc.document_id.substring(0, 30) + "..."}
                          </span>
                          <Badge variant="secondary" className="ml-auto text-xs flex-shrink-0">
                            {doc.total_pages}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDocData && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Filtering: <span className="font-medium">{selectedDocData.document_name}</span>{" "}
                    • {selectedDocData.total_pages} pages
                  </p>
                )}
              </div>

              {/* Search Input */}
              <div>
                <label className="text-sm font-medium mb-2 block">Search Query</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search in documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Search Results ({results.length} found)
              </h2>
              {selectedDocData && (
                <Badge variant="outline">{selectedDocData.document_name}</Badge>
              )}
            </div>

            <div className="grid gap-3">
              {results.map((result, index) => (
                <Card
                  key={index}
                  className="hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group"
                  onClick={() => {
                    setSelectedResult(result)
                    setIsDialogOpen(true)
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <BookOpen className="h-4 w-4" />
                          </div>
                          <CardTitle className="text-base font-semibold truncate">
                            Page {result.page_no}
                          </CardTitle>
                          <Badge variant="outline" className="text-xs font-normal">
                            {(1 - (result.similarity_score || 0)).toFixed(2)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-2">
                          {result.document_name}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {result.content_types && (
                            <Badge variant="secondary" className="text-xs">
                              {result.content_types}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedResult(result)
                          setIsDialogOpen(true)
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {/* Semantic Meaning Preview */}
                      {result.semantic_meaning && (
                        <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-md p-2.5 border border-primary/10">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                              {result.semantic_meaning}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Content Preview */}
                      {result.content && (
                        <div className="text-xs text-muted-foreground line-clamp-2 prose prose-xs max-w-none [&_*]:text-xs [&_*]:m-0">
                          <div
                            dangerouslySetInnerHTML={{
                              __html: result.content
                                .replace(/<[^>]*>/g, " ")
                                .substring(0, 150)
                                .trim() + "...",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && searchQuery && (
          <Card>
            <CardContent className="p-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground">
                Try a different search query or select a different document
              </p>
            </CardContent>
          </Card>
        )}

        {/* Initial State */}
        {!searchQuery && results.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Search className="h-12 w-12 text-primary/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Start Searching</h3>
              <p className="text-muted-foreground mb-4">
                Select a document (optional) and enter your search query to find relevant pages
              </p>
            </CardContent>
          </Card>
        )}

        {/* Detail Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
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
                        Relevance: {(1 - selectedResult.similarity_score).toFixed(3)}
                      </Badge>
                    )}
                  </DialogDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsDialogOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            {selectedResult && (
              <div className="flex-1 overflow-y-auto space-y-6 pt-4">
                {/* Semantic Meaning */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-sm">Semantic Meaning</h3>
                  </div>
                  <Card className="border-primary/20">
                    <CardContent className="p-4">
                      <p className="text-sm leading-relaxed text-foreground">
                        {selectedResult.semantic_meaning}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Full Content */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-sm">Page Content</h3>
                  </div>
                  <Card>
                    <CardContent className="p-4">
                      <div
                        className="prose prose-sm max-w-none [&_p]:text-sm [&_p]:leading-relaxed [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_table]:text-xs [&_img]:max-w-full [&_img]:rounded"
                        dangerouslySetInnerHTML={{ __html: selectedResult.content }}
                      />
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

