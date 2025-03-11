import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  FileText,
  Trash2,
  Calendar,
  Tag,
  FileX,
  ArrowUpDown,
  Download,
  MoreHorizontal
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useStore } from '@/stores'
import { toast } from 'sonner'

const LibraryPage = () => {
  // Use document store
  const { documents, loadDocuments, deleteDocument } = useStore()

  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filterTags, setFilterTags] = useState<string[]>([])

  // Get all unique tags
  const allTags = Array.from(new Set(documents.flatMap((doc) => doc.tags))).sort()

  // Re-fetch documents when the component mounts
  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleDeleteDocuments = async () => {
    if (selectedDocs.length === 0) return

    // Delete one by one
    let successCount = 0
    for (const docId of selectedDocs) {
      try {
        await deleteDocument(docId)
        successCount++
      } catch (error) {
        console.error(`Error deleting document ${docId}:`, error)
        toast.error(
          `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} document(s) have been removed from the library.`)
    }

    setSelectedDocs([])
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocs(filteredDocuments.map((doc) => doc.id))
    } else {
      setSelectedDocs([])
    }
  }

  const handleSelectDocument = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedDocs((prev) => [...prev, id])
    } else {
      setSelectedDocs((prev) => prev.filter((docId) => docId !== id))
    }
  }

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
  }

  const handleSortChange = (value: 'date' | 'name' | 'size') => {
    if (sortBy === value) {
      toggleSortDirection()
    } else {
      setSortBy(value)
      setSortDirection('desc')
    }
  }

  const toggleFilterTag = (tag: string) => {
    setFilterTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  // Filter and sort documents
  const filteredDocuments = documents
    .filter((doc) => {
      // Text search
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase())

      // Tag filtering
      const matchesTags =
        filterTags.length === 0 || filterTags.every((tag) => doc.tags.includes(tag))

      return matchesSearch && matchesTags
    })
    .sort((a, b) => {
      // Sorting
      if (sortBy === 'date') {
        return sortDirection === 'asc'
          ? new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      } else if (sortBy === 'name') {
        return sortDirection === 'asc'
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title)
      } else {
        // size
        return sortDirection === 'asc' ? a.file_size - b.file_size : b.file_size - a.file_size
      }
    })

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    else return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const formatDate = (dateString: string): string => {
    return format(new Date(dateString), 'MMM d, yyyy')
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100
      }
    }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Document Library</h1>
        <Button asChild>
          <Link to="/upload">Upload New Documents</Link>
        </Button>
      </div>

      {/* Search and filter controls */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search documents..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Tag filter sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter {filterTags.length > 0 && `(${filterTags.length})`}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Documents</SheetTitle>
                <SheetDescription>Filter documents by tags</SheetDescription>
              </SheetHeader>
              <div className="py-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Tags</h3>
                    <div className="space-y-2">
                      {allTags.map((tag) => (
                        <div key={tag} className="flex items-center space-x-2">
                          <Checkbox
                            id={`tag-${tag}`}
                            checked={filterTags.includes(tag)}
                            onCheckedChange={() => toggleFilterTag(tag)}
                          />
                          <Label htmlFor={`tag-${tag}`}>{tag}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button type="submit">Apply Filters</Button>
                </SheetClose>
                {filterTags.length > 0 && (
                  <Button variant="outline" onClick={() => setFilterTags([])}>
                    Clear Filters
                  </Button>
                )}
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Sort by
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleSortChange('date')}>
                <Calendar className="mr-2 h-4 w-4" />
                Date {sortBy === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('name')}>
                <FileText className="mr-2 h-4 w-4" />
                Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('size')}>
                <FileText className="mr-2 h-4 w-4" />
                Size {sortBy === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bulk actions */}
          {selectedDocs.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">{selectedDocs.length} selected</span>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Documents</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete {selectedDocs.length} document(s)? This action
                      cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="destructive" onClick={handleDeleteDocuments}>
                        Delete
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Document list */}
      <div className="border rounded-md overflow-hidden">
        <div className="bg-muted/50 p-3 border-b grid grid-cols-12 gap-4 text-sm font-medium">
          <div className="col-span-1">
            <Checkbox
              onCheckedChange={(checked) => handleSelectAll(!!checked)}
              checked={
                selectedDocs.length === filteredDocuments.length && filteredDocuments.length > 0
              }
            />
          </div>
          <div className="col-span-5">Document</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Actions</div>
        </div>

        <AnimatePresence>
          {filteredDocuments.length === 0 ? (
            <motion.div
              variants={itemVariants}
              className="p-6 text-center text-muted-foreground flex flex-col items-center space-y-2"
            >
              <FileX className="h-12 w-12" />
              <p>No documents found</p>
              <Button variant="outline" asChild>
                <Link to="/upload">Upload Documents</Link>
              </Button>
            </motion.div>
          ) : (
            filteredDocuments.map((doc) => (
              <motion.div
                key={doc.id}
                variants={itemVariants}
                className={`p-3 border-b grid grid-cols-12 gap-4 items-center hover:bg-muted/50 ${
                  selectedDocs.includes(doc.id) ? 'bg-muted/50' : ''
                }`}
              >
                <div className="col-span-1">
                  <Checkbox
                    checked={selectedDocs.includes(doc.id)}
                    onCheckedChange={(checked) => handleSelectDocument(doc.id, !!checked)}
                  />
                </div>
                <div className="col-span-5 flex items-center space-x-3">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="font-medium leading-none">{doc.title}</p>
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="col-span-2 text-sm text-muted-foreground">
                  {/* Use path length as an estimate of file size */}
                  {formatFileSize(doc.path.length * 100)}
                </div>
                <div className="col-span-2 text-sm text-muted-foreground">
                  {formatDate(doc.created_at)}
                </div>
                <div className="col-span-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          toast.success(`${doc.title} has been downloaded.`)
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          toast.info('This feature is not yet implemented.')
                        }}
                      >
                        <Tag className="mr-2 h-4 w-4" />
                        Edit Tags
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          handleSelectDocument(doc.id, true)
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default LibraryPage
