"use client"

import { CardDescription } from "@/components/ui/card"

import type React from "react"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  HardDrive,
  FileText,
  Layers,
  GitBranch,
  GitMerge,
  RefreshCw,
  Info,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface BlockInfo {
  total_blocks: number
  used_blocks: number
  free_blocks: number
  block_size: number
  bitmap: boolean[]
  fragmentation_index: number
}

interface FileBlocks {
  filename: string
  size: number
  blocks: number[]
  allocation_type: string
  start_block?: number
  block_count: number
}

interface BlockVisualizationProps {
  apiUrl: string
  currentPath: string
  currentDir?: any
  onRefresh: () => void
}

interface BlockOwnership {
  [blockIndex: number]: {
    filename: string
    fileType: string
    size: number
    allocationType: string
  }
}

// Canvas-based Block Renderer for better performance
const CanvasBlockRenderer = ({
  blockInfo,
  fileBlocks,
  blockOwnership,
  onBlockClick,
  searchTerm,
}: {
  blockInfo: BlockInfo | null
  fileBlocks: FileBlocks | null
  blockOwnership: BlockOwnership
  onBlockClick?: (blockIndex: number, blockData: any) => void
  searchTerm: string
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredBlock, setHoveredBlock] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })

  const [containerSize, setContainerSize] = useState({ width: 1200, height: 700 })
  const canvasSize = containerSize
  const blockSize = Math.max(2, 6 * zoom) // Larger base size, minimum 2px
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({
          width: Math.max(800, rect.width - 32), // Subtract padding
          height: Math.max(600, Math.min(800, rect.width * 0.6)), // Maintain aspect ratio
        })
      }
    }

    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  // Calculate grid layout
  const gridLayout = useMemo(() => {
    if (!blockInfo) return { blocksPerRow: 0, totalRows: 0 }

    const availableWidth = canvasSize.width / zoom
    const availableHeight = canvasSize.height / zoom

    // Calculate optimal layout to fill the canvas better
    const totalBlocks = blockInfo.total_blocks
    const aspectRatio = availableWidth / availableHeight

    // Calculate blocks per row to achieve good space utilization
    const idealBlocksPerRow = Math.ceil(Math.sqrt(totalBlocks * aspectRatio))
    const maxBlocksPerRow = Math.floor(availableWidth / (blockSize + 1))
    const blocksPerRow = Math.min(idealBlocksPerRow, maxBlocksPerRow)

    const totalRows = Math.ceil(totalBlocks / blocksPerRow)

    // If we have too much vertical space, increase block size
    const requiredHeight = totalRows * (blockSize + 1)
    if (requiredHeight < availableHeight * 0.7) {
      // Recalculate with larger blocks to fill more space
      const newBlockSize = Math.min(
        Math.floor((availableHeight * 0.8) / totalRows) - 1,
        Math.floor(availableWidth / blocksPerRow) - 1,
      )
      if (newBlockSize > blockSize) {
        return {
          blocksPerRow,
          totalRows,
          adjustedBlockSize: Math.max(blockSize, newBlockSize),
        }
      }
    }

    return { blocksPerRow, totalRows, adjustedBlockSize: blockSize }
  }, [blockInfo, blockSize, zoom, canvasSize.width, canvasSize.height])

  // Filter blocks based on search
  const filteredBlocks = useMemo(() => {
    if (!blockInfo || !searchTerm) return null

    const searchLower = searchTerm.toLowerCase()
    const matchingBlocks = new Set<number>()

    // Search in file blocks
    if (fileBlocks && fileBlocks.filename.toLowerCase().includes(searchLower)) {
      fileBlocks.blocks.forEach((block) => matchingBlocks.add(block))
    }

    // Search in block ownership
    Object.entries(blockOwnership).forEach(([blockIndex, owner]) => {
      if (owner.filename.toLowerCase().includes(searchLower)) {
        matchingBlocks.add(Number.parseInt(blockIndex))
      }
    })

    return matchingBlocks
  }, [blockInfo, fileBlocks, blockOwnership, searchTerm])

  // Draw blocks on canvas
  const drawBlocks = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !blockInfo) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Apply zoom and offset
    ctx.save()
    ctx.scale(zoom, zoom)
    ctx.translate(offset.x, offset.y)

    const { blocksPerRow, adjustedBlockSize = blockSize } = gridLayout
    const selectedBlocks = new Set(fileBlocks?.blocks || [])

    // Draw blocks
    for (let i = 0; i < blockInfo.total_blocks; i++) {
      const row = Math.floor(i / blocksPerRow)
      const col = i % blocksPerRow
      const x = col * (adjustedBlockSize + 1)
      const y = row * (adjustedBlockSize + 1)

      // Determine block color
      let color = "#e5e7eb" // Free block (gray)

      if (filteredBlocks && filteredBlocks.has(i)) {
        color = "#fbbf24" // Search match (yellow)
      } else if (selectedBlocks.has(i)) {
        color = "#10b981" // Selected file (green)
      } else if (blockInfo.bitmap[i]) {
        color = "#ef4444" // Used block (red)
      }

      // Highlight hovered block
      if (hoveredBlock === i) {
        color = "#3b82f6" // Blue for hover
      }

      ctx.fillStyle = color
      ctx.fillRect(x, y, adjustedBlockSize, adjustedBlockSize)

      // Add border for better visibility
      if (adjustedBlockSize > 3) {
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 0.5
        ctx.strokeRect(x, y, adjustedBlockSize, adjustedBlockSize)
      }
    }

    ctx.restore()
  }, [
    blockInfo,
    fileBlocks,
    blockOwnership,
    hoveredBlock,
    zoom,
    offset,
    blockSize,
    gridLayout,
    filteredBlocks,
    canvasSize.width,
    canvasSize.height,
  ])

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!blockInfo || !onBlockClick) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) / zoom - offset.x
      const y = (event.clientY - rect.top) / zoom - offset.y

      const { blocksPerRow, adjustedBlockSize = blockSize } = gridLayout
      const col = Math.floor(x / (adjustedBlockSize + 1))
      const row = Math.floor(y / (adjustedBlockSize + 1))
      const blockIndex = row * blocksPerRow + col

      if (blockIndex >= 0 && blockIndex < blockInfo.total_blocks) {
        const selectedBlocks = new Set(fileBlocks?.blocks || [])
        const ownerInfo = blockOwnership[blockIndex]

        onBlockClick(blockIndex, {
          status: selectedBlocks.has(blockIndex) ? "selected" : blockInfo.bitmap[blockIndex] ? "used" : "free",
          isUsed: blockInfo.bitmap[blockIndex],
          isSelected: selectedBlocks.has(blockIndex),
          filename: selectedBlocks.has(blockIndex) ? fileBlocks?.filename : ownerInfo?.filename,
          owner: ownerInfo,
        })
      }
    },
    [blockInfo, fileBlocks, blockOwnership, onBlockClick, zoom, offset, blockSize, gridLayout],
  )

  // Handle canvas mouse move for hover
  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!blockInfo) return

      const canvas = canvasRef.current
      if (!canvas) return

      if (isDragging) {
        const deltaX = event.clientX - lastMousePos.x
        const deltaY = event.clientY - lastMousePos.y

        setOffset((prev) => ({
          x: prev.x + deltaX / zoom,
          y: prev.y + deltaY / zoom,
        }))

        setLastMousePos({ x: event.clientX, y: event.clientY })
        return
      }

      const rect = canvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) / zoom - offset.x
      const y = (event.clientY - rect.top) / zoom - offset.y

      const { blocksPerRow, adjustedBlockSize = blockSize } = gridLayout
      const col = Math.floor(x / (adjustedBlockSize + 1))
      const row = Math.floor(y / (adjustedBlockSize + 1))
      const blockIndex = row * blocksPerRow + col

      if (blockIndex >= 0 && blockIndex < blockInfo.total_blocks) {
        setHoveredBlock(blockIndex)
      } else {
        setHoveredBlock(null)
      }
    },
    [blockInfo, zoom, offset, blockSize, gridLayout, isDragging, lastMousePos],
  )

  // Mouse events for panning
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    setLastMousePos({ x: event.clientX, y: event.clientY })
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.5, 10))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.5, 0.1))
  const handleResetView = () => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  // Redraw when dependencies change
  useEffect(() => {
    drawBlocks()
  }, [drawBlocks])

  // Get tooltip info for hovered block
  const getTooltipInfo = () => {
    if (hoveredBlock === null || !blockInfo) return null

    const selectedBlocks = new Set(fileBlocks?.blocks || [])
    const ownerInfo = blockOwnership[hoveredBlock]

    if (selectedBlocks.has(hoveredBlock)) {
      return `Block ${hoveredBlock}: ${fileBlocks?.filename} (Selected)`
    } else if (ownerInfo) {
      return `Block ${hoveredBlock}: ${ownerInfo.filename} (${ownerInfo.allocationType})`
    } else if (blockInfo.bitmap[hoveredBlock]) {
      return `Block ${hoveredBlock}: Used`
    } else {
      return `Block ${hoveredBlock}: Free`
    }
  }

  if (!blockInfo) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No block information available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetView}>
            Reset View
          </Button>
          <span className="text-sm text-muted-foreground">Zoom: {(zoom * 100).toFixed(0)}%</span>
        </div>

        <div className="text-sm text-muted-foreground">
          {blockInfo.total_blocks.toLocaleString()} blocks • Click and drag to pan
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative border-2 border-gray-200 rounded-lg overflow-hidden w-full">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="cursor-crosshair w-full h-auto"
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoveredBlock(null)
            setIsDragging(false)
          }}
        />

        {/* Tooltip */}
        {hoveredBlock !== null && (
          <div className="absolute top-2 right-2 bg-black/90 text-white text-xs px-3 py-2 rounded-lg pointer-events-none z-10 shadow-lg">
            {getTooltipInfo()}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 text-sm bg-white p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 border rounded-sm"></div>
          <span className="font-medium">Free ({blockInfo.free_blocks.toLocaleString()})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 border rounded-sm"></div>
          <span className="font-medium">Used ({blockInfo.used_blocks.toLocaleString()})</span>
        </div>
        {fileBlocks && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 border rounded-sm"></div>
            <span className="font-medium">Selected File ({fileBlocks.block_count.toLocaleString()})</span>
          </div>
        )}
        {filteredBlocks && filteredBlocks.size > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 border rounded-sm"></div>
            <span className="font-medium">Search Results ({filteredBlocks.size.toLocaleString()})</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Paginated Block List for detailed view
const PaginatedBlockList = ({
  blockInfo,
  fileBlocks,
  blockOwnership,
  onBlockClick,
}: {
  blockInfo: BlockInfo | null
  fileBlocks: FileBlocks | null
  blockOwnership: BlockOwnership
  onBlockClick?: (blockIndex: number, blockData: any) => void
}) => {
  const [currentPage, setCurrentPage] = useState(0)
  const blocksPerPage = 1000

  if (!blockInfo) return null

  const totalPages = Math.ceil(blockInfo.total_blocks / blocksPerPage)
  const startBlock = currentPage * blocksPerPage
  const endBlock = Math.min(startBlock + blocksPerPage, blockInfo.total_blocks)

  const selectedBlocks = new Set(fileBlocks?.blocks || [])

  // Calculate optimal grid layout
  const blocksToShow = endBlock - startBlock
  const optimalColumns = Math.min(Math.ceil(Math.sqrt(blocksToShow * 1.5)), 50) // Max 50 columns
  const blockSize = Math.max(8, Math.min(16, 800 / optimalColumns)) // Responsive block size

  return (
    <div className="space-y-4">
      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage + 1} of {totalPages}
            (Blocks {startBlock.toLocaleString()} - {(endBlock - 1).toLocaleString()})
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
          >
            Next
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Jump to page:</span>
          <Input
            type="number"
            min="1"
            max={totalPages}
            value={currentPage + 1}
            onChange={(e) => {
              const page = Number.parseInt(e.target.value) - 1
              if (page >= 0 && page < totalPages) {
                setCurrentPage(page)
              }
            }}
            className="w-20"
          />
        </div>
      </div>

      {/* Grid Layout Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
        <div>
          Showing {blocksToShow.toLocaleString()} blocks in {optimalColumns} columns
        </div>
        <div>
          Block size: {blockSize}px • Grid: {optimalColumns} × {Math.ceil(blocksToShow / optimalColumns)}
        </div>
      </div>

      {/* Improved Block Grid */}
      <div className="relative">
        <div
          className="grid gap-0.5 p-6 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl overflow-auto shadow-inner"
          style={{
            gridTemplateColumns: `repeat(${optimalColumns}, minmax(0, 1fr))`,
            maxHeight: "500px",
          }}
        >
          {Array.from({ length: endBlock - startBlock }, (_, i) => {
            const blockIndex = startBlock + i
            const isUsed = blockInfo.bitmap[blockIndex]
            const isSelected = selectedBlocks.has(blockIndex)
            const owner = blockOwnership[blockIndex]

            let color = "bg-gray-200 hover:bg-gray-300 border-gray-300"
            if (isSelected) {
              color = "bg-green-500 hover:bg-green-600 border-green-600"
            } else if (isUsed) {
              color = "bg-red-500 hover:bg-red-600 border-red-600"
            }

            return (
              <div
                key={blockIndex}
                className={`cursor-pointer transition-all duration-150 hover:scale-125 hover:z-10 relative border rounded-sm shadow-sm ${color}`}
                style={{
                  width: `${blockSize}px`,
                  height: `${blockSize}px`,
                }}
                onClick={() =>
                  onBlockClick?.(blockIndex, {
                    status: isSelected ? "selected" : isUsed ? "used" : "free",
                    isUsed,
                    isSelected,
                    filename: isSelected ? fileBlocks?.filename : owner?.filename,
                    owner,
                  })
                }
                title={`Block ${blockIndex}: ${
                  isSelected ? fileBlocks?.filename : owner ? owner.filename : isUsed ? "Used" : "Free"
                }`}
              />
            )
          })}
        </div>

        {/* Block Index Overlay for Reference */}
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-mono border shadow-sm">
          Block Range: {startBlock.toLocaleString()} - {(endBlock - 1).toLocaleString()}
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(0)} disabled={currentPage === 0}>
          First
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.max(0, currentPage - 5))}
          disabled={currentPage < 5}
        >
          -5
        </Button>
        <span className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm font-medium">
          {currentPage + 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 5))}
          disabled={currentPage >= totalPages - 5}
        >
          +5
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(totalPages - 1)}
          disabled={currentPage === totalPages - 1}
        >
          Last
        </Button>
      </div>

      {/* Statistics for Current Page */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-lg font-bold text-gray-700">
            {Array.from({ length: endBlock - startBlock }, (_, i) => startBlock + i)
              .filter((i) => !blockInfo.bitmap[i])
              .length.toLocaleString()}
          </div>
          <div className="text-xs text-gray-600">Free Blocks</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-lg font-bold text-red-700">
            {Array.from({ length: endBlock - startBlock }, (_, i) => startBlock + i)
              .filter((i) => blockInfo.bitmap[i] && !selectedBlocks.has(i))
              .length.toLocaleString()}
          </div>
          <div className="text-xs text-red-600">Used Blocks</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-lg font-bold text-green-700">
            {Array.from({ length: endBlock - startBlock }, (_, i) => startBlock + i)
              .filter((i) => selectedBlocks.has(i))
              .length.toLocaleString()}
          </div>
          <div className="text-xs text-green-600">Selected File</div>
        </div>
      </div>
    </div>
  )
}

