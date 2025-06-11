import os
import json
import time
from datetime import datetime
import random
import math
import random
from typing import List, Dict, Tuple, Optional, Set

# Block size in bytes
BLOCK_SIZE = 4096  # 4KB blocks
# Default allocation strategy
DEFAULT_ALLOCATION_STRATEGY = "indexed"  # Options: "contiguous", "linked", "indexed"

class FileSystemNode:
    def __init__(self, name, node_type, parent=None):
        self.name = name
        self.type = node_type  # "file" or "directory"
        self.size = 0 if node_type == "directory" else 100  # Default file size
        self.parent = parent
        self.children = [] if node_type == "directory" else None
        self.created = datetime.now()
        self.modified = datetime.now()
        self.permissions = "rwxr-xr-x"  # Default permissions
        self.owner = "user"  # Default owner
        self.content = ""  # File content
        self.file_type = self._detect_file_type(name) if node_type == "file" else None
        # Block allocation information
        self.blocks = []  # List of block numbers used by this file
        self.start_block = None  # Starting block (for contiguous allocation)
        self.allocation_type = DEFAULT_ALLOCATION_STRATEGY
        
    def _detect_file_type(self, filename):
        """Detect file type based on extension"""
        if '.' not in filename:
            return "text"
            
        ext = filename.split('.')[-1].lower()
        
        # Text files
        if ext in ['txt', 'md', 'py', 'js', 'html', 'css', 'json', 'xml', 'csv']:
            return "text"
        # Images
        elif ext in ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']:
            return "image"
        # Videos
        elif ext in ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm']:
            return "video"
        # Audio
        elif ext in ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a']:
            return "audio"
        # Documents
        elif ext in ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']:
            return "document"
        # Archives
        elif ext in ['zip', 'rar', '7z', 'tar', 'gz']:
            return "archive"
        # Executables
        elif ext in ['exe', 'msi', 'deb', 'rpm', 'dmg']:
            return "executable"
        else:
            return "binary"
    
    def get_default_size_for_type(self):
        """Get default size based on file type"""
        if self.file_type == "text":
            return random.randint(100, 5000)  # 100B - 5KB
        elif self.file_type == "image":
            return random.randint(50000, 2000000)  # 50KB - 2MB
        elif self.file_type == "video":
            return random.randint(5000000, 50000000)  # 5MB - 50MB
        elif self.file_type == "audio":
            return random.randint(1000000, 10000000)  # 1MB - 10MB
        elif self.file_type == "document":
            return random.randint(10000, 500000)  # 10KB - 500KB
        elif self.file_type == "archive":
            return random.randint(100000, 10000000)  # 100KB - 10MB
        elif self.file_type == "executable":
            return random.randint(1000000, 100000000)  # 1MB - 100MB
        else:
            return random.randint(1000, 50000)  # 1KB - 50KB
        
    def to_dict(self):
        result = {
            "name": self.name,
            "type": self.type,
            "size": self.size,
            "created": self.created.isoformat(),
            "modified": self.modified.isoformat(),
            "permissions": self.permissions,
            "file_type": self.file_type,
            "owner": getattr(self, 'owner', 'user')  # Default owner
        }
        
        if self.type == "directory" and self.children:
            result["children"] = [child.to_dict() for child in self.children]
        
        return result
    
    @classmethod
    def from_dict(cls, data, parent=None):
        node = cls(data["name"], data["type"], parent)
        node.size = data["size"]
        node.created = datetime.fromisoformat(data["created"])
        node.modified = datetime.fromisoformat(data["modified"])
        node.permissions = data.get("permissions", "rwxr-xr-x")
        node.file_type = data.get("file_type")
        node.owner = data.get("owner", "user")
        
        if node.type == "directory" and "children" in data:
            node.children = [cls.from_dict(child, node) for child in data["children"]]
            
        return node

