import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, ImageOff } from 'lucide-react';

const ImageCard = ({ img, onClick }) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -5 }}
      className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100"
    >
      <div 
        className="aspect-square overflow-hidden bg-gray-100 relative cursor-pointer flex items-center justify-center"
        onClick={() => !error && onClick(img)}
      >
        {!loaded && !error && (
          <div className="absolute inset-0 animate-pulse bg-gray-200" />
        )}
        
        {error ? (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <ImageOff size={32} strokeWidth={1} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Failed to load</span>
          </div>
        ) : (
          <>
            <img 
              src={`http://localhost:3001/uploads?path=${encodeURIComponent(img.path)}`} 
              alt={img.name} 
              className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
            />
            <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ${loaded ? 'flex' : 'hidden'}`}>
               <div className="bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/40 transition-colors">
                 <Eye size={20} />
               </div>
            </div>
          </>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold truncate text-gray-800" title={img.name}>
          {img.name}
        </p>
        <p className="text-[10px] text-gray-400 mt-1 truncate font-mono uppercase tracking-wider" title={img.path}>
          {img.path.split('/').slice(-3, -1).join(' / ') || 'Root'}
        </p>
      </div>
    </motion.div>
  );
};

export default ImageCard;
