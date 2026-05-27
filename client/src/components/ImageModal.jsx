import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';

const ImageModal = ({ selectedImage, onClose }) => {
  if (!selectedImage) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute -top-12 right-0 flex gap-4">
            <button 
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors border border-white/20"
              onClick={() => window.open(`http://localhost:3001/uploads?path=${encodeURIComponent(selectedImage.path)}`, '_blank')}
            >
              <ExternalLink size={16} />
              Open Original
            </button>
            <button 
              className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors border border-white/20"
              onClick={onClose}
            >
              <X size={24} />
            </button>
          </div>
          
          <img 
            src={`http://localhost:3001/uploads?path=${encodeURIComponent(selectedImage.path)}`} 
            alt={selectedImage.name} 
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
          
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-center max-w-lg"
          >
            <p className="text-white font-medium truncate">{selectedImage.name}</p>
            <p className="text-gray-400 text-xs mt-1 truncate">{selectedImage.path}</p>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageModal;