class FileSystem:
    def __init__(self, total_size=100000000):  # Default 100MB for better simulation
        # Create root directory
        self.root = FileSystemNode("/", "directory")
        self.current_path = ["/"]
        self.total_size = total_size
        self.used_size = 0
        # Block allocation
        self.total_blocks = math.ceil(total_size / BLOCK_SIZE)
        self.free_blocks = set(range(self.total_blocks))
        self.used_blocks = set()
        self.block_map = {}  # Maps block number to file node
        self.allocation_strategy = DEFAULT_ALLOCATION_STRATEGY  # Default strategy
        
        # Initialize block bitmap
        self.block_bitmap = [False] * self.total_blocks  # False = free, True = used
        
        # Initialize with some default directories and sample files
        self._mkdir("home")
        self.cd("home")
        self._mkdir("user")
        self.cd("user")
        
        # Create sample files for demonstration
        self._create_sample_files()
        
        self.cd("/")
        self._mkdir("etc")
        self._mkdir("var")
        self._mkdir("tmp")
        
        # Calculate initial disk usage
        self._update_disk_usage()
    
    def _create_sample_files(self):
        """Create sample files for demonstration"""
        # Text files
        self.touch("readme.txt", content="This is a sample readme file.\nWelcome to the file system simulator!")
        self.touch("notes.md", content="# My Notes\n\n- Important task 1\n- Important task 2")
        
        # Image files (simulated)
        self.touch("photo.jpg")
        self.touch("screenshot.png")
        
        # Document files
        self.touch("document.pdf")
        self.touch("presentation.pptx")
        
        # Create a documents folder
        self._mkdir("documents")
        self.cd("documents")
        self.touch("report.docx")
        self.touch("spreadsheet.xlsx")
        self.cd("..")
        
        # Create a media folder
        self._mkdir("media")
        self.cd("media")
        self.touch("video.mp4")
        self.touch("music.mp3")
        self.cd("..")
    
    def _find_node_by_path(self, path):
        """Find a node by path (absolute or relative)"""
        if not path:
            return self._get_current_directory()
            
        # Handle absolute paths
        if path.startswith("/"):
            parts = [p for p in path.split("/") if p]
            current = self.root
        else:
            # Handle relative paths
            current_dir = self._get_current_directory()
            if not current_dir:
                return None
                
            if path == ".":
                return current_dir
            elif path == "..":
                if current_dir == self.root:
                    return self.root
                return current_dir.parent
                
            parts = [p for p in path.split("/") if p]
            current = current_dir
            
        # Navigate through path parts
        for part in parts:
            if part == "":
                continue
            if part == ".":
                continue
            if part == "..":
                if current == self.root:
                    continue
                current = current.parent
                continue
                
            if current.type != "directory":
                return None
                
            found = False
            for child in current.children:
                if child.name == part:
                    current = child
                    found = True
                    break
                    
            if not found:
                return None
                
        return current
    
    def _get_current_directory(self):
        """Get the current directory node"""
        return self._find_node_by_path("/" + "/".join(self.current_path[1:]))
    
    def _update_disk_usage(self):
        """Recalculate disk usage"""
        def calculate_size(node):
            if node.type == "file":
                return node.size
            
            total = 0
            if node.children:
                for child in node.children:
                    child_size = calculate_size(child)
                    total += child_size
            
            node.size = total
            return total
            
        self.used_size = calculate_size(self.root)
        return self.used_size
    
    def _get_absolute_path(self, path=None):
        """Convert relative path to absolute path"""
        if not path or path == ".":
            return "/" + "/".join(self.current_path[1:])
        
        if path.startswith("/"):
            return path
            
        if path == "..":
            if len(self.current_path) > 1:
                return "/" + "/".join(self.current_path[1:-1])
            return "/"
            
        current = "/" + "/".join(self.current_path[1:])
        if current == "/":
            return "/" + path
        return current + "/" + path
    
    def pwd(self):
        """Print working directory"""
        if len(self.current_path) == 1:
            return "/"
        return "/" + "/".join(self.current_path[1:])
    
    def ls(self, path=None):
        """List directory contents"""
        target = self._find_node_by_path(path) if path else self._get_current_directory()
        
        if not target:
            return f"ls: {path}: No such file or directory"
            
        if target.type != "directory":
            return f"ls: {path}: Not a directory"
            
        result = []
        if target.children:
            for child in target.children:
                type_char = "d" if child.type == "directory" else "-"
                size_str = self._format_size(child.size).rjust(10)
                date_str = child.modified.strftime("%Y-%m-%d %H:%M")
                file_type = f"[{child.file_type}]" if child.file_type else ""
                result.append(f"{type_char}{child.permissions} {size_str} {date_str} {child.name} {file_type}")
        
        return "\n".join(result) if result else "Directory is empty"
    
    def _format_size(self, size):
        """Format file size in human readable format"""
        if size < 1024:
            return f"{size}B"
        elif size < 1024 * 1024:
            return f"{size/1024:.1f}KB"
        elif size < 1024 * 1024 * 1024:
            return f"{size/(1024*1024):.1f}MB"
        else:
            return f"{size/(1024*1024*1024):.1f}GB"
    
    def cat(self, filename):
        """Display file contents"""
        if not filename:
            return "cat: missing file operand"
            
        current_dir = self._get_current_directory()
        if not current_dir:
            return "cat: failed to read file"
            
        # Find the file
        target_file = None
        for child in current_dir.children:
            if child.name == filename:
                target_file = child
                break
                
        if not target_file:
            return f"cat: {filename}: No such file or directory"
            
        if target_file.type != "file":
            return f"cat: {filename}: Is a directory"
            
        # Handle different file types
        if target_file.file_type == "text":
            if target_file.content:
                return target_file.content
            else:
                return f"[Text file: {filename}]\nContent: Sample text content for {filename}"
        elif target_file.file_type == "image":
            return f"[Image file: {filename}]\nType: {target_file.file_type}\nSize: {self._format_size(target_file.size)}\nDimensions: 1920x1080 (simulated)\nFormat: {filename.split('.')[-1].upper()}"
        elif target_file.file_type == "video":
            return f"[Video file: {filename}]\nType: {target_file.file_type}\nSize: {self._format_size(target_file.size)}\nDuration: 00:05:30 (simulated)\nResolution: 1920x1080\nCodec: H.264"
        elif target_file.file_type == "audio":
            return f"[Audio file: {filename}]\nType: {target_file.file_type}\nSize: {self._format_size(target_file.size)}\nDuration: 00:03:45 (simulated)\nBitrate: 320 kbps\nFormat: {filename.split('.')[-1].upper()}"
        elif target_file.file_type == "document":
            return f"[Document file: {filename}]\nType: {target_file.file_type}\nSize: {self._format_size(target_file.size)}\nPages: 15 (simulated)\nFormat: {filename.split('.')[-1].upper()}\nContent: Business document with charts and tables"
        elif target_file.file_type == "archive":
            return f"[Archive file: {filename}]\nType: {target_file.file_type}\nSize: {self._format_size(target_file.size)}\nCompressed size: {self._format_size(target_file.size)}\nFiles: 25 (simulated)\nCompression ratio: 65%"
        elif target_file.file_type == "executable":
            return f"[Executable file: {filename}]\nType: {target_file.file_type}\nSize: {self._format_size(target_file.size)}\nArchitecture: x86_64\nVersion: 1.0.0\nDescription: Sample application"
        else:
            return f"[Binary file: {filename}]\nType: {target_file.file_type or 'unknown'}\nSize: {self._format_size(target_file.size)}\nBinary data cannot be displayed as text"
    
    def file_info(self, filename):
        """Show detailed file information"""
        if not filename:
            return "file: missing file operand"
            
        current_dir = self._get_current_directory()
        if not current_dir:
            return "file: failed to read file"
            
        # Find the file
        target_file = None
        for child in current_dir.children:
            if child.name == filename:
                target_file = child
                break
                
        if not target_file:
            return f"file: {filename}: No such file or directory"
            
        info = []
        info.append(f"File: {target_file.name}")
        info.append(f"Type: {target_file.type}")
        if target_file.file_type:
            info.append(f"File Type: {target_file.file_type}")
        info.append(f"Size: {self._format_size(target_file.size)} ({target_file.size} bytes)")
        info.append(f"Permissions: {target_file.permissions}")
        info.append(f"Created: {target_file.created.strftime('%Y-%m-%d %H:%M:%S')}")
        info.append(f"Modified: {target_file.modified.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if target_file.type == "directory" and target_file.children:
            info.append(f"Contains: {len(target_file.children)} items")
            
        return "\n".join(info)
    
    def chmod(self, name, permissions):
        """Change file permissions"""
        if not name:
            return "chmod: missing operand"
            
        if not permissions:
            return "chmod: missing permissions"
            
        current_dir = self._get_current_directory()
        if not current_dir:
            return "chmod: failed to change permissions"
            
        # Find the target
        target = None
        for child in current_dir.children:
            if child.name == name:
                target = child
                break
                
        if not target:
            return f"chmod: cannot access '{name}': No such file or directory"
            
        # Validate permissions format (should be like rwxr-xr-x or 755)
        if len(permissions) == 3 and permissions.isdigit():
            # Convert octal notation to rwx format
            octal_perms = permissions
            rwx_perms = ""
            
            for digit in octal_perms:
                val = int(digit)
                rwx_perms += "r" if val & 4 else "-"
                rwx_perms += "w" if val & 2 else "-"
                rwx_perms += "x" if val & 1 else "-"
                
            target.permissions = rwx_perms
            
        elif len(permissions) == 9 and all(c in "rwx-" for c in permissions):
            # Direct rwx format
            target.permissions = permissions
            
        else:
            return f"chmod: invalid mode: '{permissions}'"
            
        target.modified = datetime.now()
        return f"Permissions changed for '{name}' to {target.permissions}"
    
    def chown(self, name, owner):
        """Change file ownership (simulated)"""
        if not name:
            return "chown: missing operand"
            
        if not owner:
            return "chown: missing owner"
            
        current_dir = self._get_current_directory()
        if not current_dir:
            return "chown: failed to change ownership"
            
        # Find the target
        target = None
        for child in current_dir.children:
            if child.name == name:
                target = child
                break
                
        if not target:
            return f"chown: cannot access '{name}': No such file or directory"
            
        # Add owner field if it doesn't exist
        if not hasattr(target, 'owner'):
            target.owner = "user"
            
        target.owner = owner
        target.modified = datetime.now()
        return f"Owner changed for '{name}' to {owner}"
    
    def cd(self, path):
        """Change directory"""
        if not path:
            # Default to /home/user
            self.current_path = ["/", "home", "user"]
            return ""
            
        if path == "/":
            self.current_path = ["/"]
            return ""
            
        target_path = self._get_absolute_path(path)
        target = self._find_node_by_path(target_path)
        
        if not target:
            return f"cd: {path}: No such file or directory"
            
        if target.type != "directory":
            return f"cd: {path}: Not a directory"
            
        # Update current path
        if target_path == "/":
            self.current_path = ["/"]
        else:
            self.current_path = [""] + [p for p in target_path.split("/") if p]
            
        return ""
    
    def _mkdir(self, name):
        """Internal mkdir without error messages"""
        current_dir = self._get_current_directory()
        if not current_dir:
            return False
            
        # Check if directory already exists
        for child in current_dir.children:
            if child.name == name:
                return False
                
        # Create new directory
        new_dir = FileSystemNode(name, "directory", current_dir)
        current_dir.children.append(new_dir)
        current_dir.modified = datetime.now()
        
        return True
    
    def mkdir(self, name):
        """Create directory"""
        if not name:
            return "mkdir: missing operand"
            
        current_dir = self._get_current_directory()
        if not current_dir:
            return "mkdir: failed to create directory"
            
        # Check if directory already exists
        for child in current_dir.children:
            if child.name == name:
                return f"mkdir: cannot create directory '{name}': File exists"
                
        # Create new directory
        new_dir = FileSystemNode(name, "directory", current_dir)
        current_dir.children.append(new_dir)
        current_dir.modified = datetime.now()
        
        self._update_disk_usage()
        return f"Directory '{name}' created"
    
    def _allocate_blocks(self, file_node, size_needed):
        """Allocate blocks for a file based on the current allocation strategy"""
        num_blocks_needed = math.ceil(size_needed / BLOCK_SIZE)
        
        if num_blocks_needed == 0:
            num_blocks_needed = 1  # Always allocate at least one block
            
        if self.allocation_strategy == "contiguous":
            return self._allocate_contiguous(file_node, num_blocks_needed)
        elif self.allocation_strategy == "linked":
            return self._allocate_linked(file_node, num_blocks_needed)
        else:  # Default to indexed
            return self._allocate_indexed(file_node, num_blocks_needed)
    
    def _allocate_contiguous(self, file_node, num_blocks):
        """Allocate contiguous blocks for a file"""
        # Find a contiguous run of free blocks
        best_start = None
        best_run_length = 0
        current_start = None
        current_run_length = 0
        
        for i in range(self.total_blocks):
            if i in self.free_blocks:
                if current_start is None:
                    current_start = i
                current_run_length += 1
                
                if current_run_length >= num_blocks and (best_start is None or current_run_length < best_run_length):
                    best_start = current_start
                    best_run_length = current_run_length
            else:
                current_start = None
                current_run_length = 0
        
        if best_start is None:
            raise Exception(f"Not enough contiguous space for file of size {num_blocks * BLOCK_SIZE} bytes")
        
        # Allocate the blocks
        allocated_blocks = list(range(best_start, best_start + num_blocks))
        file_node.blocks = allocated_blocks
        file_node.start_block = best_start
        file_node.allocation_type = "contiguous"
        
        # Update block tracking
        for block in allocated_blocks:
            self.free_blocks.remove(block)
            self.used_blocks.add(block)
            self.block_bitmap[block] = True
            self.block_map[block] = file_node
            
        return allocated_blocks
    
    def _allocate_linked(self, file_node, num_blocks):
        """Allocate linked blocks for a file"""
        if len(self.free_blocks) < num_blocks:
            raise Exception(f"Not enough space for file of size {num_blocks * BLOCK_SIZE} bytes")
        
        # Take random blocks from free blocks
        allocated_blocks = []
        for _ in range(num_blocks):
            block = random.choice(list(self.free_blocks))
            allocated_blocks.append(block)
            self.free_blocks.remove(block)
            self.used_blocks.add(block)
            self.block_bitmap[block] = True
            self.block_map[block] = file_node
        
        file_node.blocks = allocated_blocks
        file_node.allocation_type = "linked"
        return allocated_blocks
    
    def _allocate_indexed(self, file_node, num_blocks):
        """Allocate indexed blocks for a file"""
        if len(self.free_blocks) < num_blocks:
            raise Exception(f"Not enough space for file of size {num_blocks * BLOCK_SIZE} bytes")
        
        # Take blocks from free blocks (can be non-contiguous)
        available_blocks = list(self.free_blocks)
        allocated_blocks = available_blocks[:num_blocks]
        
        file_node.blocks = allocated_blocks
        file_node.allocation_type = "indexed"
        
        # Update block tracking
        for block in allocated_blocks:
            self.free_blocks.remove(block)
            self.used_blocks.add(block)
            self.block_bitmap[block] = True
            self.block_map[block] = file_node
            
        return allocated_blocks
    
    def _free_blocks(self, file_node):
        """Free all blocks used by a file"""
        if not hasattr(file_node, 'blocks') or not file_node.blocks:
            return
            
        for block in file_node.blocks:
            if block in self.used_blocks:
                self.used_blocks.remove(block)
                self.free_blocks.add(block)
                self.block_bitmap[block] = False
                if block in self.block_map:
                    del self.block_map[block]
        
        file_node.blocks = []
        file_node.start_block = None
    
    def set_allocation_strategy(self, strategy):
        """Set the allocation strategy for new files"""
        if strategy not in ["contiguous", "linked", "indexed"]:
            raise ValueError("Invalid allocation strategy. Choose from: contiguous, linked, indexed")
        self.allocation_strategy = strategy
        return f"Allocation strategy set to {strategy}"
    
    def get_block_info(self):
        """Get information about block allocation"""
        return {
            "total_blocks": self.total_blocks,
            "used_blocks": len(self.used_blocks),
            "free_blocks": len(self.free_blocks),
            "block_size": BLOCK_SIZE,
            "bitmap": self.block_bitmap,
            "fragmentation_index": self._calculate_fragmentation()
        }
    
    def get_file_blocks(self, filename):
        """Get blocks used by a specific file"""
        current_dir = self._get_current_directory()
        if not current_dir:
            return "Failed to get current directory"
            
        # Find the file
        target_file = None
        for child in current_dir.children:
            if child.name == filename:
                target_file = child
                break
                
        if not target_file:
            return f"File '{filename}' not found"
            
        if target_file.type != "file":
            return f"'{filename}' is not a file"
            
        if not hasattr(target_file, 'blocks') or not target_file.blocks:
            return f"File '{filename}' has no block allocation information"
            
        return {
            "filename": filename,
            "size": target_file.size,
            "blocks": target_file.blocks,
            "allocation_type": target_file.allocation_type,
            "start_block": target_file.start_block,
            "block_count": len(target_file.blocks)
        }
    
    def _calculate_fragmentation(self):
        """Calculate a fragmentation index (0-100)"""
        if len(self.used_blocks) == 0:
            return 0
            
        # Count contiguous runs of used blocks
        runs = 0
        in_run = False
        
        for i in range(self.total_blocks):
            if i in self.used_blocks:
                if not in_run:
                    runs += 1
                    in_run = True
            else:
                in_run = False
                
        # Perfect case: all used blocks in one run
        # Worst case: alternating used/free blocks
        max_possible_runs = min(len(self.used_blocks), len(self.free_blocks) + 1)
        
        if max_possible_runs <= 1:
            return 0
            
        # Scale to 0-100
        fragmentation = ((runs - 1) / (max_possible_runs - 1)) * 100
        return round(fragmentation)
    
    def touch(self, name, size=None, content="", file_type=None):
        """Create file or update timestamp"""
        if not name:
            return "touch: missing file operand"
        
        current_dir = self._get_current_directory()
        if not current_dir:
            return "touch: failed to create file"
        
        # Check if file already exists
        for child in current_dir.children:
            if child.name == name:
                child.modified = datetime.now()
                return f"File '{name}' timestamp updated"
            
        new_file = FileSystemNode(name, "file", current_dir)
        
        # Calculate file size based on content, type, or default
        if content:
            file_size = len(content.encode('utf-8'))
            new_file.content = content
        elif size is not None:
            file_size = size
        else:
            # Use default size based on file type
            file_size = new_file.get_default_size_for_type()
        
        # Check if there's enough space
        if self.used_size + file_size > self.total_size:
            return "touch: cannot create file: Disk full"
        
        new_file.size = file_size
        
        # Set content for text files if not provided
        if new_file.file_type == "text" and not content:
            new_file.content = f"Sample content for {name}\nCreated at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        
        # Allocate blocks for the file
        try:
            self._allocate_blocks(new_file, file_size)
        except Exception as e:
            return f"touch: cannot create file: {str(e)}"
        
        current_dir.children.append(new_file)
        current_dir.modified = datetime.now()
        
        self._update_disk_usage()
        return f"File '{name}' created ({self._format_size(file_size)})"
    
    def rm(self, name, recursive=False):
        """Remove file or directory"""
        if not name:
            return "rm: missing operand"
            
        current_dir = self._get_current_directory()
        if not current_dir:
            return "rm: failed to remove"
            
        # Find the target
        target_index = None
        for i, child in enumerate(current_dir.children):
            if child.name == name:
                target_index = i
                break
                
        if target_index is None:
            return f"rm: cannot remove '{name}': No such file or directory"
            
        target = current_dir.children[target_index]
        
        # Check if it's a directory and not empty
        if target.type == "directory" and target.children and not recursive:
            return f"rm: cannot remove '{name}': Is a directory, use -r for recursive removal"
            
        # Free blocks if it's a file
        if target.type == "file":
            self._free_blocks(target)
        elif target.type == "directory" and recursive:
            # Recursively free blocks for all files in the directory
            self._free_blocks_recursive(target)
            
        # Remove the target
        current_dir.children.pop(target_index)
        current_dir.modified = datetime.now()
        
        self._update_disk_usage()
        return f"'{name}' removed"
    
    def _free_blocks_recursive(self, dir_node):
        """Recursively free blocks for all files in a directory"""
        if not dir_node.children:
            return
            
        for child in dir_node.children:
            if child.type == "file":
                self._free_blocks(child)
            elif child.type == "directory":
                self._free_blocks_recursive(child)
    
    def df(self):
        """Show disk usage"""
        used_mb = self.used_size / (1024 * 1024)
        total_mb = self.total_size / (1024 * 1024)
        free_mb = (self.total_size - self.used_size) / (1024 * 1024)
        used_percent = (self.used_size / self.total_size) * 100
        
        return [
            "Filesystem     Size  Used Avail Use%",
            f"/dev/sda1      {total_mb:.1f}M  {used_mb:.1f}M  {free_mb:.1f}M  {used_percent:.1f}%"
        ]
    
    def tree(self, node=None, prefix=""):
        """Show directory tree"""
        if node is None:
            node = self.root
            result = ["/"]
        else:
            result = []
            
        if node.type == "directory" and node.children:
            for i, child in enumerate(node.children):
                is_last = i == len(node.children) - 1
                size_info = f" ({self._format_size(child.size)})" if child.type == "file" else ""
                result.append(f"{prefix}{'└── ' if is_last else '├── '}{child.name}{size_info}")
                
                if child.type == "directory":
                    new_prefix = prefix + ("    " if is_last else "│   ")
                    child_result = self.tree(child, new_prefix)
                    result.extend(child_result)
                    
        return result
    
    def save_state(self, filename="filesystem_state.json"):
        """Save the file system state to a JSON file"""
        state = {
            "root": self.root.to_dict(),
            "current_path": self.current_path,
            "total_size": self.total_size,
            "used_size": self.used_size
        }
        
        with open(filename, "w") as f:
            json.dump(state, f, indent=2)
            
        return f"File system state saved to {filename}"
    
    def load_state(self, filename="filesystem_state.json"):
        """Load the file system state from a JSON file"""
        try:
            with open(filename, "r") as f:
                state = json.load(f)
                
            self.root = FileSystemNode.from_dict(state["root"])
            self.current_path = state["current_path"]
            self.total_size = state["total_size"]
            self.used_size = state["used_size"]
            
            return f"File system state loaded from {filename}"
        except Exception as e:
            return f"Error loading file system state: {str(e)}"
    
    def find(self, name, path=None):
        """Find files/directories by name"""
        start_node = self._find_node_by_path(path) if path else self.root
        if not start_node:
            return f"find: '{path}': No such file or directory"
            
        results = []
        
        def search(node, current_path):
            if node.name == name:
                results.append(current_path + "/" + node.name if current_path else "/" + node.name)
                
            if node.type == "directory" and node.children:
                for child in node.children:
                    child_path = current_path + "/" + node.name if current_path else "/" + node.name
                    if child_path == "//":
                        child_path = ""
                    search(child, child_path)
        
        search(start_node, "")
        
        if not results:
            return f"No files found matching '{name}'"
        return "\n".join(results)

# Example usage
if __name__ == "__main__":
    fs = FileSystem()
    
    print("Initial directory structure:")
    print(fs.ls())
    
    print("\nCreating some files and directories:")
    print(fs.mkdir("documents"))
    print(fs.cd("documents"))
    print(fs.touch("report.txt", content="This is a detailed report about the project."))
    print(fs.touch("photo.jpg"))  # Will get default image size
    print(fs.touch("video.mp4"))  # Will get default video size
    
    print("\nCurrent directory:")
    print(fs.pwd())
    
    print("\nListing files:")
    print(fs.ls())
    
    print("\nViewing file content:")
    print(fs.cat("report.txt"))
    print("\n" + "="*50 + "\n")
    print(fs.cat("photo.jpg"))
    
    print("\nFile information:")
    print(fs.file_info("video.mp4"))
    
    print("\nDisk usage:")
    for line in fs.df():
        print(line)
