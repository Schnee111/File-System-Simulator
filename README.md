# File System Simulator

Simulasi Sistem Operasi untuk Manajemen File - Tugas Mata Kuliah Sistem Operasi

## 📋 Deskripsi

File System Simulator adalah aplikasi simulasi sistem file yang meniru fungsionalitas sistem operasi Unix/Linux. Aplikasi ini dibuat untuk membantu memahami konsep manajemen file dalam sistem operasi, termasuk struktur direktori, permissions, dan operasi file dasar.

## 🏗️ Arsitektur

Project ini menggunakan arsitektur full-stack dengan pemisahan yang jelas antara backend dan frontend:

### Backend (Python + FastAPI)
- **Core Logic**: Implementasi sistem file dengan struktur tree
- **API Server**: RESTful API untuk komunikasi dengan frontend
- **File Operations**: Simulasi operasi file seperti create, read, update, delete
- **Permission System**: Implementasi permission management seperti Unix/Linux
- **Disk Management**: Simulasi penggunaan disk dan quota

### Frontend (Next.js + React)
- **Modern UI**: Interface yang responsif dan user-friendly
- **File Explorer**: Visualisasi struktur direktori dengan tree view
- **Terminal Emulator**: Command line interface untuk interaksi langsung
- **Real-time Updates**: Sinkronisasi real-time antara GUI dan terminal
- **Interactive Dialogs**: Modal untuk file operations dan permission management

## ✨ Fitur Utama

### 🗂️ File Management
- **File Operations**: Create, read, update, delete files dan directories
- **Multiple File Types**: Support untuk text, image, video, audio, document, archive, executable
- **File Content**: Kemampuan untuk menyimpan dan menampilkan content file
- **File Size Simulation**: Simulasi ukuran file yang realistis berdasarkan type

### 🔍 File Explorer
- **Tree View**: Visualisasi hierarki direktori
- **Double-click to Open**: Double-click file untuk preview content
- **File Icons**: Icon yang berbeda untuk setiap type file
- **Drag & Drop Ready**: Struktur siap untuk implementasi drag & drop

### 💻 Terminal Interface
- **Command Line**: Full command line interface
- **Auto-scroll**: Terminal otomatis scroll ke output terbaru
- **Command History**: History command yang telah dijalankan
- **Real-time Execution**: Eksekusi command secara real-time

### 🛡️ Permission System
- **Unix-style Permissions**: Implementasi permission rwx (read, write, execute)
- **Octal & Symbolic**: Support format octal (755) dan symbolic (rwxr-xr-x)
- **Owner Management**: Kemampuan mengubah owner file/directory
- **Permission Dialog**: GUI untuk mengubah permissions dengan mudah
- **Permission Validation**: Validasi input dan preview real-time

### 📊 Disk Management
- **Disk Usage Monitoring**: Real-time monitoring penggunaan disk
- **Space Calculation**: Kalkulasi otomatis ukuran file dan directory
- **Quota Simulation**: Simulasi batasan disk space
- **Visual Progress**: Progress bar untuk visualisasi penggunaan disk

## Cara Menjalankan

### Prerequisites
- Python 3.7+
- Node.js 16+
- npm atau yarn

### 1. Setup Backend (Python)

\`\`\`bash
# Clone repository
git clone <repository-url>
cd file-system-simulator

# Install Python dependencies
pip install fastapi uvicorn

# Jalankan API server
python scripts/api.py
\`\`\`

Backend akan berjalan di `http://localhost:8000`

### 2. Setup Frontend (Next.js)

\`\`\`bash
# Install Node.js dependencies
npm install
# atau
yarn install

# Jalankan development server
npm run dev
# atau
yarn dev
\`\`\`

Frontend akan berjalan di `http://localhost:3000`

### 3. Akses Aplikasi

1. Buka browser dan akses `http://localhost:3000`
2. Pastikan backend Python sudah running
3. Klik "Connect" untuk menghubungkan ke backend
4. Mulai eksplorasi file system simulator!

## 📖 Command Reference

