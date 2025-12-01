"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Edit, RefreshCw, MessageSquare, Info, ArrowDown, ArrowRight, Upload, Loader2, Plus, Trash2, Save, X, FileText, Eye, BookOpen, Sparkles, ChevronUp, ChevronDown, PlayCircle, CheckCircle } from "lucide-react"

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

export default function TenderDetailPage() {
  const params = useParams()
  const tenderId = params.id as string
  const [tender, setTender] = useState<Tender | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderId])

  const fetchTender = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_BASE_URL}/tenders/${tenderId}`)
      if (response.ok) {
        const data = await response.json()
        setTender(data)
      } else {
        const errorText = await response.text()
        setError(errorText || "Failed to load tender")
      }
    } catch (err) {
      console.error("Error fetching tender:", err)
      setError("An error occurred while loading the tender")
    } finally {
      setLoading(false)
    }
  }

  // Parse bid IDs and evaluation criteria
  const bidIds = tender ? JSON.parse(tender.bid_ids || "[]") : []
  const bidIdsString = JSON.stringify(bidIds) // Create stable string for comparison
  const evaluationCriteria = tender ? JSON.parse(tender.evaluation_criteria_json || "{}") : {}
  const hasBids = bidIds.length > 0
  // Check if criteria has meaningful data (not just empty structure)
  const hasCriteria = Object.keys(evaluationCriteria).length > 0 && 
    Object.values(evaluationCriteria).some((c: any) => c?.title && c.title.trim() !== "")

  // State for editing criteria - initialize empty, will be set in useEffect
  const [editingCriteria, setEditingCriteria] = useState<Record<string, { title: string; value: string; requirement?: string; description?: string; subPoints?: Record<string, { title: string; value: string; requirement?: string; description?: string }> }>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<"table" | "edit">("table")

  // State for bid upload
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [bidName, setBidName] = useState("")
  const [bidPdfFile, setBidPdfFile] = useState<File | null>(null)
  const [bidCsvFile, setBidCsvFile] = useState<File | null>(null)
  
  // State for tab control
  const [activeTab, setActiveTab] = useState("summary")
  const [uploadingBid, setUploadingBid] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // State for bids data
  const [bids, setBids] = useState<Array<{ bid_id: string; bid_name: string; pdf_path: string }>>([])
  const [loadingBids, setLoadingBids] = useState(false)
  const [selectedBid, setSelectedBid] = useState<{ bid_id: string; bid_name: string; pdf_path: string } | null>(null)
  const [bidData, setBidData] = useState<Array<{ id: string; page_no: string; content: string; semantic_meaning: string }>>([])
  const [isBidViewDialogOpen, setIsBidViewDialogOpen] = useState(false)
  const [loadingBidData, setLoadingBidData] = useState(false)
  const [viewingPdf, setViewingPdf] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isEditNameDialogOpen, setIsEditNameDialogOpen] = useState(false)
  const [editingTenderName, setEditingTenderName] = useState("")
  const [savingName, setSavingName] = useState(false)
  
  // Ref to track last fetched bid IDs to prevent infinite loops
  const lastFetchedBidIdsRef = useRef<string>("")

  // Update editing criteria when tender data changes
  useEffect(() => {
    if (tender) {
      let criteria: any = {}
      try {
        const criteriaStr = tender.evaluation_criteria_json || "{}"
        criteria = JSON.parse(criteriaStr)
      } catch (e) {
        console.error("Error parsing evaluation criteria:", e)
        criteria = {}
      }
      
      // Check if criteria is empty or has no meaningful data
      const hasValidCriteria = Object.keys(criteria).length > 0 && 
        Object.values(criteria).some((c: any) => c?.title && typeof c.title === "string" && c.title.trim() !== "")
      
      // Check if criteria needs migration (missing requirement fields or wrong sub-point keys)
      const needsMigration = hasValidCriteria && (
        Object.values(criteria).some((c: any) => !c.hasOwnProperty("requirement")) ||
        Object.values(criteria).some((c: any) => {
          if (c.subPoints) {
            return Object.keys(c.subPoints).some(key => !key.includes("."))
          }
          return false
        })
      )
      
      console.log("📋 Evaluation criteria check:", {
        hasKeys: Object.keys(criteria).length > 0,
        hasValidCriteria,
        needsMigration,
        criteria
      })
      
      // Default criteria structure
      const defaultCriteria = {
        "1": {
          title: "Annual Turnover (updated to current year)",
          value: "Rs lakhs",
          requirement: "3106.13",
          description: ""
        },
        "2": {
          title: "Bid Capacity = ( AxNx2) – B",
          value: "Rs lakhs",
          requirement: "8283.00",
          description: ""
        },
        "3": {
          title: "Completed Similar type of work",
          value: "Rs lakhs",
          requirement: "2484.90",
          description: ""
        },
        "4": {
          title: "Quantities of Main Items Executed in any single year",
          value: "",
          requirement: "",
          description: "",
          subPoints: {
            "4.a": {
              title: "Concrete Lining",
              value: "Cum",
              requirement: "16910",
              description: ""
            },
            "4.b": {
              title: "Steel Reinforcement",
              value: "MT",
              requirement: "431",
              description: ""
            },
            "4.c": {
              title: "Earthwork",
              value: "Cum",
              requirement: "60490",
              description: ""
            }
          }
        }
      }
      
      // If no criteria exists, prefill with default data and auto-save
      if (!hasValidCriteria) {
        console.log("🔄 Prefilling default evaluation criteria")
        setEditingCriteria(defaultCriteria)
        
        // Auto-save the prefilled criteria
        const savePrefilledCriteria = async () => {
          try {
            const criteriaJsonString = JSON.stringify(defaultCriteria)
            const response = await fetch(`${API_BASE_URL}/tenders/${tenderId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                evaluation_criteria_json: criteriaJsonString,
              }),
            })

            if (response.ok) {
              const updatedTender = await response.json()
              setTender(updatedTender)
              console.log("✅ Prefilled evaluation criteria saved automatically")
            } else {
              const errorText = await response.text()
              console.error("❌ Failed to save prefilled criteria:", errorText)
            }
          } catch (err) {
            console.error("❌ Error auto-saving prefilled criteria:", err)
          }
        }
        
        // Save after a short delay to ensure state is set
        setTimeout(() => {
          savePrefilledCriteria()
        }, 500)
      } else if (needsMigration) {
        // Migrate old structure to new structure
        console.log("🔄 Migrating old evaluation criteria structure")
        const migratedCriteria: any = {}
        
        Object.keys(criteria).forEach(key => {
          const item = criteria[key]
          migratedCriteria[key] = {
            title: item.title || "",
            value: item.value || "",
            requirement: item.requirement || (key === "1" ? "3106.13" : key === "2" ? "8283.00" : key === "3" ? "2484.90" : ""),
            description: item.description || ""
          }
          
          // Migrate sub-points if they exist
          if (item.subPoints) {
            migratedCriteria[key].subPoints = {}
            Object.keys(item.subPoints).forEach(subKey => {
              const subItem = item.subPoints[subKey]
              // Fix sub-point keys: if key is "a", "b", "c", change to "4.a", "4.b", "4.c"
              const newSubKey = subKey.includes(".") ? subKey : `${key}.${subKey}`
              migratedCriteria[key].subPoints[newSubKey] = {
                title: subItem.title || "",
                value: subItem.value || "",
                requirement: subItem.requirement || (newSubKey === "4.a" ? "16910" : newSubKey === "4.b" ? "431" : newSubKey === "4.c" ? "60490" : ""),
                description: subItem.description || ""
              }
            })
          }
        })
        
        setEditingCriteria(migratedCriteria)
        
        // Auto-save the migrated criteria
        const saveMigratedCriteria = async () => {
          try {
            const criteriaJsonString = JSON.stringify(migratedCriteria)
            const response = await fetch(`${API_BASE_URL}/tenders/${tenderId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                evaluation_criteria_json: criteriaJsonString,
              }),
            })

            if (response.ok) {
              const updatedTender = await response.json()
              setTender(updatedTender)
              console.log("✅ Migrated evaluation criteria saved automatically")
            } else {
              const errorText = await response.text()
              console.error("❌ Failed to save migrated criteria:", errorText)
            }
          } catch (err) {
            console.error("❌ Error auto-saving migrated criteria:", err)
          }
        }
        
        // Save after a short delay to ensure state is set
        setTimeout(() => {
          saveMigratedCriteria()
        }, 500)
      } else {
        console.log("✅ Using existing evaluation criteria")
        setEditingCriteria(criteria)
      }
      setEditingTenderName(tender.name)
    }
  }, [tender, tenderId])

  const handleSaveTenderName = async () => {
    if (!tender || !editingTenderName.trim()) return

    setSavingName(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/tenders/${tenderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingTenderName.trim(),
        }),
      })

      if (response.ok) {
        const updatedTender = await response.json()
        setTender(updatedTender)
        setIsEditNameDialogOpen(false)
      } else {
        const errorText = await response.text()
        setError(errorText || "Failed to update tender name")
      }
    } catch (err) {
      console.error("❌ Error updating tender name:", err)
      setError("An error occurred while updating tender name")
    } finally {
      setSavingName(false)
    }
  }

  // Fetch bids data when bidIds change
  useEffect(() => {
    // Only fetch if bidIds have actually changed
    if (bidIdsString !== lastFetchedBidIdsRef.current) {
      lastFetchedBidIdsRef.current = bidIdsString
      
      if (bidIds.length > 0) {
        fetchBidsData()
      } else {
        setBids([])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidIdsString]) // Use stringified version to avoid infinite loops

  const fetchBidsData = async () => {
    if (bidIds.length === 0 || loadingBids) return
    
    setLoadingBids(true)
    try {
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
    } catch (err) {
      console.error("Error fetching bids:", err)
      setBids([])
    } finally {
      setLoadingBids(false)
    }
  }

  const handleViewBid = async (bid: { bid_id: string; bid_name: string; pdf_path: string }) => {
    setSelectedBid(bid)
    setLoadingBidData(true)
    setIsBidViewDialogOpen(true)
    
    try {
      const response = await fetch(`${API_BASE_URL}/bids/${bid.bid_id}/data`)
      if (response.ok) {
        const data = await response.json()
        
        // Ensure chunks is an array
        const chunks = Array.isArray(data.chunks) ? data.chunks : []
        
        if (chunks.length === 0) {
          setBidData([])
          return
        }
        
        // Group by page_no
        const groupedByPage = chunks.reduce((acc: any, chunk: any) => {
          const pageNo = chunk.page_no || "0"
          if (!acc[pageNo]) {
            acc[pageNo] = {
              page_no: pageNo,
              chunks: []
            }
          }
          acc[pageNo].chunks.push(chunk)
          return acc
        }, {})
        
        // Convert to array and sort by page number
        const pages = Object.values(groupedByPage).sort((a: any, b: any) => {
          return parseInt(a.page_no) - parseInt(b.page_no)
        })
        
        setBidData(pages as any)
      } else {
        console.error("Failed to fetch bid data:", response.statusText)
        setBidData([])
      }
    } catch (err) {
      console.error("Error fetching bid data:", err)
      setBidData([])
    } finally {
      setLoadingBidData(false)
    }
  }

  const handleViewPdf = (pdfPath: string) => {
    // Create a URL for the PDF file
    let fullUrl = pdfPath
    if (!pdfPath.startsWith('http')) {
      // If it's a relative path, construct the full URL
      if (pdfPath.startsWith('/')) {
        fullUrl = `${API_BASE_URL}${pdfPath}`
      } else {
        fullUrl = `${API_BASE_URL}/${pdfPath}`
      }
    }
    setPdfUrl(fullUrl)
    setViewingPdf(true)
  }

  const handleSaveCriteria = async () => {
    if (!tender) return

    setSaving(true)
    setError(null)
    
    try {
      // Convert editingCriteria to JSON string for persistence
      const criteriaJsonString = JSON.stringify(editingCriteria)
      console.log("💾 Saving evaluation criteria:", {
        tenderId,
        criteriaLength: criteriaJsonString.length,
        criteriaPreview: criteriaJsonString.substring(0, 100) + "..."
      })

      const response = await fetch(`${API_BASE_URL}/tenders/${tenderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          evaluation_criteria_json: criteriaJsonString, // Store as JSON string
        }),
      })

      if (response.ok) {
        const updatedTender = await response.json()
        console.log("✅ Criteria saved successfully:", updatedTender)
        
        // Update local state with the saved data
        setTender(updatedTender)
        
        // Parse and update editing criteria to match saved data
        const savedCriteria = JSON.parse(updatedTender.evaluation_criteria_json || "{}")
        setEditingCriteria(savedCriteria)
        setIsEditing(false)
        setViewMode("table") // Switch to table view after saving
        
        // Show success message (optional - you can add a toast notification here)
        console.log("✅ Evaluation criteria persisted to ChromaDB")
      } else {
        const errorText = await response.text()
        console.error("❌ Failed to save criteria:", errorText)
        setError(errorText || "Failed to save criteria")
      }
    } catch (err) {
      console.error("❌ Error saving criteria:", err)
      setError("An error occurred while saving criteria")
    } finally {
      setSaving(false)
    }
  }

  const addMainPoint = () => {
    const keys = Object.keys(editingCriteria)
    const nextNumber = keys.length > 0 ? Math.max(...keys.map(k => parseInt(k) || 0)) + 1 : 1
    setEditingCriteria({
      ...editingCriteria,
      [nextNumber.toString()]: {
        title: "",
        value: "",
        requirement: "",
        description: "",
      },
    })
    setIsEditing(true)
  }

  const updateMainPoint = (key: string, field: "title" | "value" | "requirement" | "description", value: string) => {
    setEditingCriteria({
      ...editingCriteria,
      [key]: {
        ...editingCriteria[key],
        [field]: value,
      },
    })
    setIsEditing(true)
  }

  const removeMainPoint = (key: string) => {
    const newCriteria = { ...editingCriteria }
    delete newCriteria[key]
    setEditingCriteria(newCriteria)
    setIsEditing(true)
  }

  const addSubPoint = (parentKey: string) => {
    const parent = editingCriteria[parentKey]
    if (!parent) return

    const subPoints = parent.subPoints || {}
    const subKeys = Object.keys(subPoints)
    const lastSubKey = subKeys.length > 0 ? subKeys[subKeys.length - 1] : ""
    
    // Extract the number after the dot (e.g., "4.i" -> "i", "4.ii" -> "ii")
    let nextSubNumber = "i"
    if (lastSubKey.includes(".")) {
      const lastNum = lastSubKey.split(".")[1]
      if (lastNum === "i") nextSubNumber = "ii"
      else if (lastNum === "ii") nextSubNumber = "iii"
      else if (lastNum === "iii") nextSubNumber = "iv"
      else if (lastNum === "iv") nextSubNumber = "v"
      else {
        // If it's a number, increment it
        const num = parseInt(lastNum)
        if (!isNaN(num)) nextSubNumber = (num + 1).toString()
      }
    }

    const newSubKey = `${parentKey}.${nextSubNumber}`
    setEditingCriteria({
      ...editingCriteria,
      [parentKey]: {
        ...parent,
        subPoints: {
          ...subPoints,
          [newSubKey]: {
            title: "",
            value: "",
            requirement: "",
            description: "",
          },
        },
      },
    })
    setIsEditing(true)
  }

  const updateSubPoint = (parentKey: string, subKey: string, field: "title" | "value" | "requirement" | "description", value: string) => {
    const parent = editingCriteria[parentKey]
    if (!parent) return

    const existingSubPoints = parent.subPoints || {}
    const existingSubPoint = existingSubPoints[subKey] || { title: "", value: "", requirement: "", description: "" }

    setEditingCriteria({
      ...editingCriteria,
      [parentKey]: {
        ...parent,
        subPoints: {
          ...existingSubPoints,
          [subKey]: {
            ...existingSubPoint,
            [field]: value,
          },
        },
      },
    })
    setIsEditing(true)
  }

  const removeSubPoint = (parentKey: string, subKey: string) => {
    const parent = editingCriteria[parentKey]
    if (!parent) return

    const newSubPoints = { ...(parent.subPoints || {}) }
    delete newSubPoints[subKey]

    setEditingCriteria({
      ...editingCriteria,
      [parentKey]: {
        ...parent,
        subPoints: Object.keys(newSubPoints).length > 0 ? newSubPoints : undefined,
      },
    })
    setIsEditing(true)
  }

  const moveCriteriaUp = (key: string) => {
    const keys = Object.keys(editingCriteria).sort((a, b) => {
      const numA = parseInt(a) || 0
      const numB = parseInt(b) || 0
      return numA - numB
    })
    
    const currentIndex = keys.indexOf(key)
    if (currentIndex <= 0) return // Already at top or not found

    // Create array of criteria in order
    const criteriaArray = keys.map(k => editingCriteria[k])
    
    // Swap items
    const temp = criteriaArray[currentIndex]
    criteriaArray[currentIndex] = criteriaArray[currentIndex - 1]
    criteriaArray[currentIndex - 1] = temp

    // Renumber sequentially
    const renumbered: typeof editingCriteria = {}
    criteriaArray.forEach((criteria, index) => {
      renumbered[(index + 1).toString()] = criteria
    })

    setEditingCriteria(renumbered)
    setIsEditing(true)
  }

  const moveCriteriaDown = (key: string) => {
    const keys = Object.keys(editingCriteria).sort((a, b) => {
      const numA = parseInt(a) || 0
      const numB = parseInt(b) || 0
      return numA - numB
    })
    
    const currentIndex = keys.indexOf(key)
    if (currentIndex < 0 || currentIndex >= keys.length - 1) return // Already at bottom or not found

    // Create array of criteria in order
    const criteriaArray = keys.map(k => editingCriteria[k])
    
    // Swap items
    const temp = criteriaArray[currentIndex]
    criteriaArray[currentIndex] = criteriaArray[currentIndex + 1]
    criteriaArray[currentIndex + 1] = temp

    // Renumber sequentially
    const renumbered: typeof editingCriteria = {}
    criteriaArray.forEach((criteria, index) => {
      renumbered[(index + 1).toString()] = criteria
    })

    setEditingCriteria(renumbered)
    setIsEditing(true)
  }

  const moveSubPointUp = (parentKey: string, subKey: string) => {
    const parent = editingCriteria[parentKey]
    if (!parent || !parent.subPoints) return

    const subPoints = parent.subPoints
    const subKeys = Object.keys(subPoints).sort((a, b) => {
      const order = ["i", "ii", "iii", "iv", "v"]
      const aNum = a.split(".")[1] || ""
      const bNum = b.split(".")[1] || ""
      const aIndex = order.indexOf(aNum)
      const bIndex = order.indexOf(bNum)
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      
      const aInt = parseInt(aNum) || 0
      const bInt = parseInt(bNum) || 0
      return aInt - bInt
    })

    const currentIndex = subKeys.indexOf(subKey)
    if (currentIndex <= 0) return

    // Create array of sub-points in order
    const subPointsArray = subKeys.map(k => subPoints[k])
    
    // Swap items
    const temp = subPointsArray[currentIndex]
    subPointsArray[currentIndex] = subPointsArray[currentIndex - 1]
    subPointsArray[currentIndex - 1] = temp

    // Renumber sub-points sequentially
    const renumbered: Record<string, { title: string; value: string; description?: string }> = {}
    const order = ["i", "ii", "iii", "iv", "v"]
    subPointsArray.forEach((subPoint, index) => {
      let newSubKeyNum: string
      if (index < order.length) {
        newSubKeyNum = order[index]
      } else {
        newSubKeyNum = (index + 1).toString()
      }
      const newSubKey = `${parentKey}.${newSubKeyNum}`
      renumbered[newSubKey] = subPoint
    })

    setEditingCriteria({
      ...editingCriteria,
      [parentKey]: {
        ...parent,
        subPoints: renumbered,
      },
    })
    setIsEditing(true)
  }

  const moveSubPointDown = (parentKey: string, subKey: string) => {
    const parent = editingCriteria[parentKey]
    if (!parent || !parent.subPoints) return

    const subPoints = parent.subPoints
    const subKeys = Object.keys(subPoints).sort((a, b) => {
      const order = ["i", "ii", "iii", "iv", "v"]
      const aNum = a.split(".")[1] || ""
      const bNum = b.split(".")[1] || ""
      const aIndex = order.indexOf(aNum)
      const bIndex = order.indexOf(bNum)
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      
      const aInt = parseInt(aNum) || 0
      const bInt = parseInt(bNum) || 0
      return aInt - bInt
    })

    const currentIndex = subKeys.indexOf(subKey)
    if (currentIndex < 0 || currentIndex >= subKeys.length - 1) return

    // Create array of sub-points in order
    const subPointsArray = subKeys.map(k => subPoints[k])
    
    // Swap items
    const temp = subPointsArray[currentIndex]
    subPointsArray[currentIndex] = subPointsArray[currentIndex + 1]
    subPointsArray[currentIndex + 1] = temp

    // Renumber sub-points sequentially
    const renumbered: Record<string, { title: string; value: string; description?: string }> = {}
    const order = ["i", "ii", "iii", "iv", "v"]
    subPointsArray.forEach((subPoint, index) => {
      let newSubKeyNum: string
      if (index < order.length) {
        newSubKeyNum = order[index]
      } else {
        newSubKeyNum = (index + 1).toString()
      }
      const newSubKey = `${parentKey}.${newSubKeyNum}`
      renumbered[newSubKey] = subPoint
    })

    setEditingCriteria({
      ...editingCriteria,
      [parentKey]: {
        ...parent,
        subPoints: renumbered,
      },
    })
    setIsEditing(true)
  }

  const handleBidFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "pdf" | "csv") => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (type === "pdf" && file.type !== "application/pdf") {
        setUploadError("Please select a PDF file")
        return
      }
      if (type === "csv" && !file.name.endsWith('.csv')) {
        setUploadError("Please select a CSV file")
        return
      }
      
      if (type === "pdf") {
        setBidPdfFile(file)
        // Auto-fill name from filename if name is empty
        if (!bidName && file.name) {
          setBidName(file.name.replace(/\.pdf$/i, ""))
        }
      } else {
        setBidCsvFile(file)
      }
      setUploadError(null)
    }
  }

  const handleBidUpload = async () => {
    if (!bidPdfFile || !bidCsvFile || !bidName.trim()) {
      setUploadError("Please provide PDF file, CSV file, and bid name")
      return
    }

    setUploadingBid(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append("pdf_file", bidPdfFile)
      if (bidCsvFile) {
        formData.append("csv_file", bidCsvFile)
      }
      formData.append("bid_name", bidName.trim())
      if (tenderId) {
        formData.append("tender_id", tenderId)
      }

      const response = await fetch(`${API_BASE_URL}/bids/upload`, {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        console.log("✅ Bid uploaded successfully:", data)
        
        // Update tender's bid_ids
        const currentBidIds = JSON.parse(tender?.bid_ids || "[]")
        const updatedBidIds = [...currentBidIds, data.bid_id]
        
        // Update tender with new bid_id
        const updateResponse = await fetch(`${API_BASE_URL}/tenders/${tenderId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bid_ids: JSON.stringify(updatedBidIds),
          }),
        })

        if (updateResponse.ok) {
          // Refresh tender data
          await fetchTender()
          
          // Reset form
          setBidName("")
          setBidPdfFile(null)
          setBidCsvFile(null)
          setIsUploadDialogOpen(false)
          setUploadError(null)
        } else {
          const errorText = await updateResponse.text()
          setUploadError(`Bid uploaded but failed to link to tender: ${errorText}`)
        }
      } else {
        const errorText = await response.text()
        setUploadError(errorText || "Failed to upload bid")
      }
    } catch (err) {
      console.error("❌ Error uploading bid:", err)
      setUploadError("An error occurred while uploading the bid")
    } finally {
      setUploadingBid(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-3 text-muted-foreground">Loading tender...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !tender) {
    return (
      <AppLayout>
        <div className="p-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-red-600">{error || "Tender not found"}</p>
              <Button onClick={fetchTender} className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Data asset</p>
            <h1 className="text-3xl font-bold">{tender.name}</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="link"
                onClick={() => handleViewPdf(tender.pdf_path)}
                className="p-0 h-auto text-primary hover:underline"
              >
                View tender notice
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditNameDialogOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button>
              <RefreshCw className="mr-2 h-4 w-4" />
              Restart Analysis
            </Button>
            <Button variant="outline">
              <MessageSquare className="mr-2 h-4 w-4" />
              Add Comments
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="evaluation">Evaluation Criteria</TabsTrigger>
            <TabsTrigger value="bids">Bids</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-6">
            <div className="space-y-6">
              {/* Tender Summary - Above PDF */}
              <Card>
                <CardContent className="p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold">Tender Summary</h2>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("evaluation")}
                      className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Go to Evaluation Criteria
                    </Button>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Project Information */}
                    <div>
                      <h3 className="mb-3 text-lg font-semibold text-slate-900">Project</h3>
                      <p className="text-slate-700 font-medium">Kukadi Irrigation Project – Special Repairs to Left Bank Canal (Km 1–60)</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-600">
                        <p><span className="font-medium">District:</span> Pune / Ahilyanagar</p>
                        <p><span className="font-medium">Department:</span> Water Resources Department (WRD), Maharashtra</p>
                      </div>
                    </div>

                    {/* Tender Value */}
                    <div className="border-t pt-4">
                      <h3 className="mb-3 text-lg font-semibold text-slate-900">Tender Value</h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-slate-600 mb-1">Cost Put to Tender</p>
                        <p className="text-2xl font-bold text-blue-900">₹ 8,283.00 Lakhs</p>
                      </div>
                    </div>

                    {/* Bids Received - Integrated into Summary */}
                    {hasBids && (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-700 mb-1">Bids Received</p>
                            <p className="text-3xl font-bold text-green-900">{bidIds.length}</p>
                            <p className="text-xs text-green-600 mt-1">
                              {bidIds.length === 1 ? "bid" : "bids"} submitted for evaluation
                            </p>
                          </div>
                          <div className="bg-green-100 rounded-full p-3">
                            <FileText className="h-8 w-8 text-green-700" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Financial Requirements */}
                    <div className="border-t pt-4">
                      <h3 className="mb-3 text-lg font-semibold text-slate-900">Key Financial Requirements</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="border border-slate-200 px-4 py-2 text-left text-sm font-semibold text-slate-700">Component</th>
                              <th className="border border-slate-200 px-4 py-2 text-left text-sm font-semibold text-slate-700">Amount / %</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-700">Tender Fee</td>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-900 font-medium">₹5,900 (incl. GST)</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-700">EMD</td>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-900 font-medium">₹41.42 Lakhs</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-700">Security Deposit (SD)</td>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-900 font-medium">2% of tender cost = ₹165.66 Lakhs (1% upfront + 1% via RA bills)</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-700">APSD (Additional Performance Security Deposit)</td>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-900 font-medium">Required when bidder quotes &gt;1% below tender cost (slab system)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Contract Duration */}
                    <div className="border-t pt-4">
                      <h3 className="mb-3 text-lg font-semibold text-slate-900">Contract Duration</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <p className="text-sm text-slate-600 mb-1">Project Duration</p>
                          <p className="text-lg font-semibold text-slate-900">24 Months</p>
                          <p className="text-xs text-slate-500 mt-1">(including monsoon)</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <p className="text-sm text-slate-600 mb-1">Defect Liability Period (DLP)</p>
                          <p className="text-lg font-semibold text-slate-900">60 Months</p>
                        </div>
                      </div>
                    </div>

                    {/* APSD Information */}
                    <div className="border-t pt-4">
                      <h3 className="mb-3 text-lg font-semibold text-slate-900">APSD (Additional Performance Security Deposit)</h3>
                      <p className="text-sm text-slate-600 mb-3">Applies <strong>only if bid quote is &gt;1% below the tender cost</strong>.</p>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="border border-slate-200 px-4 py-2 text-left text-sm font-semibold text-slate-700">Bid Below CPR</th>
                              <th className="border border-slate-200 px-4 py-2 text-left text-sm font-semibold text-slate-700">APSD Required</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-700">1–10%</td>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-900 font-medium">1% of Tender Cost</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-700">10–15%</td>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-900 font-medium">1% + (Offer% – 10%)</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-700">&gt;15%</td>
                              <td className="border border-slate-200 px-4 py-2 text-sm text-slate-900 font-medium">6% + 2 × (Offer% – 15%)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-slate-500 mt-3">
                        <strong>Refund Policy:</strong> 50% refunded after work completion, 50% refunded after DLP completion
                      </p>
                    </div>

                    {/* Important Notes */}
                    <div className="border-t pt-4">
                      <h3 className="mb-3 text-lg font-semibold text-slate-900">Important Notes</h3>
                      <ul className="space-y-2 text-sm text-slate-700">
                        <li className="flex items-start gap-2">
                          <span className="text-red-600 mt-1">•</span>
                          <span>False documents → <strong>Blacklisting for 2 years</strong>, EMD/SD/APSD forfeiture</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>JV Allowed for tenders &gt; ₹ 25 Crores (this tender qualifies)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-1">•</span>
                          <span>JV evaluated proportionately for turnover &amp; bid capacity</span>
                        </li>
                      </ul>
                    </div>

                    {/* Executive Summary */}
                    <div className="border-t pt-4">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="mb-2 text-lg font-semibold text-slate-900">Executive Summary</h3>
                        <p className="text-sm leading-relaxed text-slate-700">
                          The tender for <strong>Special Repairs to Kukadi Left Bank Canal (Km 1–60)</strong> is valued at <strong>₹ 8283 Lakhs</strong>, with a completion period of <strong>24 months</strong> and a DLP of <strong>60 months</strong>. Bidders are evaluated through stringent <strong>financial, experience, capacity, machinery, and manpower thresholds</strong>, including minimum turnover of <strong>₹ 3106.13 Lakhs</strong>, bid capacity of <strong>₹ 8283 Lakhs</strong>, and certified execution quantities of lining, steel, and earthwork. A self-evaluation process ensures transparency and document-based qualification.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tender PDF Viewer */}
              <Card>
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Tender Document</h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPdf(tender.pdf_path)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Open in Full Screen
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden" style={{ height: "600px" }}>
                    {tender.pdf_path && (
                      <iframe
                        src={(() => {
                          let fullUrl = tender.pdf_path
                          if (!fullUrl.startsWith('http')) {
                            if (fullUrl.startsWith('/')) {
                              fullUrl = `${API_BASE_URL}${fullUrl}`
                            } else {
                              fullUrl = `${API_BASE_URL}/${fullUrl}`
                            }
                          }
                          return fullUrl
                        })()}
                        className="w-full h-full border-0"
                        title="Tender PDF Viewer"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="evaluation" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Evaluation Criteria</h2>
                  <div className="flex gap-2">
                    {viewMode === "table" ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setViewMode("edit")
                          setIsEditing(false)
                        }}
                        size="sm"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setViewMode("table")
                            setIsEditing(false)
                            // Reset to saved criteria
                            if (tender) {
                              const savedCriteria = JSON.parse(tender.evaluation_criteria_json || "{}")
                              setEditingCriteria(savedCriteria)
                            }
                          }}
                          size="sm"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          variant="outline"
                          onClick={addMainPoint}
                          size="sm"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Criteria
                        </Button>
                        {isEditing && (
                          <Button
                            onClick={handleSaveCriteria}
                            disabled={saving}
                            size="sm"
                          >
                            {saving ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                Save
                              </>
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {Object.keys(editingCriteria).length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">No evaluation criteria set yet.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {viewMode === "table" ? (
                        <>Click "Edit" to start adding evaluation criteria.</>
                      ) : (
                        <>Click "Add Criteria" to start adding evaluation criteria.</>
                      )}
                    </p>
                  </div>
                ) : viewMode === "table" ? (
                  // Table View
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Sr. No</TableHead>
                          <TableHead>Criteria</TableHead>
                          <TableHead className="w-32">Unit</TableHead>
                          <TableHead className="w-32">Requirement</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(editingCriteria)
                          .sort(([a], [b]) => {
                            const numA = parseInt(a) || 0
                            const numB = parseInt(b) || 0
                            return numA - numB
                          })
                          .flatMap(([key, point]) => {
                            const rows = [
                              <TableRow key={key}>
                                <TableCell className="font-medium">{key}</TableCell>
                                <TableCell className="font-medium">{point.title || "-"}</TableCell>
                                <TableCell>{point.value || "-"}</TableCell>
                                <TableCell className="font-medium">{point.requirement || "-"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {point.description || "-"}
                                </TableCell>
                              </TableRow>
                            ]

                            // Add sub-points if they exist
                            if (point.subPoints && Object.keys(point.subPoints).length > 0) {
                              const subPointRows = Object.entries(point.subPoints)
                                .sort(([a], [b]) => {
                                  const order = ["i", "ii", "iii", "iv", "v"]
                                  const aNum = a.split(".")[1]
                                  const bNum = b.split(".")[1]
                                  const aIndex = order.indexOf(aNum)
                                  const bIndex = order.indexOf(bNum)
                                  
                                  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
                                  if (aIndex !== -1) return -1
                                  if (bIndex !== -1) return 1
                                  
                                  const aInt = parseInt(aNum) || 0
                                  const bInt = parseInt(bNum) || 0
                                  return aInt - bInt
                                })
                                .map(([subKey, subPoint]) => (
                                  <TableRow key={subKey} className="bg-muted/50">
                                    <TableCell className="pl-8 font-medium text-muted-foreground">
                                      {subKey}
                                    </TableCell>
                                    <TableCell className="pl-4">{subPoint.title || "-"}</TableCell>
                                    <TableCell>{subPoint.value || "-"}</TableCell>
                                    <TableCell className="font-medium">{subPoint.requirement || "-"}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {subPoint.description || "-"}
                                    </TableCell>
                                  </TableRow>
                                ))
                              rows.push(...subPointRows)
                            }

                            return rows
                          })}
                      </TableBody>
                    </Table>
                    {/* Approve and Go to Bids Button */}
                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={() => setActiveTab("bids")}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve and Go to Bids
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Edit View
                  <div className="space-y-4">
                    {Object.entries(editingCriteria)
                      .sort(([a], [b]) => {
                        const numA = parseInt(a) || 0
                        const numB = parseInt(b) || 0
                        return numA - numB
                      })
                      .map(([key, point]) => (
                        <div key={key} className="rounded-lg border p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveCriteriaUp(key)}
                                      disabled={Object.keys(editingCriteria).sort((a, b) => {
                                        const numA = parseInt(a) || 0
                                        const numB = parseInt(b) || 0
                                        return numA - numB
                                      }).indexOf(key) === 0}
                                      className="h-6 w-6"
                                      title="Move up"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveCriteriaDown(key)}
                                      disabled={Object.keys(editingCriteria).sort((a, b) => {
                                        const numA = parseInt(a) || 0
                                        const numB = parseInt(b) || 0
                                        return numA - numB
                                      }).indexOf(key) === Object.keys(editingCriteria).length - 1}
                                      className="h-6 w-6"
                                      title="Move down"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <span className="font-medium text-sm text-muted-foreground min-w-[3rem]">
                                    {key}.
                                  </span>
                                  <Input
                                    placeholder="Criteria title"
                                    value={point.title || ""}
                                    onChange={(e) => updateMainPoint(key, "title", e.target.value)}
                                    className="flex-1"
                                  />
                                  <Input
                                    placeholder="Unit"
                                    value={point.value || ""}
                                    onChange={(e) => updateMainPoint(key, "value", e.target.value)}
                                    className="w-32"
                                  />
                                  <Input
                                    placeholder="Requirement"
                                    value={point.requirement || ""}
                                    onChange={(e) => updateMainPoint(key, "requirement", e.target.value)}
                                    className="w-32"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeMainPoint(key)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="ml-12">
                                  <Textarea
                                    placeholder="Description (optional)"
                                    value={point.description || ""}
                                    onChange={(e) => updateMainPoint(key, "description", e.target.value)}
                                    className="w-full min-h-[60px]"
                                    rows={2}
                                  />
                                </div>
                              </div>

                              {/* Sub-points */}
                              {point.subPoints && Object.keys(point.subPoints).length > 0 && (
                                <div className="ml-12 mt-3 space-y-2 border-l-2 pl-4">
                                  {Object.entries(point.subPoints)
                                    .sort(([a], [b]) => {
                                      // Sort sub-points: i, ii, iii, iv, v, then numbers
                                      const order = ["i", "ii", "iii", "iv", "v"]
                                      const aNum = a.split(".")[1]
                                      const bNum = b.split(".")[1]
                                      const aIndex = order.indexOf(aNum)
                                      const bIndex = order.indexOf(bNum)
                                      
                                      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
                                      if (aIndex !== -1) return -1
                                      if (bIndex !== -1) return 1
                                      
                                      const aInt = parseInt(aNum) || 0
                                      const bInt = parseInt(bNum) || 0
                                      return aInt - bInt
                                    })
                                    .map(([subKey, subPoint], subIndex, subArray) => (
                                      <div key={subKey} className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <div className="flex flex-col gap-1">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => moveSubPointUp(key, subKey)}
                                              disabled={subIndex === 0}
                                              className="h-6 w-6"
                                              title="Move up"
                                            >
                                              <ChevronUp className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => moveSubPointDown(key, subKey)}
                                              disabled={subIndex === subArray.length - 1}
                                              className="h-6 w-6"
                                              title="Move down"
                                            >
                                              <ChevronDown className="h-3 w-3" />
                                            </Button>
                                          </div>
                                          <span className="font-medium text-sm text-muted-foreground min-w-[3rem]">
                                            {subKey}
                                          </span>
                                          <Input
                                            placeholder="Sub-criteria title"
                                            value={subPoint.title || ""}
                                            onChange={(e) => updateSubPoint(key, subKey, "title", e.target.value)}
                                            className="flex-1"
                                          />
                                          <Input
                                            placeholder="Unit"
                                            value={subPoint.value || ""}
                                            onChange={(e) => updateSubPoint(key, subKey, "value", e.target.value)}
                                            className="w-32"
                                          />
                                          <Input
                                            placeholder="Requirement"
                                            value={subPoint.requirement || ""}
                                            onChange={(e) => updateSubPoint(key, subKey, "requirement", e.target.value)}
                                            className="w-32"
                                          />
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeSubPoint(key, subKey)}
                                            className="text-destructive hover:text-destructive"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <div className="ml-12">
                                          <Textarea
                                            placeholder="Description (optional)"
                                            value={subPoint.description || ""}
                                            onChange={(e) => updateSubPoint(key, subKey, "description", e.target.value)}
                                            className="w-full min-h-[60px]"
                                            rows={2}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}

                              {/* Add sub-point button */}
                              <div className="ml-12">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => addSubPoint(key)}
                                  className="text-muted-foreground"
                                >
                                  <Plus className="mr-2 h-3 w-3" />
                                  Add sub-point
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bids" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">List of Bids for this tender</h2>
                  <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Bid
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload New Bid</DialogTitle>
                        <DialogDescription>
                          Upload a PDF file (stored as-is) and CSV file (processed and stored in bid_data). The bid will be linked to this tender.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label htmlFor="bid-name" className="text-sm font-medium">
                            Bid Name
                          </label>
                          <Input
                            id="bid-name"
                            placeholder="Enter bid name"
                            value={bidName}
                            onChange={(e) => setBidName(e.target.value)}
                            disabled={uploadingBid}
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="bid-pdf" className="text-sm font-medium">
                            PDF File <span className="text-red-500">*</span>
                          </label>
                          <Input
                            id="bid-pdf"
                            type="file"
                            accept=".pdf"
                            onChange={(e) => handleBidFileChange(e, "pdf")}
                            disabled={uploadingBid}
                          />
                          {bidPdfFile && (
                            <p className="text-sm text-muted-foreground">
                              Selected: {bidPdfFile.name}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="bid-csv" className="text-sm font-medium">
                            CSV File <span className="text-red-500">*</span>
                          </label>
                          <Input
                            id="bid-csv"
                            type="file"
                            accept=".csv"
                            onChange={(e) => handleBidFileChange(e, "csv")}
                            disabled={uploadingBid}
                          />
                          {bidCsvFile && (
                            <p className="text-sm text-muted-foreground">
                              Selected: {bidCsvFile.name}
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
                            setBidName("")
                            setBidPdfFile(null)
                            setBidCsvFile(null)
                            setUploadError(null)
                          }}
                          disabled={uploadingBid}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleBidUpload} 
                          disabled={uploadingBid || !bidPdfFile || !bidCsvFile || !bidName.trim()}
                        >
                          {uploadingBid ? (
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
                {!hasBids ? (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">No bids uploaded yet.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Bids will be displayed here once they are added to this tender.
                    </p>
                  </div>
                ) : loadingBids ? (
                  <div className="py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading bids...</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sr. No</TableHead>
                        <TableHead>
                          <div className="flex items-center gap-2">
                            Bid Name <ArrowDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bids.map((bid, index) => (
                        <TableRow key={bid.bid_id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{bid.bid_name || bid.bid_id}</div>
                              <div className="text-sm text-muted-foreground">{bid.bid_id.slice(0, 8)}...</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Link href={`/bids/${bid.bid_id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                >
                                  <PlayCircle className="mr-2 h-4 w-4" />
                                  Start Evaluation
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewBid(bid)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Data
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewPdf(bid.pdf_path)}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                View PDF
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Tender Name Dialog */}
        <Dialog open={isEditNameDialogOpen} onOpenChange={setIsEditNameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tender Name</DialogTitle>
              <DialogDescription>
                Update the name of this tender.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="tender-name" className="text-sm font-medium">
                  Tender Name
                </label>
                <Input
                  id="tender-name"
                  value={editingTenderName}
                  onChange={(e) => setEditingTenderName(e.target.value)}
                  placeholder="Enter tender name"
                />
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditNameDialogOpen(false)
                  setEditingTenderName(tender?.name || "")
                  setError(null)
                }}
                disabled={savingName}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveTenderName} 
                disabled={savingName || !editingTenderName.trim()}
              >
                {savingName ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bid Data View Dialog */}
        <Dialog open={isBidViewDialogOpen} onOpenChange={setIsBidViewDialogOpen}>
          <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedBid?.bid_name || "Bid Data"}
              </DialogTitle>
              <DialogDescription>
                Bid ID: {selectedBid?.bid_id}
              </DialogDescription>
            </DialogHeader>
            
            {loadingBidData ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-3 text-muted-foreground">Loading bid data...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-8">
                  {bidData.map((page: any, pageIndex: number) => (
                    <div key={page.page_no} className="border rounded-lg overflow-hidden">
                      <div className="bg-muted px-4 py-2 border-b">
                        <h3 className="font-semibold">Page {page.page_no}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-0">
                        {/* Left: HTML Content */}
                        <div className="border-r p-4 bg-muted/30">
                          <div className="flex items-center gap-2 mb-3 sticky top-0 bg-muted/30 pb-2 border-b">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-semibold text-sm">Content</h4>
                          </div>
                          <div className="space-y-4">
                            {page.chunks.map((chunk: any, chunkIndex: number) => (
                              <div
                                key={chunk.id}
                                className="prose prose-sm max-w-none [&_p]:text-sm [&_p]:leading-relaxed [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_table]:text-xs [&_img]:max-w-full [&_img]:rounded [&_table]:border [&_td]:border [&_th]:border [&_td]:p-2 [&_th]:p-2"
                                dangerouslySetInnerHTML={{ __html: chunk.content || "" }}
                              />
                            ))}
                          </div>
                        </div>
                        
                        {/* Right: Semantic Meaning */}
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background pb-2 border-b">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-semibold text-sm">Semantic Meaning</h4>
                          </div>
                          <div className="space-y-4">
                            {page.chunks.map((chunk: any, chunkIndex: number) => (
                              <Card key={chunk.id} className="border-border">
                                <CardContent className="p-4">
                                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                    {chunk.semantic_meaning || "No semantic meaning available"}
                                  </p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {bidData.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No data available for this bid</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* PDF Viewer Dialog */}
        <Dialog open={viewingPdf} onOpenChange={setViewingPdf}>
          <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
              <DialogTitle>PDF Viewer</DialogTitle>
              <DialogDescription>
                {selectedBid?.bid_name || tender?.name || "Document"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {pdfUrl && (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border-0"
                  title="PDF Viewer"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

