"use client"

import { useState, useMemo } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
} from "@/components/ui/dialog"
import {
  Search,
  Plus,
  ArrowDown,
  CheckCircle2,
  Edit,
  Trash2,
  Check,
} from "lucide-react"

interface Task {
  id: number
  title: string
  subtitle: string
  dueDate: string
  status: "Pending" | "Completed"
  priority: "High Priority" | null
  statusColor: string
  priorityColor: string | null
  completed: boolean
}

type FilterType = "View all" | "In Progress" | "Overdue" | "Scheduled" | "Complete"

export default function TasksPage() {
  // Initial demo data
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      title: "AI Evaluation: T943857 E-tender for Ashadhi Wari Niyogen",
      subtitle: "Uploaded all bids",
      dueDate: "16 Jun 2025",
      status: "Pending",
      priority: "High Priority",
      statusColor: "bg-yellow-100 text-yellow-800",
      priorityColor: "bg-red-100 text-red-800",
      completed: false,
    },
    {
      id: 2,
      title: "Submit T034781 Kukadi Irrigation Tender",
      subtitle: "All bids evaluated",
      dueDate: "11 Jun 2025",
      status: "Completed",
      priority: "High Priority",
      statusColor: "bg-green-100 text-green-800",
      priorityColor: "bg-red-100 text-red-800",
      completed: true,
    },
    {
      id: 3,
      title: "Submit B130082 Afcons Infrastructure Bid",
      subtitle: "AI Evaluation Complete",
      dueDate: "4 Jun 2025",
      status: "Completed",
      priority: null,
      statusColor: "bg-green-100 text-green-800",
      priorityColor: null,
      completed: true,
    },
    {
      id: 4,
      title: "Upload commercial docs for 2025 PRASADHI",
      subtitle: "To upload remaining documents",
      dueDate: "15 May 2025",
      status: "Pending",
      priority: null,
      statusColor: "bg-yellow-100 text-yellow-800",
      priorityColor: null,
      completed: false,
    },
  ])

  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterType>("View all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set())

  // Form state for add/edit
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    dueDate: "",
    priority: "" as "High Priority" | "",
  })

  // Helper function to parse date
  const parseDate = (dateStr: string): Date => {
    const [day, month, year] = dateStr.split(" ")
    const monthMap: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    }
    return new Date(parseInt(year), monthMap[month] || 0, parseInt(day))
  }

  // Helper function to format date
  const formatDate = (date: Date): string => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
  }

  // Check if task is overdue
  const isOverdue = (task: Task): boolean => {
    if (task.completed) return false
    const dueDate = parseDate(task.dueDate)
    return dueDate < new Date()
  }

  // Check if task is due this week
  const isDueThisWeek = (task: Task): boolean => {
    if (task.completed) return false
    const dueDate = parseDate(task.dueDate)
    const today = new Date()
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    return dueDate >= today && dueDate <= weekFromNow
  }

  // Filter and search tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks

    // Apply status filter
    if (activeFilter === "Complete") {
      filtered = filtered.filter(t => t.completed)
    } else if (activeFilter === "In Progress") {
      filtered = filtered.filter(t => !t.completed && t.status === "Pending")
    } else if (activeFilter === "Overdue") {
      filtered = filtered.filter(t => isOverdue(t))
    } else if (activeFilter === "Scheduled") {
      filtered = filtered.filter(t => !t.completed && !isOverdue(t))
    }
    // "View all" shows all tasks

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.subtitle.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [tasks, activeFilter, searchQuery])

  // Calculate statistics
  const stats = useMemo(() => {
    const completed = tasks.filter(t => t.completed).length
    const overdue = tasks.filter(t => isOverdue(t)).length
    const dueThisWeek = tasks.filter(t => isDueThisWeek(t)).length
    const highPriority = tasks.filter(t => t.priority === "High Priority" && !t.completed).length

    return {
      completed,
      total: tasks.length,
      overdue,
      dueThisWeek,
      highPriority,
    }
  }, [tasks])

  // Add new task
  const handleAddTask = () => {
    if (!formData.title.trim() || !formData.dueDate) return

    const newTask: Task = {
      id: Math.max(...tasks.map(t => t.id), 0) + 1,
      title: formData.title,
      subtitle: formData.subtitle,
      dueDate: formatDate(new Date(formData.dueDate)),
      status: "Pending",
      priority: formData.priority === "High Priority" ? "High Priority" : null,
      statusColor: "bg-yellow-100 text-yellow-800",
      priorityColor: formData.priority === "High Priority" ? "bg-red-100 text-red-800" : null,
      completed: false,
    }

    setTasks([...tasks, newTask])
    setFormData({ title: "", subtitle: "", dueDate: "", priority: "" })
    setIsAddDialogOpen(false)
  }

  // Edit task
  const handleEditTask = () => {
    if (!editingTask || !formData.title.trim() || !formData.dueDate) return

    const updatedTasks = tasks.map(t =>
      t.id === editingTask.id
        ? {
            ...t,
            title: formData.title,
            subtitle: formData.subtitle,
            dueDate: formatDate(new Date(formData.dueDate)),
            priority: formData.priority === "High Priority" ? "High Priority" : null,
            priorityColor: formData.priority === "High Priority" ? "bg-red-100 text-red-800" : null,
          }
        : t
    )

    setTasks(updatedTasks)
    setIsEditDialogOpen(false)
    setEditingTask(null)
    setFormData({ title: "", subtitle: "", dueDate: "", priority: "" })
  }

  // Delete task
  const handleDeleteTask = (id: number) => {
    if (confirm("Are you sure you want to delete this task?")) {
      setTasks(tasks.filter(t => t.id !== id))
      setSelectedTaskIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  // Toggle task completion
  const handleToggleComplete = (id: number) => {
    setTasks(tasks.map(t =>
      t.id === id
        ? {
            ...t,
            completed: !t.completed,
            status: t.completed ? "Pending" : "Completed",
            statusColor: t.completed ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800",
          }
        : t
    ))
  }

  // Mark selected tasks as complete
  const handleMarkSelectedComplete = () => {
    if (selectedTaskIds.size === 0) return
    setTasks(tasks.map(t =>
      selectedTaskIds.has(t.id) && !t.completed
        ? {
            ...t,
            completed: true,
            status: "Completed",
            statusColor: "bg-green-100 text-green-800",
          }
        : t
    ))
    setSelectedTaskIds(new Set())
  }

  // Toggle task selection
  const handleToggleSelection = (id: number) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Open edit dialog
  const openEditDialog = (task: Task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      subtitle: task.subtitle,
      dueDate: parseDate(task.dueDate).toISOString().split("T")[0],
      priority: task.priority || "",
    })
    setIsEditDialogOpen(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({ title: "", subtitle: "", dueDate: "", priority: "" })
    setEditingTask(null)
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">COMPLETED TASKS</p>
              <p className="text-2xl font-bold">{stats.completed} / {stats.total} completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">OVERDUE</p>
              <p className="text-2xl font-bold">{stats.overdue} tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">DUE THIS WEEK</p>
              <p className="text-2xl font-bold">{stats.dueThisWeek} tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">HIGH PRIORITY</p>
              <p className="text-2xl font-bold">{stats.highPriority} tasks</p>
            </CardContent>
          </Card>
        </div>

        {/* Task List */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Task list</h2>
              <Badge variant="secondary" className="mt-1">
                {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
              </Badge>
              <p className="mt-2 text-sm text-muted-foreground">
                Keep the track of tasks to never miss out on updates
              </p>
            </div>
            <Button onClick={() => {
              resetForm()
              setIsAddDialogOpen(true)
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>

          {/* Filter Tabs */}
          <div className="mb-4 flex gap-2">
            {(["View all", "In Progress", "Overdue", "Scheduled", "Complete"] as FilterType[]).map((tab) => (
              <Button
                key={tab}
                variant={activeFilter === tab ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(tab)}
              >
                {tab}
              </Button>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="mb-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search tasks..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery && (
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                Clear
            </Button>
            )}
          </div>

          {/* Tasks Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <CheckCircle2 className="h-4 w-4" />
                    </TableHead>
                    <TableHead className="flex items-center gap-2">
                      Tasks <ArrowDown className="h-4 w-4" />
                    </TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <p className="text-sm text-muted-foreground">
                          {searchQuery ? "No tasks found matching your search." : "No tasks found."}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                            checked={task.completed || selectedTaskIds.has(task.id)}
                            onChange={() => {
                              if (!task.completed) {
                                handleToggleSelection(task.id)
                              } else {
                                handleToggleComplete(task.id)
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                            <p className={`font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </p>
                          <p className="text-sm text-muted-foreground">{task.subtitle}</p>
                        </div>
                      </TableCell>
                        <TableCell>
                          <span className={isOverdue(task) && !task.completed ? "text-red-600 font-medium" : ""}>
                            {task.dueDate}
                          </span>
                        </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Badge className={task.statusColor}>{task.status}</Badge>
                          {task.priority && (
                              <Badge className={task.priorityColor || ""}>{task.priority}</Badge>
                            )}
                            {isOverdue(task) && !task.completed && (
                              <Badge className="bg-red-100 text-red-800">Overdue</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteTask(task.id)}
                              title="Delete task"
                            >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openEditDialog(task)}
                              title="Edit task"
                            >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!task.completed && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleToggleComplete(task.id)}
                                title="Mark as complete"
                              >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Bottom Actions */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredTasks.length} of {tasks.length} tasks
            </p>
            <div className="flex gap-2">
              {selectedTaskIds.size > 0 && (
                <Button 
                  variant="outline"
                  onClick={handleMarkSelectedComplete}
                >
                <Check className="mr-2 h-4 w-4" />
                  Mark {selectedTaskIds.size} Complete
              </Button>
              )}
            </div>
          </div>
        </div>

        {/* Add Task Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Task</DialogTitle>
              <DialogDescription>
                Create a new task to track your work.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Title *
                </label>
                <Input
                  id="title"
                  placeholder="e.g., AI Evaluation: T943857"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="subtitle" className="text-sm font-medium">
                  Subtitle
                </label>
                <Input
                  id="subtitle"
                  placeholder="e.g., Uploaded all bids"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="dueDate" className="text-sm font-medium">
                  Due Date *
                </label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="priority" className="text-sm font-medium">
                  Priority
                </label>
                <select
                  id="priority"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as "High Priority" | "" })}
                >
                  <option value="">None</option>
                  <option value="High Priority">High Priority</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddDialogOpen(false)
                resetForm()
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddTask} disabled={!formData.title.trim() || !formData.dueDate}>
                Add Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Task Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) {
            resetForm()
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>
                Update task details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="edit-title" className="text-sm font-medium">
                  Title *
                </label>
                <Input
                  id="edit-title"
                  placeholder="e.g., AI Evaluation: T943857"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-subtitle" className="text-sm font-medium">
                  Subtitle
                </label>
                <Input
                  id="edit-subtitle"
                  placeholder="e.g., Uploaded all bids"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-dueDate" className="text-sm font-medium">
                  Due Date *
                </label>
                <Input
                  id="edit-dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-priority" className="text-sm font-medium">
                  Priority
                </label>
                <select
                  id="edit-priority"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as "High Priority" | "" })}
                >
                  <option value="">None</option>
                  <option value="High Priority">High Priority</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsEditDialogOpen(false)
                resetForm()
              }}>
                Cancel
              </Button>
              <Button onClick={handleEditTask} disabled={!formData.title.trim() || !formData.dueDate}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}