### File Operations
\`\`\`bash
ls [path]              # List directory contents
ls -la                 # List with detailed information
cd <path>              # Change directory
pwd                    # Print working directory
mkdir <name>           # Create directory
touch <name>           # Create file
rm <name>              # Remove file
rm -r <name>           # Remove directory recursively
\`\`\`

### File Content
\`\`\`bash
cat <filename>         # Display file contents
file <filename>        # Show file information
\`\`\`

### Permission Management
\`\`\`bash
chmod <perms> <file>   # Change file permissions
                       # Examples: chmod 755 file.txt
                       #          chmod rwxr-xr-x file.txt
chown <owner> <file>   # Change file owner
\`\`\`

### System Information
\`\`\`bash
df                     # Show disk usage
tree                   # Show directory tree
find <name> [path]     # Find files by name
help                   # Show available commands
\`\`\`

## 🎯 Cara Menggunakan

### File Explorer
1. **Navigasi**: Klik folder untuk expand/collapse
2. **Open File**: Double-click file untuk preview content
3. **Change Permissions**: Klik icon shield (🛡️) untuk mengubah permissions
4. **Delete**: Klik icon trash untuk menghapus file/folder

### Terminal
1. **Command Input**: Ketik command di terminal prompt
2. **Execute**: Tekan Enter atau klik "Execute"
3. **Auto-scroll**: Terminal otomatis scroll ke output terbaru
4. **Command History**: Gunakan arrow keys untuk history (coming soon)

### Permission Management
1. **Access Dialog**: Klik shield icon atau "Permissions" button
2. **Choose Mode**: Pilih Symbolic (rwxr-xr-x) atau Octal (755)
3. **Set Permissions**: Input permissions baru
4. **Change Owner**: Ubah owner jika diperlukan
5. **Apply**: Klik "Apply Changes"

### File Creation
1. **New File**: Klik "New File" button
2. **Choose Type**: Pilih type file (text, image, video, dll)
3. **Enter Content**: Untuk text file, masukkan content
4. **Auto-sizing**: Non-text file akan mendapat ukuran otomatis

## 🔧 Konfigurasi

### Backend Configuration
- **Port**: Default 8000, bisa diubah di `scripts/api.py`
- **Disk Size**: Default 100MB, bisa diubah di `FileSystem.__init__()`
- **CORS**: Configured untuk development, sesuaikan untuk production

### Frontend Configuration
- **API URL**: Default `http://localhost:8000`, bisa diubah di UI
- **Auto-connect**: Bisa dikonfigurasi untuk auto-connect ke backend

## 📁 Struktur Project

\`\`\`
file-system-simulator/
├── front/                   # GUI ddengan next js
|   ├── app/
│   |   ├── page.tsx         # Main React component
│   |   ├── layout.tsx       # App layout
│   |   └── globals.css      # Global styles
|   ├── components/
│   |   └── ui/              # Shadcn UI components
|   └── package.json            # Node.js dependencies
|
├── backend/
│   ├── api.py               # FastAPI backend server
│   ├── file_system.py       # Core file system logic
|   └── requirements.txt         # Python dependencies
|
└── README.md               # Documentation
\`\`\`

## 🎨 Teknologi yang Digunakan

### Backend
- **Python 3.7+**: Core programming language
- **FastAPI**: Modern web framework untuk API
- **Uvicorn**: ASGI server untuk FastAPI
- **Pydantic**: Data validation dan serialization

### Frontend
- **Next.js 14**: React framework dengan App Router
- **React 18**: UI library dengan hooks
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: Modern UI component library
- **Lucide React**: Icon library

## 🔮 Fitur Mendatang

- [ ] **File Search**: Search functionality untuk mencari file
- [ ] **File Editing**: In-place editing untuk text files
- [ ] **Drag & Drop**: Drag & drop untuk move/copy files
- [ ] **Context Menu**: Right-click context menu
- [ ] **File Thumbnails**: Preview thumbnail untuk image files
- [ ] **Command History**: Navigation dengan arrow keys di terminal
- [ ] **Multi-user Support**: Simulasi multiple users
- [ ] **File Compression**: Simulasi file compression/decompression
- [ ] **Symbolic Links**: Support untuk symbolic links
- [ ] **File Backup**: Backup dan restore functionality

## 🤝 Kontribusi

Project ini dibuat untuk tujuan edukasi. Kontribusi dan saran sangat diterima:

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📝 Lisensi

Project ini dibuat untuk keperluan akademik dan pembelajaran.

## 👥 Tim Pengembang

Dikembangkan untuk Tugas Mata Kuliah Sistem Operasi

---

**Note**: Ini adalah simulasi sistem file untuk tujuan pembelajaran. Tidak ada file yang benar-benar dibuat di sistem file host.