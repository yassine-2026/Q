import React, { useState } from 'react';
import { Download, Link as LinkIcon, Loader2, AlertCircle, Video, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Format {
  type: string;
  quality: string;
  url: string;
  ext: string;
  label: string;
}

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  formats: Format[];
}

export default function App() {
  const [url, setUrl] = useState('');
  const [cookiesFile, setCookiesFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setVideoInfo(null);

    let cookiesText = '';
    if (cookiesFile) {
      try {
        cookiesText = await cookiesFile.text();
      } catch (err) {
        setError('تعذر قراءة ملف الكوكيز. تأكد من أنه ملف نصي صالح.');
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, cookies: cookiesText }),
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error('حدث خطأ في الخادم (استجابة غير صالحة). يرجى المحاولة لاحقاً.');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'فشل الاتصال، يرجى المحاولة لاحقاً');
      }

      setVideoInfo(data);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex flex-col items-center py-16 px-4 font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-3xl flex flex-col items-center space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-indigo-500/10 rounded-2xl mb-4">
            <Download className="w-12 h-12 text-indigo-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
            المُحمّل العالمي
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
            قم بتحميل أي فيديو من أكثر من 1800 منصة حول العالم بأعلى جودة ممكنة.
          </p>
        </div>

        {/* Main Card */}
        <div className="w-full bg-[#111111] border border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl">
          <form onSubmit={handleDownload} className="space-y-6">
            <div className="relative">
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-500">
                <LinkIcon className="w-5 h-5" />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="أدخل رابط الفيديو هنا (مثال: يوتيوب، تيك توك، انستغرام...)"
                required
                disabled={loading}
                className="w-full bg-[#1a1a1a] border border-gray-700 text-white text-lg rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent block pr-12 pl-4 py-5 disabled:opacity-50 transition-all placeholder-gray-500"
              />
            </div>
            
            <div className="flex flex-col space-y-2">
              <label htmlFor="cookies-upload" className="text-sm text-gray-400">
                (اختياري) للمنصات التي تتطلب تسجيل الدخول مثل إنستغرام أو فيسبوك، يمكنك إرفاق ملف cookies.txt:
              </label>
              <input
                id="cookies-upload"
                type="file"
                accept=".txt"
                onChange={(e) => setCookiesFile(e.target.files?.[0] || null)}
                disabled={loading}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#1a1a1a] file:text-indigo-400 hover:file:bg-[#222] disabled:opacity-50 cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg py-5 px-8 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-indigo-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin ml-3" />
                  جارٍ استخراج الروابط من المنصات...
                </>
              ) : (
                'استخراج روابط التحميل'
              )}
            </button>
          </form>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error-message"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start text-red-400"
              >
                <AlertCircle className="w-6 h-6 ml-3 shrink-0" />
                <p className="text-sm font-medium leading-relaxed">{error}</p>
              </motion.div>
            )}

            {videoInfo && (
              <motion.div
                key="video-result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-8 space-y-6"
              >
                <div className="flex flex-col md:flex-row gap-6 bg-[#1a1a1a] p-4 rounded-2xl border border-gray-800">
                  {videoInfo.thumbnail && (
                    <div className="relative w-full md:w-64 shrink-0 rounded-xl overflow-hidden bg-black aspect-video">
                      <img
                        src={videoInfo.thumbnail}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {videoInfo.duration > 0 && (
                        <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded font-mono">
                          {formatDuration(videoInfo.duration)}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h2 className="text-xl font-bold text-white mb-2 line-clamp-2 leading-snug">
                      {videoInfo.title || 'فيديو بدون عنوان'}
                    </h2>
                    {videoInfo.uploader && (
                      <p className="text-gray-400 text-sm flex items-center mb-6">
                        بواسطة: <span className="mr-1 text-gray-300 font-medium">{videoInfo.uploader}</span>
                      </p>
                    )}
                    
                    <div className="flex flex-col gap-3 mt-auto">
                      {videoInfo.formats.map((format, index) => (
                        <a
                          key={index}
                          href={format.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors rounded-xl p-4 group"
                        >
                          <div className="flex items-center">
                            {format.type.includes('audio') && !format.type.includes('video') ? (
                                <Music className="w-5 h-5 text-indigo-400 ml-3" />
                            ) : (
                                <Video className="w-5 h-5 text-emerald-400 ml-3" />
                            )}
                            <span className="font-medium text-gray-200">
                                {format.label}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-xs font-mono text-gray-400 ml-3 uppercase bg-black/30 px-2 py-1 rounded">
                                {format.ext}
                            </span>
                            <Download className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info box */}
        <div className="text-center">
          <div className="inline-block px-6 py-3 bg-[#111111] border border-gray-800 rounded-full">
            <p className="text-sm text-gray-500 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 ml-3 animate-pulse"></span>
              يدعم أكثر من 1800 موقع، منها يوتيوب، تيك توك، فيسبوك، إنستغرام، وغيرها.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