export default function BlockVisualization({ apiUrl, currentPath, currentDir, onRefresh }: BlockVisualizationProps) {
  const [blockInfo, setBlockInfo] = useState<BlockInfo | null>(null)
  const [fileBlocks, setFileBlocks] = useState<FileBlocks | null>(null)
  const [selectedFile, setSelectedFile] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [allocationStrategy, setAllocationStrategy] = useState<string>("indexed")
  const [blockOwnership, setBlockOwnership] = useState<BlockOwnership>({})
  const [clickedBlockInfo, setClickedBlockInfo] = useState<any>(null)
  const [blockDetailDialog, setBlockDetailDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"canvas" | "paginated">("canvas")
  const { toast } = useToast()

  // All the existing functions remain the same...
  const fetchBlockInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/block-info`)
      if (!response.ok) {
        throw new Error("Failed to fetch block information")
      }
      const data = await response.json()
      setBlockInfo(data.block_info)
    } catch (error) {
      console.error("Error fetching block info:", error)
      toast({
        title: "Error",
        description: "Failed to fetch block information",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchFileBlocks = async (filename: string) => {
    if (!filename) return

    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/file-blocks/${filename}`)
      if (!response.ok) {
        throw new Error("Failed to fetch file blocks")
      }
      const data = await response.json()

      if (typeof data.file_blocks === "string") {
        toast({
          title: "Info",
          description: data.file_blocks,
        })
        setFileBlocks(null)
      } else {
        setFileBlocks(data.file_blocks)

        const newOwnership: BlockOwnership = { ...blockOwnership }
        data.file_blocks.blocks.forEach((blockIndex: number) => {
          newOwnership[blockIndex] = {
            filename: data.file_blocks.filename,
            fileType: "file",
            size: data.file_blocks.size,
            allocationType: data.file_blocks.allocation_type,
          }
        })
        setBlockOwnership(newOwnership)
      }
    } catch (error) {
      console.error("Error fetching file blocks:", error)
      toast({
        title: "Error",
        description: "Failed to fetch file block information",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchAllFileBlocks = async () => {
    if (!currentDir?.children) return

    const files = currentDir.children.filter((child: any) => child.type === "file")
    const ownership: BlockOwnership = {}

    for (const file of files) {
      try {
        const response = await fetch(`${apiUrl}/file-blocks/${file.name}`)
        if (response.ok) {
          const data = await response.json()
          if (data.file_blocks && typeof data.file_blocks !== "string") {
            data.file_blocks.blocks.forEach((blockIndex: number) => {
              ownership[blockIndex] = {
                filename: data.file_blocks.filename,
                fileType: file.file_type || "file",
                size: data.file_blocks.size,
                allocationType: data.file_blocks.allocation_type,
              }
            })
          }
        }
      } catch (error) {
        console.error(`Error fetching blocks for ${file.name}:`, error)
      }
    }

    setBlockOwnership(ownership)
  }

  const handleBlockClick = async (blockIndex: number, blockData: any) => {
    setClickedBlockInfo({
      blockIndex,
      ...blockData,
    })
    setBlockDetailDialog(true)
  }

  const changeAllocationStrategy = async (strategy: string) => {
    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/set-allocation-strategy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ strategy }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to set allocation strategy")
      }

      const data = await response.json()
      setAllocationStrategy(strategy)
      toast({
        title: "Success",
        description: data.result,
      })
      onRefresh()
    } catch (error) {
      console.error("Error setting allocation strategy:", error)
      toast({
        title: "Error",
        description: `Failed to set allocation strategy: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBlockInfo()
    fetchAllFileBlocks()
  }, [apiUrl, currentDir])

  useEffect(() => {
    if (selectedFile) {
      fetchFileBlocks(selectedFile)
    } else {
      setFileBlocks(null)
    }
  }, [selectedFile])

  const getFilesInCurrentDir = () => {
    if (!currentDir || !currentDir.children) return []
    return currentDir.children.filter((child: any) => child.type === "file")
  }

  const formatSize = (size: number) => {
    if (size < 1024) return `${size}B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`
  }

  const getAllocationIcon = (type: string) => {
    switch (type) {
      case "contiguous":
        return <Layers className="w-4 h-4" />
      case "linked":
        return <GitBranch className="w-4 h-4" />
      case "indexed":
        return <GitMerge className="w-4 h-4" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  const getFragmentationColor = (fragmentation: number) => {
    if (fragmentation < 30) return "bg-green-500"
    if (fragmentation < 70) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Block Allocation Visualization
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAllFileBlocks}
                disabled={loading}
                className="flex items-center gap-1"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh Ownership
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchBlockInfo}
                disabled={loading}
                className="flex items-center gap-1"
              >
                <RefreshCw className={`w-4 h-4 animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="file-blocks">File Analysis</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              {blockInfo ? (
                <>
                  {/* Statistics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-blue-700">
                          {blockInfo.total_blocks.toLocaleString()}
                        </div>
                        <p className="text-xs text-blue-600">Total Blocks</p>
                        <p className="text-xs text-blue-500 mt-1">{formatSize(blockInfo.block_size)} each</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-50 to-red-100">
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-red-700">{blockInfo.used_blocks.toLocaleString()}</div>
                        <p className="text-xs text-red-600">Used Blocks</p>
                        <p className="text-xs text-red-500 mt-1">
                          {((blockInfo.used_blocks / blockInfo.total_blocks) * 100).toFixed(1)}%
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-green-100">
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-green-700">
                          {blockInfo.free_blocks.toLocaleString()}
                        </div>
                        <p className="text-xs text-green-600">Free Blocks</p>
                        <p className="text-xs text-green-500 mt-1">
                          {((blockInfo.free_blocks / blockInfo.total_blocks) * 100).toFixed(1)}%
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-purple-700">{blockInfo.fragmentation_index}%</div>
                        <p className="text-xs text-purple-600">Fragmentation</p>
                        <div
                          className={`w-full h-2 rounded-full mt-2 ${
                            blockInfo.fragmentation_index < 30
                              ? "bg-green-100"
                              : blockInfo.fragmentation_index < 70
                                ? "bg-yellow-100"
                                : "bg-red-100"
                          }`}
                        >
                          <div
                            className={`h-2 rounded-full ${getFragmentationColor(blockInfo.fragmentation_index)}`}
                            style={{ width: `${blockInfo.fragmentation_index}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Disk Usage Progress */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-lg font-semibold">Disk Usage</span>
                        <span className="text-sm text-muted-foreground">
                          {formatSize(blockInfo.used_blocks * blockInfo.block_size)} /{" "}
                          {formatSize(blockInfo.total_blocks * blockInfo.block_size)}
                        </span>
                      </div>
                      <Progress value={(blockInfo.used_blocks / blockInfo.total_blocks) * 100} className="h-4" />
                    </CardContent>
                  </Card>

                  {/* Search and View Controls */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 flex-1">
                          <Search className="w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Search files to highlight their blocks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-md"
                          />
                          {searchTerm && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSearchTerm("")}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">View:</span>
                          <Select
                            value={viewMode}
                            onValueChange={(value: "canvas" | "paginated") => setViewMode(value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="canvas">Canvas</SelectItem>
                              <SelectItem value="paginated">Paginated</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* File Selection for Block Highlighting */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 flex-1">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <Select value={selectedFile} onValueChange={setSelectedFile}>
                            <SelectTrigger className="max-w-md">
                              <SelectValue placeholder="Select a file to highlight its blocks..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 bg-gray-300 rounded-sm"></div>
                                  Clear selection
                                </div>
                              </SelectItem>
                              {getFilesInCurrentDir().map((file: any) => (
                                <SelectItem key={file.name} value={file.name}>
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    {file.name}
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {formatSize(file.size)}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedFile && fileBlocks && (
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                              <span>{fileBlocks.block_count.toLocaleString()} blocks</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {getAllocationIcon(fileBlocks.allocation_type)}
                              <span>{fileBlocks.allocation_type}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Block Visualization */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <HardDrive className="w-5 h-5" />
                        Interactive Block Map
                        <Badge variant="secondary" className="ml-2">
                          {viewMode === "canvas" ? "Canvas View" : "Paginated View"}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {viewMode === "canvas" ? (
                        <CanvasBlockRenderer
                          blockInfo={blockInfo}
                          fileBlocks={fileBlocks}
                          blockOwnership={blockOwnership}
                          onBlockClick={handleBlockClick}
                          searchTerm={searchTerm}
                        />
                      ) : (
                        <PaginatedBlockList
                          blockInfo={blockInfo}
                          fileBlocks={fileBlocks}
                          blockOwnership={blockOwnership}
                          onBlockClick={handleBlockClick}
                        />
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-20 text-muted-foreground">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading block information...
                    </div>
                  ) : (
                    "No block information available"
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="file-blocks" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">File Block Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Select a file to analyze</label>
                    <Select value={selectedFile} onValueChange={setSelectedFile}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a file..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilesInCurrentDir().map((file: any) => (
                          <SelectItem key={file.name} value={file.name}>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              {file.name}
                              <Badge variant="outline" className="ml-2 text-xs">
                                {formatSize(file.size)}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {fileBlocks ? (
                    <div className="space-y-6">
                      {/* File Information */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">File Name</p>
                          <p className="font-medium">{fileBlocks.filename}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Size</p>
                          <p className="font-medium">{formatSize(fileBlocks.size)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Allocation Type</p>
                          <div className="flex items-center gap-1">
                            {getAllocationIcon(fileBlocks.allocation_type)}
                            <Badge variant="secondary">{fileBlocks.allocation_type}</Badge>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Blocks Allocated</p>
                          <p className="font-medium">{fileBlocks.block_count.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Block List */}

                      {/* Block Information */}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Block Usage Details</p>

                        {/* Block Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="text-lg font-bold text-blue-700">
                              {fileBlocks.blocks.length.toLocaleString()}
                            </div>
                            <div className="text-xs text-blue-600">Total Blocks</div>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg">
                            <div className="text-lg font-bold text-green-700">
                              {fileBlocks.blocks.length > 0 ? fileBlocks.blocks[0] : "N/A"}
                            </div>
                            <div className="text-xs text-green-600">First Block</div>
                          </div>
                          <div className="bg-purple-50 p-3 rounded-lg">
                            <div className="text-lg font-bold text-purple-700">
                              {fileBlocks.blocks.length > 0 ? fileBlocks.blocks[fileBlocks.blocks.length - 1] : "N/A"}
                            </div>
                            <div className="text-xs text-purple-600">Last Block</div>
                          </div>
                          <div className="bg-orange-50 p-3 rounded-lg">
                            <div className="text-lg font-bold text-orange-700">
                              {fileBlocks.blocks.length > 1
                                ? fileBlocks.blocks[fileBlocks.blocks.length - 1] -
                                  fileBlocks.blocks[0] +
                                  1 -
                                  fileBlocks.blocks.length
                                : 0}
                            </div>
                            <div className="text-xs text-orange-600">Gaps</div>
                          </div>
                        </div>

                        {/* Block Ranges Display */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Block Allocation Pattern</span>
                            <Badge variant="outline" className="text-xs">
                              {fileBlocks.allocation_type === "contiguous" ? "Sequential" : "Fragmented"}
                            </Badge>
                          </div>

                          <div className="bg-muted p-4 rounded-lg max-h-48 overflow-auto">
                            {fileBlocks.allocation_type === "contiguous" ? (
                              // Show range for contiguous allocation
                              <div className="text-sm font-mono">
                                <span className="text-green-600">Range:</span> {fileBlocks.blocks[0]} -{" "}
                                {fileBlocks.blocks[fileBlocks.blocks.length - 1]}
                                <div className="text-xs text-muted-foreground mt-1">
                                  Consecutive blocks from {fileBlocks.blocks[0]} to{" "}
                                  {fileBlocks.blocks[fileBlocks.blocks.length - 1]}
                                </div>
                              </div>
                            ) : (
                              // Show compact grid for non-contiguous allocation
                              <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">Block indices (showing first 50):</div>
                                <div className="grid grid-cols-8 gap-1 text-xs font-mono">
                                  {fileBlocks.blocks.slice(0, 50).map((block, index) => (
                                    <div key={index} className="bg-white px-2 py-1 rounded text-center border">
                                      {block}
                                    </div>
                                  ))}
                                </div>
                                {fileBlocks.blocks.length > 50 && (
                                  <div className="text-xs text-muted-foreground text-center pt-2">
                                    ... and {(fileBlocks.blocks.length - 50).toLocaleString()} more blocks
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Fragmentation Analysis */}
                        {fileBlocks.allocation_type !== "contiguous" && (
                          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center gap-2 text-yellow-800">
                              <Info className="w-4 h-4" />
                              <span className="text-sm font-medium">Fragmentation Detected</span>
                            </div>
                            <p className="text-xs text-yellow-700 mt-1">
                              This file is stored in {fileBlocks.blocks.length} non-consecutive blocks, which may impact
                              read performance.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : selectedFile ? (
                    <div className="text-center py-20 text-muted-foreground">Loading file block information...</div>
                  ) : (
                    <div className="text-center py-20 text-muted-foreground">No file selected for analysis.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Settings</CardTitle>
                  <CardDescription>Configure the block allocation strategy.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Allocation Strategy</label>
                    <Select value={allocationStrategy} onValueChange={changeAllocationStrategy}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contiguous">Contiguous</SelectItem>
                        <SelectItem value="linked">Linked</SelectItem>
                        <SelectItem value="indexed">Indexed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Block Detail Dialog */}
      <Dialog open={blockDetailDialog} onOpenChange={setBlockDetailDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Block Details</DialogTitle>
            <DialogDescription>Information about the selected block.</DialogDescription>
          </DialogHeader>
          {clickedBlockInfo && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="blockIndex" className="text-right text-sm font-medium text-gray-700">
                  Block Index
                </label>
                <Input
                  type="text"
                  id="blockIndex"
                  value={clickedBlockInfo.blockIndex}
                  readOnly
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="status" className="text-right text-sm font-medium text-gray-700">
                  Status
                </label>
                <Input type="text" id="status" value={clickedBlockInfo.status} readOnly className="col-span-3" />
              </div>
              {clickedBlockInfo.filename && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="filename" className="text-right text-sm font-medium text-gray-700">
                    Filename
                  </label>
                  <Input type="text" id="filename" value={clickedBlockInfo.filename} readOnly className="col-span-3" />
                </div>
              )}
              {clickedBlockInfo.owner && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="ownerFilename" className="text-right text-sm font-medium text-gray-700">
                      Owner Filename
                    </label>
                    <Input
                      type="text"
                      id="ownerFilename"
                      value={clickedBlockInfo.owner.filename}
                      readOnly
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="ownerAllocationType" className="text-right text-sm font-medium text-gray-700">
                      Allocation Type
                    </label>
                    <Input
                      type="text"
                      id="ownerAllocationType"
                      value={clickedBlockInfo.owner.allocationType}
                      readOnly
                      className="col-span-3"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
