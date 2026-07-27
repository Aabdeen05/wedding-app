import React, { useState, useRef, useEffect, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera, CheckCircle, Loader2, User, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = 'https://wedding-app-j8fi.onrender.com/api';

function App() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploaderName, setUploaderName] = useState('');
  const [nameError, setNameError] = useState(false);
  
  // Gallery state
  const [gallery, setGallery] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  
  const cameraInputRef = useRef(null);

  // Keep-alive and initial fetch
  useEffect(() => {
    // Keep backend alive
    fetch(`${API_URL}/health`).catch(console.error);
    const interval = setInterval(() => {
      fetch(`${API_URL}/health`).catch(console.error);
    }, 14 * 60 * 1000); // every 14 mins

    return () => clearInterval(interval);
  }, []);

  const fetchGallery = useCallback(async (pageNum) => {
    setIsLoadingGallery(true);
    try {
      const res = await fetch(`${API_URL}/gallery?page=${pageNum}&limit=12`);
      if (res.ok) {
        const data = await res.json();
        if (pageNum === 1) {
          setGallery(data.media);
        } else {
          setGallery(prev => [...prev, ...data.media]);
        }
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error('Error fetching gallery:', err);
    } finally {
      setIsLoadingGallery(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery(1);
  }, [fetchGallery]);

  const handleCaptureClick = () => {
    if (!uploaderName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    cameraInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    await processAndUploadFiles(files);
    
    // Reset input
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const processAndUploadFiles = async (files) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);

    try {
      let totalCompleted = 0;
      const totalFiles = files.length;

      for (const file of files) {
        let fileToUpload = file;
        
        // 1. Compress if it's an image
        if (file.type.startsWith('image/')) {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          fileToUpload = await imageCompression(file, options);
        }

        // 2. Get Presigned URL
        const presignRes = await fetch(`${API_URL}/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            fileType: fileToUpload.type,
            fileSize: fileToUpload.size
          })
        });
        
        if (!presignRes.ok) {
          const contentType = presignRes.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errData = await presignRes.json();
            throw new Error(errData.error || 'Failed to get upload URL');
          } else {
            const textData = await presignRes.text();
            throw new Error(`Server Error (${presignRes.status}): Please check backend URL. ` + textData.slice(0, 50));
          }
        }

        const { uploadUrl, key, s3Url } = await presignRes.json();

        // 3. Upload to S3
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: fileToUpload,
          headers: {
            'Content-Type': fileToUpload.type,
          }
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload file to S3');
        }

        // 4. Save Metadata to DB
        const dbRes = await fetch(`${API_URL}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            s3Key: key,
            s3Url: s3Url,
            fileType: fileToUpload.type,
            uploaderName: uploaderName.trim()
          })
        });

        if (!dbRes.ok) throw new Error('Failed to save metadata');

        totalCompleted++;
        setUploadProgress((totalCompleted / totalFiles) * 100);
      }

      setUploadSuccess(true);
      // Refresh gallery
      fetchGallery(1);
      setPage(1);
      
      setTimeout(() => {
        setUploadSuccess(false);
        setUploadProgress(0);
      }, 5000);

    } catch (error) {
      console.error('Error during upload:', error);
      alert(`Upload error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchGallery(nextPage);
  };

  return (
    <div className="min-h-screen bg-[#111] text-white">
      {/* Hero Section */}
      <div className="relative min-h-[70vh] bg-[url('https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070')] bg-cover bg-center flex items-center justify-center p-4">
        {/* Overlay to dim background */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-[#111]"></div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-3xl p-8 text-center mt-10"
        >
          <div className="mb-8">
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-['Cairo'] font-bold text-white mb-2"
              style={{ direction: 'rtl' }}
            >
              ألف مبروك للعروسين
            </motion.h1>
            <motion.h2 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-['Outfit'] font-light text-white/90"
            >
              Mhammed & Fouz
            </motion.h2>
            <p className="mt-4 text-white/70 font-['Outfit'] text-sm">
              Capture and share the best moments directly from your camera!
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative text-left">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 w-5 h-5" />
              <input
                type="text"
                placeholder="Enter your name to upload..."
                value={uploaderName}
                onChange={(e) => { setUploaderName(e.target.value); setNameError(false); }}
                className={`w-full bg-black/30 border ${nameError ? 'border-red-500' : 'border-white/10'} rounded-2xl py-3 pl-10 pr-4 text-white placeholder-white/50 focus:outline-none focus:border-white/30 transition-colors font-['Outfit']`}
              />
              {nameError && (
                <p className="text-red-400 text-xs mt-1 font-['Outfit'] pl-2">Name is required to upload.</p>
              )}
            </div>

            <button 
              onClick={handleCaptureClick}
              disabled={isUploading}
              className="w-full relative overflow-hidden group bg-white hover:bg-gray-100 transition-all duration-300 text-black rounded-2xl p-4 flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span className="font-['Outfit'] font-semibold text-lg">Open Camera</span>
            </button>

            {/* Hidden Input */}
            <input 
              type="file"
              accept="image/*,video/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Progress & Success States */}
          <AnimatePresence>
            {isUploading && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 p-4 bg-white/10 rounded-xl border border-white/20 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2 text-white font-['Outfit'] text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    className="bg-white h-2 rounded-full transition-all duration-300"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </motion.div>
            )}

            {uploadSuccess && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mt-6 p-4 bg-green-500/20 text-green-100 rounded-xl border border-green-500/30 flex items-center justify-center gap-2 font-['Outfit']"
              >
                <CheckCircle className="w-5 h-5" />
                Uploaded Successfully!
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Live Gallery Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-3xl font-['Outfit'] font-bold flex items-center gap-3">
            <ImageIcon className="w-8 h-8 text-white/70" />
            Live Gallery
          </h3>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-white/20 to-transparent ml-6"></div>
        </div>

        {gallery.length === 0 && !isLoadingGallery ? (
          <div className="text-center py-20 text-white/50 font-['Outfit'] border border-white/10 rounded-3xl bg-white/5">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-xl">No moments captured yet.</p>
            <p className="text-sm mt-2">Be the first to share a memory!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {gallery.map((item, idx) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (idx % 12) * 0.05 }}
                className="relative group aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10"
              >
                {item.fileType.startsWith('video/') ? (
                  <video 
                    src={item.url} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    muted
                    loop
                    playsInline
                    autoPlay
                  />
                ) : (
                  <img 
                    src={item.url} 
                    alt="Wedding moment" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                
                {/* Uploader Name Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <div className="flex items-center gap-2 text-sm font-['Outfit'] text-white">
                    <User className="w-4 h-4" />
                    <span className="truncate">{item.uploaderName || 'Anonymous'}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoadingGallery && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-white/5 animate-pulse border border-white/10"></div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {page < totalPages && (
          <div className="text-center mt-10">
            <button
              onClick={loadMore}
              disabled={isLoadingGallery}
              className="px-8 py-3 bg-white/10 hover:bg-white/20 transition-colors border border-white/20 rounded-full font-['Outfit'] flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
            >
              {isLoadingGallery ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</>
              ) : (
                'Load More Moments'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
