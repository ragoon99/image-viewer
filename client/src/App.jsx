import { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import { Folder, Search, Loader2, Image as ImageIcon, X, ChevronDown } from 'lucide-react'
import { useInView } from 'react-intersection-observer'
import ImageCard from './components/ImageCard'
import ImageModal from './components/ImageModal'

function App() {
  const [images, setImages] = useState([])
  const [totalImages, setTotalImages] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [filter, setFilter] = useState('')
  const [folderSearch, setFolderSearch] = useState('')
  const [dir, setDir] = useState('./images')
  const [recentDirs, setRecentDirs] = useState([])
  const [selectedFolders, setSelectedFolders] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [columnCount, setColumnCount] = useState(6)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('recentDirs')
    if (saved) {
      const parsed = JSON.parse(saved)
      setRecentDirs(parsed)
      if (parsed.length > 0) setDir(parsed[0])
    }
    const savedCols = localStorage.getItem('columnCount')
    if (savedCols) setColumnCount(parseInt(savedCols))

    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  const { ref, inView } = useInView()

  const getParentFolder = (path) => {
    const parts = path.split('/');
    return parts.slice(0, -1).join('/') || '/';
  }

  const saveToRecent = (newDir) => {
    const updated = [newDir, ...recentDirs.filter(d => d !== newDir)].slice(0, 5)
    setRecentDirs(updated)
    localStorage.setItem('recentDirs', JSON.stringify(updated))
  }

  const fetchImages = async (isNewDir = false) => {
    if (!dir) return
    
    // Abort previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    const targetPage = isNewDir ? 1 : page
    const limit = isNewDir ? 100 : 50
    setLoading(true)
    setError(null)

    try {
      const res = await axios.get(`http://localhost:3001/api/images`, {
        params: { dir, page: targetPage, limit },
        signal: abortControllerRef.current.signal
      })
      
      const resImages = res.data.images || []
      const newImages = isNewDir ? resImages : [...images, ...resImages]
      setImages(newImages)
      setHasMore(res.data.hasMore || false)
      setTotalImages(res.data.total || 0)
      
      if (isNewDir) {
        const folders = {}
        if (res.data.folders) {
          res.data.folders.forEach(f => {
            folders[f] = true
          })
        }
        setSelectedFolders(folders)
        saveToRecent(dir)
        setPage(2)
      } else {
        setPage(prev => prev + 1)
      }
    } catch (err) {
      if (axios.isCancel(err)) return

      const status = err.response?.status
      const message = err.response?.data?.error
      
      if (status === 404) {
        setError(`Directory "${dir}" not found.`)
      } else if (status === 400) {
        setError(message || 'Invalid directory path.')
      } else {
        setError('Connection failed. Is the server running on port 3001?')
      }

      if (isNewDir) {
        setImages([])
        setTotalImages(0)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (inView && hasMore && !loading) {
      fetchImages()
    }
  }, [inView])

  useEffect(() => {
    fetchImages(true)
  }, [])

  const uniqueFolders = useMemo(() => Object.keys(selectedFolders || {}).sort(), [selectedFolders])

  const filteredImages = useMemo(() => {
    return (images || []).filter(img => {
      const matchesSearch = (img.path || '').toLowerCase().includes(filter.toLowerCase()) ||
                           (img.name || '').toLowerCase().includes(filter.toLowerCase());
      const folderSelected = selectedFolders[getParentFolder(img.path)];
      return matchesSearch && folderSelected;
    })
  }, [images, filter, selectedFolders])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
              <ImageIcon size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Reactive Gallery
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="hidden lg:flex items-center gap-4 bg-gray-50 border border-gray-100 px-4 py-2 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Grid Density</span>
              <input 
                type="range" min="4" max="10" value={columnCount} 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setColumnCount(val);
                  localStorage.setItem('columnCount', val);
                }}
                className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-xs font-mono font-bold text-blue-600 w-4">{columnCount}</span>
            </div>

            <div className="flex-grow md:flex-none flex items-center gap-2">
              <div className="relative flex-grow min-w-[240px]">
                <input 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 pl-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm outline-none"
                  placeholder="Source directory..."
                  value={dir}
                  onChange={e => setDir(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchImages()}
                />
                <Folder className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              </div>

              {recentDirs.length > 0 && (
                <select 
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  onChange={(e) => setDir(e.target.value)}
                  value={dir}
                >
                  <option value="" disabled>Recent</option>
                  {recentDirs.map(d => (
                    <option key={d} value={d}>{d.split('/').pop() || d}</option>
                  ))}
                </select>
              )}
              
              <button 
                className="bg-gray-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-gray-200 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                onClick={() => fetchImages(true)}
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                Sync
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-8 flex flex-col lg:flex-row gap-10">
        {/* Sidebar */}
        <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-28">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Folder size={16} className="text-blue-500" />
                Directories
              </h2>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                {uniqueFolders.length}
              </span>
            </div>
            
            <div className="mb-5 relative">
              <input 
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 pl-9 text-xs focus:ring-2 focus:ring-blue-500/10 outline-none border-transparent focus:border-blue-500/20 transition-all"
                placeholder="Find folders..."
                value={folderSearch}
                onChange={e => setFolderSearch(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            </div>

            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {uniqueFolders.length > 0 ? (
                uniqueFolders
                  .filter(f => f.toLowerCase().includes(folderSearch.toLowerCase()))
                  .map(folder => (
                  <label key={folder} className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-xl cursor-pointer transition-all group">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/20 transition-all"
                      checked={selectedFolders[folder] || false}
                      onChange={() => setSelectedFolders(prev => ({ ...prev, [folder]: !prev[folder] }))}
                    />
                    <span className="text-xs text-gray-600 truncate group-hover:text-gray-900 font-medium">
                      {folder.split('/').pop() || folder}
                    </span>
                  </label>
                ))
              ) : (
                <div className="text-center py-8">
                  <Folder size={24} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-[10px] text-gray-400 font-medium">No directories found</p>
                </div>
              )}
            </div>

            {uniqueFolders.length > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-100 flex justify-between items-center px-1">
                <button 
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-bold transition-colors"
                  onClick={() => {
                    const all = { ...selectedFolders }; 
                    uniqueFolders.forEach(f => all[f] = true);
                    setSelectedFolders(all);
                  }}
                >
                  Select All
                </button>
                <div className="w-1 h-1 bg-gray-200 rounded-full" />
                <button 
                  className="text-[11px] text-gray-400 hover:text-gray-600 font-bold transition-colors"
                  onClick={() => {
                    const all = { ...selectedFolders }; 
                    uniqueFolders.forEach(f => all[f] = false);
                    setSelectedFolders(all);
                  }}
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-grow min-w-0">
          <div className="mb-10 relative">
            <input 
              className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 pl-14 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-base placeholder:text-gray-400"
              placeholder="Search through images..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <Search className="absolute left-5 top-4.5 h-6 w-6 text-gray-300" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 p-4 mb-8 text-red-700 rounded-2xl flex items-center gap-3">
              <div className="bg-red-100 p-1.5 rounded-lg text-red-600">
                <X size={18} />
              </div>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="flex items-center gap-2 mb-8 ml-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {images.length < totalImages ? `Loaded ${images.length} of ${totalImages}` : `${totalImages} total`} images
                {filter && ` • ${filteredImages.length} visible`}
              </p>
            </div>
          )}

          <div 
            className="grid gap-6 auto-rows-max" 
            style={{ 
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` 
            }}
          >
            {filteredImages.map((img, idx) => (
              <ImageCard 
                key={`${img.path}-${idx}`} 
                img={img} 
                onClick={setSelectedImage} 
              />
            ))}
          </div>

          {/* Infinite Scroll Sentinel */}
          {hasMore && (
            <div ref={ref} className="py-20 flex justify-center">
              {loading && <Loader2 className="animate-spin text-blue-600" size={32} />}
            </div>
          )}

          {!loading && filteredImages.length === 0 && (
            <div className="text-center py-32 bg-white rounded-[40px] border border-gray-100 shadow-sm">
              <div className="mx-auto h-20 w-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-200 mb-6">
                <ImageIcon size={40} strokeWidth={1} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Gallery Empty</h3>
              <p className="text-gray-400 mt-2 text-sm max-w-xs mx-auto">
                Try scanning a different directory or adjusting your filters.
              </p>
            </div>
          )}
        </div>
      </main>

      <ImageModal 
        selectedImage={selectedImage} 
        onClose={() => setSelectedImage(null)} 
      />
    </div>
  )
}

export default App
