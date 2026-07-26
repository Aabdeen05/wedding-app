import React, { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera, Image as ImageIcon, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = 'https://wedding-app-j8fi.onrender.com/api';

function App() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    await processAndUploadFiles(files);
    
    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
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
            fileType: fileToUpload.type
          })
        });

        if (!dbRes.ok) throw new Error('Failed to save metadata');

        totalCompleted++;
        setUploadProgress((totalCompleted / totalFiles) * 100);
      }

      setUploadSuccess(true);
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

  return (
    <div className="min-h-screen bg-[url('https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070')] bg-cover bg-center flex items-center justify-center p-4">
      {/* Overlay to dim background */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-3xl p-8 text-center"
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
            Share your favorite moments from our special day!
          </p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => cameraInputRef.current?.click()}
            disabled={isUploading}
            className="w-full relative overflow-hidden group bg-white/20 hover:bg-white/30 transition-all duration-300 text-white rounded-2xl p-4 flex items-center justify-center gap-3 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="font-['Outfit'] font-medium text-lg">Take Photo / Video</span>
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full relative overflow-hidden group bg-black/30 hover:bg-black/40 transition-all duration-300 text-white rounded-2xl p-4 flex items-center justify-center gap-3 border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ImageIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="font-['Outfit'] font-medium text-lg">Upload from Gallery</span>
          </button>

          {/* Hidden Inputs */}
          <input 
            type="file"
            accept="image/*,video/*"
            capture="environment"
            ref={cameraInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <input 
            type="file"
            accept="image/*,video/*"
            multiple
            ref={fileInputRef}
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
              Uploads Complete! Thank you.
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default App;
