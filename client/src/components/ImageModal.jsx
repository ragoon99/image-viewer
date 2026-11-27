import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Copy, Check, Calendar, HardDrive, Ruler, FileText, Loader2, Sparkles } from 'lucide-react';
import { similarityTier } from '../lib/gallery';

const API_BASE = 'http://localhost:3001';

const ImageModal = ({ selectedImage, onSelectImage, onClose }) => {
  const [dimensions, setDimensions] = useState(null);
  const [copied, setCopied] = useState(false);
  const [similar, setSimilar] = useState(null);

  const imagePath = selectedImage?.path;
  // Results are tagged with their path so a stale response never shows as loaded.
  const similarForImage = similar?.path === imagePath
    ? similar
    : { status: 'loading', items: [] };

  useEffect(() => {
    if (!imagePath) return undefined;
    const controller = new AbortController();
    axios.get(`${API_BASE}/api/similar`, {
      params: { path: imagePath, limit: 12 },
      signal: controller.signal,
    }).then(res => {
      setSimilar({ path: imagePath, status: 'done', items: res.data.similar || [] });
    }).catch(err => {
      if (axios.isCancel(err)) return;
      setSimilar({ path: imagePath, status: 'error', items: [] });
    });
    return () => controller.abort();
  }, [imagePath]);

  if (!selectedImage) return null;

  const handleImageLoad = (e) => {
    setDimensions({
      width: e.target.naturalWidth,
      height: e.target.naturalHeight,
    });
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(selectedImage.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileExtension = selectedImage.name.split('.').pop().toUpperCase();

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/95 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative max-w-6xl w-full bg-neutral-900/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button 
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full border border-white/10 transition-colors shadow-lg cursor-pointer"
            onClick={onClose}
          >
            <X size={20} />
          </button>

          {/* Left panel: Image Container */}
          <div className="flex-grow flex items-center justify-center bg-black/50 p-6 md:p-10 min-h-[300px] md:min-h-0 overflow-hidden">
            <img
              src={`${API_BASE}/uploads?path=${encodeURIComponent(selectedImage.path)}`}
              alt={selectedImage.name}
              onLoad={handleImageLoad}
              className="max-w-full max-h-[50vh] md:max-h-[75vh] object-contain rounded-xl shadow-xl transition-all duration-300"
            />
          </div>

          {/* Right panel: Details Panel */}
          <div className="w-full md:w-[380px] shrink-0 border-t md:border-t-0 md:border-l border-white/10 bg-neutral-950/40 p-6 flex flex-col gap-6 overflow-y-auto max-h-[40vh] md:max-h-[90vh]">
            <div>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                Image Info
              </span>
              <h2 className="text-xl font-bold text-white mt-3 break-all leading-snug">
                {selectedImage.name}
              </h2>
            </div>

            <div className="w-full h-px bg-white/10" />

            {/* Metadata Fields */}
            <div className="flex flex-col gap-4">
              {/* Dimensions */}
              <div className="flex items-center gap-3">
                <div className="bg-white/5 p-2 rounded-xl text-neutral-400 border border-white/5">
                  <Ruler size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Dimensions</p>
                  <p className="text-sm font-medium text-neutral-200">
                    {dimensions ? `${dimensions.width} × ${dimensions.height} px` : 'Loading...'}
                  </p>
                </div>
              </div>

              {/* File Size */}
              <div className="flex items-center gap-3">
                <div className="bg-white/5 p-2 rounded-xl text-neutral-400 border border-white/5">
                  <HardDrive size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">File Size</p>
                  <p className="text-sm font-medium text-neutral-200">
                    {formatBytes(selectedImage.size)}
                  </p>
                </div>
              </div>

              {/* File Type */}
              <div className="flex items-center gap-3">
                <div className="bg-white/5 p-2 rounded-xl text-neutral-400 border border-white/5">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Type</p>
                  <p className="text-sm font-medium text-neutral-200">{fileExtension}</p>
                </div>
              </div>

              {/* Modified Date */}
              <div className="flex items-center gap-3">
                <div className="bg-white/5 p-2 rounded-xl text-neutral-400 border border-white/5">
                  <Calendar size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Last Modified</p>
                  <p className="text-xs font-medium text-neutral-200 font-mono">
                    {formatDate(selectedImage.mtime)}
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-white/10" />

            {/* Path Section */}
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Location</p>
              <div className="bg-black/40 border border-white/5 p-3 rounded-2xl flex items-center justify-between gap-3 group">
                <p className="text-xs font-mono text-neutral-300 truncate select-all select-none">
                  {selectedImage.path}
                </p>
                <button 
                  onClick={handleCopyPath}
                  className="bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white p-2 rounded-xl transition-all border border-white/5 shrink-0 cursor-pointer"
                  title="Copy path"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Similar Images */}
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles size={12} />
                Similar Images
              </p>

              {similarForImage.status === 'loading' && (
                <div className="flex items-center gap-2 text-xs text-neutral-500 py-2">
                  <Loader2 size={14} className="animate-spin" />
                  Finding similar images...
                </div>
              )}
              {similarForImage.status === 'error' && (
                <p className="text-xs text-neutral-500 py-2">Could not load similar images.</p>
              )}
              {similarForImage.status === 'done' && similarForImage.items.length === 0 && (
                <p className="text-xs text-neutral-500 py-2">No similar images found.</p>
              )}
              {similarForImage.status === 'done' && similarForImage.items.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  {similarForImage.items.map(img => {
                    const tier = similarityTier(img.similarity);
                    const badgeClass = tier === 'exact'
                      ? 'bg-green-500/15 text-green-400 border-green-500/20'
                      : tier === 'high'
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                        : 'bg-white/5 text-neutral-400 border-white/10';
                    return (
                      <button
                        key={img.path}
                        type="button"
                        title={`${img.name} — ${img.similarity}% similar`}
                        onClick={() => onSelectImage && onSelectImage(img)}
                        className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-white/10 hover:border-blue-400/60 transition-colors cursor-pointer bg-black/40 image-checkerboard"
                      >
                        <img
                          src={`${API_BASE}/uploads?path=${encodeURIComponent(img.path)}`}
                          alt={img.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        <span className={`absolute bottom-1 left-1 right-1 text-center text-[9px] font-bold px-1 py-0.5 rounded-md border ${badgeClass}`}>
                          {img.similarity}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-auto pt-4 flex gap-3">
              <button 
                className="flex-grow flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-blue-900/30 active:scale-95 border border-blue-500/10 cursor-pointer"
                onClick={() => window.open(`${API_BASE}/uploads?path=${encodeURIComponent(selectedImage.path)}`, '_blank')}
              >
                <ExternalLink size={14} />
                Open Original
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageModal;
