from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import json
import os
from file_system import FileSystem
import base64

app = FastAPI(title="File System Simulator API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your Next.js domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize file system
fs = FileSystem()

# Data models
class CommandRequest(BaseModel):
    command: str
    args: Optional[str] = ""

class FileSystemNode(BaseModel):
    name: str
    type: str
    size: int
    children: Optional[List[Any]] = None
    created: str
    modified: str
    permissions: Optional[str] = None
    file_type: Optional[str] = None

class FileSystemState(BaseModel):
    root: FileSystemNode
    current_path: List[str]
    total_size: int
    used_size: int

class CommandResponse(BaseModel):
    result: str
    state: FileSystemState

class CreateFileRequest(BaseModel):
    name: str
    content: Optional[str] = ""
    file_type: Optional[str] = None

class CreateDirectoryRequest(BaseModel):
    name: str

class DeleteRequest(BaseModel):
    name: str
    recursive: Optional[bool] = False

class PermissionRequest(BaseModel):
    name: str
    permissions: str
    owner: Optional[str] = None

# Helper function to convert FileSystem node to dict
def node_to_dict(node):
    result = {
        "name": node.name,
        "type": node.type,
        "size": node.size,
        "created": node.created.isoformat(),
        "modified": node.modified.isoformat(),
        "permissions": node.permissions,
        "file_type": node.file_type
    }
    
    if node.type == "directory" and node.children:
        result["children"] = [node_to_dict(child) for child in node.children]
    
    return result

# Helper function to get current state
def get_current_state():
    return {
        "root": node_to_dict(fs.root),
        "current_path": fs.current_path,
        "total_size": fs.total_size,
        "used_size": fs.used_size
    }

@app.get("/")
def read_root():
    return {"message": "File System Simulator API"}

@app.get("/state")
def get_state():
    return get_current_state()

@app.post("/command")
def execute_command(command_req: CommandRequest):
    cmd = command_req.command.lower()
    args = command_req.args
    
    result = ""
    
    try:
        if cmd == "ls":
            result = fs.ls(args)
        elif cmd == "cd":
            result = fs.cd(args)
        elif cmd == "pwd":
            result = fs.pwd()
        elif cmd == "mkdir":
            result = fs.mkdir(args)
        elif cmd == "touch":
            parts = args.split()
            if len(parts) > 1 and parts[1].isdigit():
                result = fs.touch(parts[0], int(parts[1]))
            else:
                result = fs.touch(args)
        elif cmd == "rm":
            parts = args.split()
            if len(parts) > 1 and parts[0] == "-r":
                result = fs.rm(parts[1], recursive=True)
            else:
                result = fs.rm(args)
        elif cmd == "cat":
            result = fs.cat(args)
        elif cmd == "file":
            result = fs.file_info(args)
        elif cmd == "df":
            result = "\n".join(fs.df())
        elif cmd == "tree":
            result = "\n".join(fs.tree())
        elif cmd == "find":
            parts = args.split()
            if not parts:
                result = "find: missing operand"
            else:
                name = parts[0]
                path = parts[1] if len(parts) > 1 else None
                result = fs.find(name, path)
        elif cmd == "chmod":
            parts = args.split()
            if len(parts) < 2:
                result = "chmod: missing operand"
            else:
                permissions = parts[0]
                filename = parts[1]
                result = fs.chmod(filename, permissions)
        elif cmd == "chown":
            parts = args.split()
            if len(parts) < 2:
                result = "chown: missing operand"
            else:
                owner = parts[0]
                filename = parts[1]
                result = fs.chown(filename, owner)
        elif cmd == "help":
            result = (
                "Available commands:\n"
                "  ls [path]          - List directory contents\n"
                "  cd <path>          - Change directory\n"
                "  mkdir <name>       - Create directory\n"
                "  touch <name>       - Create file\n"
                "  rm [-r] <name>     - Remove file/directory\n"
                "  cat <file>         - Display file contents\n"
                "  file <name>        - Show file information\n"
                "  chmod <perms> <file> - Change file permissions\n"
                "  chown <owner> <file> - Change file owner\n"
                "  pwd                - Print working directory\n"
                "  df                 - Show disk usage\n"
                "  tree               - Show directory tree\n"
                "  find <name> [path] - Find files by name\n"
            )
        else:
            result = f"{cmd}: command not found"
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return {
        "result": result,
        "state": get_current_state()
    }

@app.get("/reset")
def reset_filesystem():
    global fs
    fs = FileSystem()
    return {"message": "File system reset", "state": get_current_state()}

@app.post("/create-file")
def create_file(request: CreateFileRequest):
    try:
        # Calculate size based on content or file type
        if request.content:
            content_size = len(request.content.encode('utf-8'))
            result = fs.touch(request.name, content_size, request.content)
        else:
            # Let the file system determine size based on file type
            result = fs.touch(request.name)
        
        return {
            "result": result,
            "state": get_current_state()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/create-directory")
def create_directory(request: CreateDirectoryRequest):
    try:
        result = fs.mkdir(request.name)
        return {
            "result": result,
            "state": get_current_state()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/delete")
def delete_item(request: DeleteRequest):
    try:
        result = fs.rm(request.name, request.recursive)
        return {
            "result": result,
            "state": get_current_state()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/change-permissions")
def change_permissions(request: PermissionRequest):
    try:
        result = fs.chmod(request.name, request.permissions)
        
        # Also change owner if provided
        if request.owner:
            owner_result = fs.chown(request.name, request.owner)
            result += "\n" + owner_result
            
        return {
            "result": result,
            "state": get_current_state()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/navigate")
def navigate_to_path(request: dict):
    try:
        path = request.get("path", "")
        result = fs.cd(path)
        return {
            "result": result,
            "state": get_current_state()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/file-types")
def get_file_types():
    return {
        "file_types": [
            {"value": "text", "label": "Text File (.txt, .md, .py)", "extensions": ["txt", "md", "py", "js", "html", "css", "json"]},
            {"value": "image", "label": "Image File (.jpg, .png, .gif)", "extensions": ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"]},
            {"value": "video", "label": "Video File (.mp4, .avi, .mkv)", "extensions": ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm"]},
            {"value": "audio", "label": "Audio File (.mp3, .wav, .flac)", "extensions": ["mp3", "wav", "flac", "aac", "ogg", "m4a"]},
            {"value": "document", "label": "Document (.pdf, .docx, .xlsx)", "extensions": ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]},
            {"value": "archive", "label": "Archive (.zip, .rar, .7z)", "extensions": ["zip", "rar", "7z", "tar", "gz"]},
            {"value": "executable", "label": "Executable (.exe, .msi, .deb)", "extensions": ["exe", "msi", "deb", "rpm", "dmg"]},
        ]
    }

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
