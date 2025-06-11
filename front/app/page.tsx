"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Folder, File, Terminal, HardDrive, ChevronRight, ChevronDown, Home, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { FolderPlus, FileText, Trash2, Eye, ImageIcon, Video, Music, FileArchive, Settings, Shield } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Import the BlockVisualization component
import BlockVisualization from "@/components/block-visualization"

interface FileSystemNode {
  name: string
  type: string
  size: number
  children?: FileSystemNode[]
  created: string
  modified: string
  permissions?: string
  file_type?: string
  owner?: string
}

interface FileSystemState {
  root: FileSystemNode
  current_path: string[]
  total_size: number
  used_size: number
}

export default function FileSystemSimulator() {
  const [fileSystemState, setFileSystemState] = useState<FileSystemState | null>(null)
  const [command, setCommand] = useState("")
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    "File System Simulator v1.0",
    'Type "help" for available commands',
    "",
  ])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["/"]))
  const [loading, setLoading] = useState(false)
  const [apiUrl, setApiUrl] = useState("http://localhost:8000")

  const terminalRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const [createFileDialog, setCreateFileDialog] = useState(false)
  const [createFolderDialog, setCreateFolderDialog] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [newFileContent, setNewFileContent] = useState("")
  const [newFolderName, setNewFolderName] = useState("")
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  // File type and preview states
  const [fileTypes, setFileTypes] = useState<any[]>([])
  const [selectedFileType, setSelectedFileType] = useState("text")
  const [filePreviewDialog, setFilePreviewDialog] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileSystemNode | null>(null)
  const [fileContent, setFileContent] = useState("")

  // Permission states
  const [permissionDialog, setPermissionDialog] = useState(false)
  const [permissionFile, setPermissionFile] = useState<FileSystemNode | null>(null)
  const [newPermissions, setNewPermissions] = useState("")
  const [newOwner, setNewOwner] = useState("")
  const [permissionMode, setPermissionMode] = useState<"octal" | "symbolic">("symbolic")

  // Double click handling
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null)

  // Fetch initial state
  useEffect(() => {
    fetchState()
    fetchFileTypes()
  }, [])

  const fetchFileTypes = async () => {
    try {
      const response = await fetch(`${apiUrl}/file-types`)
      if (response.ok) {
        const data = await response.json()
        setFileTypes(data.file_types)
      }
    } catch (error) {
      console.error("Error fetching file types:", error)
    }
  }

  // Scroll terminal to bottom when history changes
  useEffect(() => {
    const scrollToBottom = () => {
      if (terminalRef.current) {
        const scrollElement =
          terminalRef.current.querySelector("[data-radix-scroll-area-viewport]") || terminalRef.current
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }

    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(scrollToBottom)
  }, [terminalHistory])

  const fetchState = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/state`)
      if (!response.ok) {
        throw new Error("Failed to fetch file system state")
      }
      const data = await response.json()
      setFileSystemState(data)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching state:", error)
      toast({
        title: "Connection Error",
        description: "Could not connect to the Python backend. Make sure it's running.",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const resetFileSystem = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/reset`)
      if (!response.ok) {
        throw new Error("Failed to reset file system")
      }
      const data = await response.json()
      setFileSystemState(data.state)
      addToHistory("File system has been reset")
      setLoading(false)
    } catch (error) {
      console.error("Error resetting file system:", error)
      toast({
        title: "Reset Error",
        description: "Could not reset the file system.",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const addToHistory = (text: string) => {
    setTerminalHistory((prev) => {
      const newHistory = [...prev, text]
      // Force scroll after state update
      setTimeout(() => {
        if (terminalRef.current) {
          const scrollElement =
            terminalRef.current.querySelector("[data-radix-scroll-area-viewport]") || terminalRef.current
          scrollElement.scrollTop = scrollElement.scrollHeight
        }
      }, 50)
      return newHistory
    })
  }

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return

    addToHistory(`$ ${cmd}`)

    try {
      setLoading(true)
      const parts = cmd.trim().split(" ")
      const command = parts[0].toLowerCase()
      const args = parts.slice(1).join(" ")

      const response = await fetch(`${apiUrl}/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command,
          args,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Command execution failed")
      }

      const data = await response.json()

      if (data.result) {
        addToHistory(data.result)
      }

      addToHistory("") // Add empty line after command output
      setFileSystemState(data.state)
      setLoading(false)

      // Force scroll to bottom after command execution
      setTimeout(() => {
        if (terminalRef.current) {
          const scrollElement =
            terminalRef.current.querySelector("[data-radix-scroll-area-viewport]") || terminalRef.current
          scrollElement.scrollTop = scrollElement.scrollHeight
        }
      }, 100)
    } catch (error) {
      console.error("Error executing command:", error)
      addToHistory(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      addToHistory("")
      setLoading(false)

      // Force scroll to bottom after error
      setTimeout(() => {
        if (terminalRef.current) {
          const scrollElement =
            terminalRef.current.querySelector("[data-radix-scroll-area-viewport]") || terminalRef.current
          scrollElement.scrollTop = scrollElement.scrollHeight
        }
      }, 100)
    }
  }

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (command.trim()) {
      executeCommand(command)
      setCommand("")
    }
  }

  const toggleDirectory = (path: string) => {
    setExpandedDirs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }

  // Function to open file preview
  const openFilePreview = async (fileName: string) => {
    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command: "cat",
          args: fileName,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to read file")
      }

      const data = await response.json()

      // Find the file node
      const currentDir = getCurrentDirectory()
      const fileNode = currentDir?.children?.find((child) => child.name === fileName)

      if (fileNode) {
        setPreviewFile(fileNode)
        setFileContent(data.result)
        setFilePreviewDialog(true)
      }

      setLoading(false)
    } catch (error) {
      console.error("Error opening file:", error)
      toast({
        title: "Error",
        description: `Could not open file: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  // Function to open permission dialog
  const openPermissionDialog = (node: FileSystemNode) => {
    setPermissionFile(node)
    setNewPermissions(node.permissions || "rwxr-xr-x")
    setNewOwner(node.owner || "user")
    setPermissionDialog(true)
  }

  // Handle single and double click
  const handleFileClick = (node: FileSystemNode, fullPath: string) => {
    if (node.type === "directory") {
      toggleDirectory(fullPath)
      navigateToPath(fullPath === "/" ? "/" : fullPath)
    } else {
      // Handle file click - check for double click
      if (clickTimeout) {
        // This is a double click
        clearTimeout(clickTimeout)
        setClickTimeout(null)
        openFilePreview(node.name)
      } else {
        // This is a single click - set timeout for double click detection
        const timeout = setTimeout(() => {
          setClickTimeout(null)
          // Single click action - could select file or show info
        }, 300)
        setClickTimeout(timeout)
      }
    }
  }

  // Get file icon based on file type
  const getFileIcon = (fileType?: string) => {
    switch (fileType) {
      case "image":
        return <ImageIcon className="w-4 h-4 text-green-500" />
      case "video":
        return <Video className="w-4 h-4 text-red-500" />
      case "audio":
        return <Music className="w-4 h-4 text-purple-500" />
      case "document":
        return <FileText className="w-4 h-4 text-blue-500" />
      case "archive":
        return <FileArchive className="w-4 h-4 text-orange-500" />
      case "executable":
        return <Settings className="w-4 h-4 text-red-600" />
      default:
        return <File className="w-4 h-4 text-gray-500" />
    }
  }

  // Format file size
  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size}B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`
  }

  // Parse permissions to readable format
  const parsePermissions = (perms: string) => {
    if (!perms || perms.length !== 9) return { owner: "---", group: "---", other: "---" }
    return {
      owner: perms.slice(0, 3),
      group: perms.slice(3, 6),
      other: perms.slice(6, 9),
    }
  }

  // Convert permissions to octal
  const permissionsToOctal = (perms: string) => {
    if (!perms || perms.length !== 9) return "000"

    const groups = [perms.slice(0, 3), perms.slice(3, 6), perms.slice(6, 9)]
    return groups
      .map((group) => {
        let value = 0
        if (group[0] === "r") value += 4
        if (group[1] === "w") value += 2
        if (group[2] === "x") value += 1
        return value.toString()
      })
      .join("")
  }

  // Convert octal to permissions
  const octalToPermissions = (octal: string) => {
    if (octal.length !== 3 || !/^[0-7]{3}$/.test(octal)) return "rwxr-xr-x"

    return octal
      .split("")
      .map((digit) => {
        const val = Number.parseInt(digit)
        return (val & 4 ? "r" : "-") + (val & 2 ? "w" : "-") + (val & 1 ? "x" : "-")
      })
      .join("")
  }

  const renderFileTree = (node: FileSystemNode, path = "", level = 0) => {
    const fullPath = path + "/" + node.name
    const isExpanded = expandedDirs.has(fullPath)
    const currentPath = fileSystemState ? "/" + fileSystemState.current_path.slice(1).join("/") : "/"

    return (
      <div key={fullPath} className="select-none">
        <div
          className={`flex items-center gap-2 py-1 px-2 hover:bg-muted/50 cursor-pointer rounded group ${
            currentPath === fullPath ? "bg-muted" : ""
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => handleFileClick(node, fullPath)}
          title={node.type === "file" ? "Double-click to open file" : "Click to navigate"}
        >
          {node.type === "directory" && (
            <>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Folder className="w-4 h-4 text-blue-500" />
            </>
          )}
          {node.type === "file" && (
            <>
              <div className="w-4" />
              {getFileIcon(node.file_type)}
            </>
          )}
          <span className="text-sm flex-1">{node.name}</span>
          {node.type === "file" && (
            <Badge variant="secondary" className="text-xs">
              {formatFileSize(node.size)}
            </Badge>
          )}
          {level > 0 && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  openPermissionDialog(node)
                }}
                title="Change permissions"
              >
                <Shield className="w-3 h-3 text-blue-500" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedItem(node.name)
                    }}
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {node.type === "directory" ? "Directory" : "File"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{node.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteItem(node.name, node.type === "directory")}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
        {node.type === "directory" && isExpanded && node.children && (
          <div>{node.children.map((child) => renderFileTree(child, fullPath, level + 1))}</div>
        )}
      </div>
    )
  }

  const getCurrentDirectory = () => {
    if (!fileSystemState) return null

    let current = fileSystemState.root
    for (let i = 1; i < fileSystemState.current_path.length; i++) {
      const found = current.children?.find((child) => child.name === fileSystemState.current_path[i])
      if (!found || found.type !== "directory") return null
      current = found
    }
    return current
  }

  const currentDir = getCurrentDirectory()
  const currentPath = fileSystemState ? fileSystemState.current_path.join("/") || "/" : "/"

  const createFile = async () => {
    try {
      setLoading(true)

      // Add appropriate extension if not present
      let fileName = newFileName
      if (selectedFileType !== "text" && !fileName.includes(".")) {
        const fileType = fileTypes.find((ft) => ft.value === selectedFileType)
        if (fileType && fileType.extensions.length > 0) {
          fileName += `.${fileType.extensions[0]}`
        }
      }

      const response = await fetch(`${apiUrl}/create-file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fileName,
          content: selectedFileType === "text" ? newFileContent : "",
          file_type: selectedFileType,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to create file")
      }

      const data = await response.json()
      addToHistory(data.result)
      setFileSystemState(data.state)
      setCreateFileDialog(false)
      setNewFileName("")
      setNewFileContent("")
      setSelectedFileType("text")
      setLoading(false)
    } catch (error) {
      console.error("Error creating file:", error)
      addToHistory(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      setLoading(false)
    }
  }

  const createFolder = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/create-directory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newFolderName,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to create directory")
      }

      const data = await response.json()
      addToHistory(data.result)
      setFileSystemState(data.state)
      setCreateFolderDialog(false)
      setNewFolderName("")
      setLoading(false)
    } catch (error) {
      console.error("Error creating directory:", error)
      addToHistory(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      setLoading(false)
    }
  }

  const deleteItem = async (name: string, isDirectory = false) => {
    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          recursive: isDirectory,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to delete item")
      }

      const data = await response.json()
      addToHistory(data.result)
      setFileSystemState(data.state)
      setLoading(false)
    } catch (error) {
      console.error("Error deleting item:", error)
      addToHistory(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      setLoading(false)
    }
  }

  const changePermissions = async () => {
    try {
      setLoading(true)

      let permissions = newPermissions
      if (permissionMode === "octal") {
        permissions = octalToPermissions(newPermissions)
      }

      const response = await fetch(`${apiUrl}/change-permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: permissionFile?.name,
          permissions,
          owner: newOwner,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to change permissions")
      }

      const data = await response.json()
      addToHistory(data.result)
      setFileSystemState(data.state)
      setPermissionDialog(false)
      setLoading(false)
    } catch (error) {
      console.error("Error changing permissions:", error)
      addToHistory(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      setLoading(false)
    }
  }

  const navigateToPath = async (path: string) => {
    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/navigate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to navigate")
      }

      const data = await response.json()
      if (data.result) {
        addToHistory(data.result)
      }
      setFileSystemState(data.state)
      setLoading(false)
    } catch (error) {
      console.error("Error navigating:", error)
      addToHistory(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <HardDrive className="w-8 h-8" />
            File System Simulator
          </h1>
          <p className="text-muted-foreground">
            Simulasi Sistem Operasi untuk Manajemen File - Tugas Mata Kuliah Sistem Operasi
          </p>
          <div className="flex items-center justify-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="API URL (e.g., http://localhost:8000)"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
            <Button onClick={fetchState} variant="outline" size="sm">
              Connect
            </Button>
            <Button onClick={resetFileSystem} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="filesystem" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="filesystem">File System</TabsTrigger>
            <TabsTrigger value="allocation">Block Allocation</TabsTrigger>
            <TabsTrigger value="terminal">Terminal Only</TabsTrigger>
          </TabsList>

          <TabsContent value="filesystem" className="space-y-4">
            {/* Disk Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5" />
                  Disk Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fileSystemState ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Used: {formatFileSize(fileSystemState.used_size)}</span>
                      <span>Free: {formatFileSize(fileSystemState.total_size - fileSystemState.used_size)}</span>
                      <span>Total: {formatFileSize(fileSystemState.total_size)}</span>
                    </div>
                    <Progress value={(fileSystemState.used_size / fileSystemState.total_size) * 100} />
                  </div>
                ) : (
                  <div className="text-center py-2 text-muted-foreground">Loading disk information...</div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* File Explorer */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Folder className="w-5 h-5" />
                    File Explorer
                    <Badge variant="outline" className="ml-auto text-xs">
                      Double-click files to open
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    {fileSystemState ? (
                      renderFileTree(fileSystemState.root)
                    ) : (
                      <div className="text-center py-10 text-muted-foreground">
                        {loading ? "Loading file system..." : "Connect to the Python backend to view files"}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Terminal */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="w-5 h-5" />
                    Terminal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <ScrollArea
                      className="h-80 bg-black text-green-400 p-4 rounded font-mono text-sm"
                      ref={terminalRef}
                    >
                      <div className="min-h-full">
                        {terminalHistory.map((line, index) => (
                          <div key={index} className="whitespace-pre-wrap">
                            {line}
                          </div>
                        ))}
                        {loading && <div className="animate-pulse">Processing...</div>}
                      </div>
                    </ScrollArea>
                    <form onSubmit={handleCommandSubmit} className="flex gap-2">
                      <div className="flex-1 flex items-center gap-2 bg-black text-green-400 px-3 py-2 rounded font-mono text-sm">
                        <span>{currentPath}$</span>
                        <Input
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                          className="bg-transparent border-none text-green-400 font-mono p-0 h-auto focus-visible:ring-0"
                          placeholder="Enter command..."
                          autoComplete="off"
                          disabled={loading || !fileSystemState}
                        />
                      </div>
                      <Button type="submit" disabled={loading || !fileSystemState}>
                        Execute
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Current Directory Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="w-5 h-5" />
                  Current Directory: {currentPath}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {currentDir?.children?.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50 group"
                      onClick={() => {
                        if (item.type === "file") {
                          openFilePreview(item.name)
                        }
                      }}
                      title={item.type === "file" ? "Click to open file" : "Directory"}
                    >
                      {item.type === "directory" ? (
                        <Folder className="w-5 h-5 text-blue-500" />
                      ) : (
                        getFileIcon(item.file_type)
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground flex gap-2">
                          <span>{item.type === "file" ? formatFileSize(item.size) : "Directory"}</span>
                          <span>{item.permissions}</span>
                          <span>{item.owner}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          openPermissionDialog(item)
                        }}
                        title="Change permissions"
                      >
                        <Shield className="w-3 h-3 text-blue-500" />
                      </Button>
                    </div>
                  )) || (
                    <p className="text-muted-foreground col-span-3">
                      {fileSystemState ? "Directory is empty" : "Connect to view directory contents"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("ls -la")}
                    disabled={loading || !fileSystemState}
                  >
                    List Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("pwd")}
                    disabled={loading || !fileSystemState}
                  >
                    Show Path
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("df")}
                    disabled={loading || !fileSystemState}
                  >
                    Disk Usage
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("tree")}
                    disabled={loading || !fileSystemState}
                  >
                    Show Tree
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("help")}
                    disabled={loading || !fileSystemState}
                  >
                    Help
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("cat readme.txt")}
                    disabled={loading || !fileSystemState}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View File
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("chmod 755 readme.txt")}
                    disabled={loading || !fileSystemState}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Change Permissions
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>File Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Dialog open={createFolderDialog} onOpenChange={setCreateFolderDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={loading || !fileSystemState}>
                        <FolderPlus className="w-4 h-4 mr-2" />
                        New Folder
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Folder</DialogTitle>
                        <DialogDescription>
                          Enter the name for the new folder in the current directory.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="folder-name" className="text-right">
                            Name
                          </Label>
                          <Input
                            id="folder-name"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            className="col-span-3"
                            placeholder="Enter folder name..."
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" onClick={createFolder} disabled={!newFolderName.trim() || loading}>
                          Create Folder
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={createFileDialog} onOpenChange={setCreateFileDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={loading || !fileSystemState}>
                        <FileText className="w-4 h-4 mr-2" />
                        New File
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Create New File</DialogTitle>
                        <DialogDescription>
                          Choose file type and enter content. File size will be calculated automatically.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="file-type" className="text-right">
                            Type
                          </Label>
                          <Select value={selectedFileType} onValueChange={setSelectedFileType}>
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Select file type" />
                            </SelectTrigger>
                            <SelectContent>
                              {fileTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="file-name" className="text-right">
                            Name
                          </Label>
                          <Input
                            id="file-name"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            className="col-span-3"
                            placeholder="Enter file name..."
                          />
                        </div>
                        {selectedFileType === "text" && (
                          <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="file-content" className="text-right pt-2">
                              Content
                            </Label>
                            <Textarea
                              id="file-content"
                              value={newFileContent}
                              onChange={(e) => setNewFileContent(e.target.value)}
                              className="col-span-3 min-h-32"
                              placeholder="Enter file content..."
                            />
                          </div>
                        )}
                        {selectedFileType !== "text" && (
                          <div className="col-span-4 text-sm text-muted-foreground bg-muted p-3 rounded">
                            <strong>Note:</strong> This will create a simulated {selectedFileType} file with realistic
                            file size.
                            {selectedFileType === "image" && " (50KB - 2MB)"}
                            {selectedFileType === "video" && " (5MB - 50MB)"}
                            {selectedFileType === "audio" && " (1MB - 10MB)"}
                            {selectedFileType === "document" && " (10KB - 500KB)"}
                            {selectedFileType === "archive" && " (100KB - 10MB)"}
                            {selectedFileType === "executable" && " (1MB - 100MB)"}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          {selectedFileType === "text"
                            ? `File size: ${new Blob([newFileContent]).size} bytes`
                            : "File size will be determined automatically based on file type"}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" onClick={createFile} disabled={!newFileName.trim() || loading}>
                          Create File
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("ls -la")}
                    disabled={loading || !fileSystemState}
                  >
                    <File className="w-4 h-4 mr-2" />
                    List Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allocation" className="space-y-4">
            {/* Block Visualization - Only renders when this tab is active */}
            <BlockVisualization
              apiUrl={apiUrl}
              currentPath={currentPath}
              currentDir={currentDir}
              onRefresh={fetchState}
            />
          </TabsContent>

          <TabsContent value="terminal" className="space-y-4">
            {/* Full-screen Terminal */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="w-5 h-5" />
                  Terminal - Full Screen Mode
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <ScrollArea
                    className="h-[600px] bg-black text-green-400 p-4 rounded font-mono text-sm"
                    ref={terminalRef}
                  >
                    <div className="min-h-full">
                      {terminalHistory.map((line, index) => (
                        <div key={index} className="whitespace-pre-wrap">
                          {line}
                        </div>
                      ))}
                      {loading && <div className="animate-pulse">Processing...</div>}
                    </div>
                  </ScrollArea>
                  <form onSubmit={handleCommandSubmit} className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-black text-green-400 px-3 py-2 rounded font-mono text-sm">
                      <span>{currentPath}$</span>
                      <Input
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        className="bg-transparent border-none text-green-400 font-mono p-0 h-auto focus-visible:ring-0"
                        placeholder="Enter command..."
                        autoComplete="off"
                        disabled={loading || !fileSystemState}
                      />
                    </div>
                    <Button type="submit" disabled={loading || !fileSystemState}>
                      Execute
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>

            {/* Terminal Quick Commands */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Commands</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("ls -la")}
                    disabled={loading || !fileSystemState}
                  >
                    ls -la
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("pwd")}
                    disabled={loading || !fileSystemState}
                  >
                    pwd
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("df -h")}
                    disabled={loading || !fileSystemState}
                  >
                    df -h
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("tree")}
                    disabled={loading || !fileSystemState}
                  >
                    tree
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("help")}
                    disabled={loading || !fileSystemState}
                  >
                    help
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("whoami")}
                    disabled={loading || !fileSystemState}
                  >
                    whoami
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("date")}
                    disabled={loading || !fileSystemState}
                  >
                    date
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeCommand("clear")}
                    disabled={loading || !fileSystemState}
                  >
                    clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* All the existing dialogs remain the same */}
        {/* File Preview Dialog */}
        <Dialog open={filePreviewDialog} onOpenChange={setFilePreviewDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {previewFile && getFileIcon(previewFile.file_type)}
                {previewFile?.name}
                <Badge variant="outline" className="ml-2">
                  {previewFile?.file_type || "unknown"}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {previewFile && (
                  <div className="flex gap-4 text-sm">
                    <span>Size: {formatFileSize(previewFile.size)}</span>
                    <span>Modified: {new Date(previewFile.modified).toLocaleString()}</span>
                    <span>Permissions: {previewFile.permissions}</span>
                    <span>Owner: {previewFile.owner}</span>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-96">
              <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded">{fileContent}</div>
            </ScrollArea>
            <DialogFooter>
              <Button onClick={() => setFilePreviewDialog(false)}>Close</Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (previewFile) {
                    openPermissionDialog(previewFile)
                    setFilePreviewDialog(false)
                  }
                }}
              >
                <Shield className="w-4 h-4 mr-2" />
                Permissions
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (previewFile) {
                    executeCommand(`file ${previewFile.name}`)
                  }
                }}
              >
                Show File Info
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Permission Dialog */}
        <Dialog open={permissionDialog} onOpenChange={setPermissionDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Change Permissions: {permissionFile?.name}
              </DialogTitle>
              <DialogDescription>
                Modify file permissions and ownership for this {permissionFile?.type}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Current Info */}
              <div className="bg-muted p-4 rounded">
                <h4 className="font-medium mb-2">Current Settings</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Permissions:</span> {permissionFile?.permissions}
                  </div>
                  <div>
                    <span className="font-medium">Owner:</span> {permissionFile?.owner}
                  </div>
                  <div>
                    <span className="font-medium">Octal:</span>{" "}
                    {permissionFile?.permissions ? permissionsToOctal(permissionFile.permissions) : "000"}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {permissionFile?.type}
                  </div>
                </div>
              </div>

              {/* Permission Mode Toggle */}
              <div className="space-y-2">
                <Label>Permission Mode</Label>
                <Select
                  value={permissionMode}
                  onValueChange={(value: "octal" | "symbolic") => setPermissionMode(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="symbolic">Symbolic (rwxr-xr-x)</SelectItem>
                    <SelectItem value="octal">Octal (755)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Permission Input */}
              {permissionMode === "symbolic" ? (
                <div className="space-y-4">
                  <Label>Permissions (rwxr-xr-x format)</Label>
                  <Input
                    value={newPermissions}
                    onChange={(e) => setNewPermissions(e.target.value)}
                    placeholder="rwxr-xr-x"
                    maxLength={9}
                  />
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Owner</div>
                      <div className="text-muted-foreground">{parsePermissions(newPermissions).owner}</div>
                    </div>
                    <div>
                      <div className="font-medium">Group</div>
                      <div className="text-muted-foreground">{parsePermissions(newPermissions).group}</div>
                    </div>
                    <div>
                      <div className="font-medium">Other</div>
                      <div className="text-muted-foreground">{parsePermissions(newPermissions).other}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label>Permissions (Octal format)</Label>
                  <Input
                    value={newPermissions}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-7]/g, "").slice(0, 3)
                      setNewPermissions(value)
                    }}
                    placeholder="755"
                    maxLength={3}
                  />
                  <div className="text-sm text-muted-foreground">Preview: {octalToPermissions(newPermissions)}</div>
                </div>
              )}

              {/* Owner */}
              <div className="space-y-2">
                <Label htmlFor="owner">Owner</Label>
                <Input id="owner" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="user" />
              </div>

              {/* Permission Reference */}
              <div className="bg-muted p-4 rounded text-sm">
                <h4 className="font-medium mb-2">Permission Reference</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium">Symbolic:</div>
                    <div>r = read (4)</div>
                    <div>w = write (2)</div>
                    <div>x = execute (1)</div>
                  </div>
                  <div>
                    <div className="font-medium">Common Octal:</div>
                    <div>755 = rwxr-xr-x</div>
                    <div>644 = rw-r--r--</div>
                    <div>600 = rw-------</div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPermissionDialog(false)}>
                Cancel
              </Button>
              <Button onClick={changePermissions} disabled={loading}>
                Apply Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
