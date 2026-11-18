import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import axios from 'axios'
import { Folder, Search, Loader2, Image as ImageIcon, X } from 'lucide-react'
import { useInView } from 'react-intersection-observer'
import ImageCard from './components/ImageCard'
import ImageModal from './components/ImageModal'
import {
  getParentFolder,
  matchesSearch,
  mergeUniqueImages,
} from './lib/gallery'

const API_BASE = 'http://localhost:3001'
const PAGE_SIZE = 100

function App() {
  const [images, setImages] = useState([])
  const [totalImages, setTotalImages] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [filter, setFilter] = useState('')
  const [folderSearch, setFolderSearch] = useState('')
  
  const [recentDirs, setRecentDirs] = useState(() => {
    const saved = localStorage.getItem('recentDirs')
    return saved ? JSON.parse(saved) : []
  })

  const [dirInput, setDirInput] = useState(() => {
    const saved = localStorage.getItem('recentDirs')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.length > 0) return parsed[0]
    }
    return './images'
  })

  const [dir, setDir] = useState(dirInput)

  const [selectedFolders, setSelectedFolders] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  
  const [columnCount, setColumnCount] = useState(() => {
    const savedCols = localStorage.getItem('columnCount')
    return savedCols ? parseInt(savedCols) : 6
  })

  const abortControllerRef = useRef(null)
  const pageRef = useRef(1)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const requestIdRef = useRef(0)
  const loadedDirRef = useRef(null)
  const lastFilterRef = useRef('')

  useEffect(() => {
    localStorage.setItem('recentDirs', JSON.stringify(recentDirs))
  }, [recentDirs])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  const { ref, inView } = useInView()

  const saveToRecent = useCallback((newDir) => {
    setRecentDirs(prev => [newDir, ...prev.filter(d => d !== newDir)].slice(0, 5))
  }, [])

  const fetchImages = useCallback(async (isNewDir = false, overrideDir = null) => {
    const activeDir = overrideDir || dir
    if (!activeDir) return

    // Avoid starting an overlapping pagination request
    if (!isNewDir && (loadingRef.current || !hasMoreRef.current)) return

    // Abort previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    const requestId = ++requestIdRef.current

    const targetPage = isNewDir ? 1 : pageRef.current
    loadingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const res = await axios.get(`${API_BASE}/api/images`, {
        params: { dir: activeDir, q: filter, page: targetPage, limit: PAGE_SIZE },
        signal: controller.signal
      })
      if (requestId !== requestIdRef.current) return

      const resImages = res.data.images || []
      setImages(prev => isNewDir ? resImages : mergeUniqueImages(prev, resImages))
      const more = Boolean(res.data.hasMore)
      hasMoreRef.current = more
      setHasMore(more)
      setTotalImages(res.data.total || 0)
      pageRef.current = targetPage + 1

      if (isNewDir) {
        // Only reset folder selections when the directory itself changes,
        // so toggles survive a search.
        if (loadedDirRef.current !== activeDir) {
          const folders = {}
          if (res.data.folders) {
            res.data.folders.forEach(f => {
              folders[f] = true
            })
          }
          setSelectedFolders(folders)
          loadedDirRef.current = activeDir
          saveToRecent(activeDir)
        }
      }
    } catch (err) {
      if (axios.isCancel(err) || requestId !== requestIdRef.current) return

      const status = err.response?.status
      const message = err.response?.data?.error
      
      if (status === 404) {
        setError(`Directory "${activeDir}" not found.`)
      } else if (status === 400) {
        setError(message || 'Invalid directory path.')
      } else {
        setError('Connection failed. Is the server running on port 3001?')
      }

      if (isNewDir) {
        setImages([])
        setTotalImages(0)
        hasMoreRef.current = false
        setHasMore(false)
      }
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }, [dir, filter, saveToRecent])

  useEffect(() => {
    if (!inView || !hasMore || loading || images.length === 0) return
    const timer = setTimeout(() => {
      fetchImages()
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hasMore, loading, images.length])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchImages(true)
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-query the server when the search term changes (debounced), so search
  // covers every image on disk rather than only the already-loaded pages.
  useEffect(() => {
    if (lastFilterRef.current === filter) return
    lastFilterRef.current = filter
    const timer = setTimeout(() => {
      fetchImages(true)
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const uniqueFolders = useMemo(() => Object.keys(selectedFolders || {}).sort(), [selectedFolders])

  const filteredImages = useMemo(() => {
    return (images || []).filter(img => {
      const folderSelected = selectedFolders[getParentFolder(img.path)];
      return matchesSearch(img, filter) && folderSelected;
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
                  value={dirInput}
                  onChange={e => setDirInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      setDir(dirInput)
                      fetchImages(true, dirInput)
                    }
                  }}
                />
                <Folder className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              </div>

              {recentDirs.length > 0 && (
                <select 
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  onChange={(e) => {
                    const newDir = e.target.value
                    setDirInput(newDir)
                    setDir(newDir)
                    fetchImages(true, newDir)
                  }}
                  value={dirInput}
                >
                  <option value="" disabled>Recent</option>
                  {recentDirs.map(d => (
                    <option key={d} value={d}>{d.split('/').pop() || d}</option>
                  ))}
                </select>
              )}
              
              <button 
                className="bg-gray-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-gray-200 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                onClick={() => {
                  setDir(dirInput)
                  fetchImages(true, dirInput)
                }}
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
            {filteredImages.map((img) => (
              <ImageCard 
                key={img.path} 
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

          {!loading && filteredImages.length === 0 && !hasMore && (
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
        key={selectedImage ? selectedImage.path : 'none'}
        selectedImage={selectedImage} 
        onClose={() => setSelectedImage(null)} 
      />
    </div>
  )
}

export default App
