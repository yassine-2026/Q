import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { createServer as createViteServer } from "vite";
import youtubedl from "youtube-dl-exec";

// Smart fallback extractor for unsupported sites or basic blocks
async function smartHTMLFallback(url: string) {
    try {
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        };
        const response = await fetch(url, { headers });
        const html = await response.text();
        
        const formats = [];
        
        // Look for common video source patterns
        const mp4Match = html.match(/https?:\/\/[^"'\s]*\.mp4[^"'\s]*/i);
        const m3u8Match = html.match(/https?:\/\/[^"'\s]*\.m3u8[^"'\s]*/i);
        
        if (mp4Match) {
             formats.push({
                 type: "video",
                 quality: "مستخرج",
                 ext: "mp4",
                 url: mp4Match[0],
                 label: "رابط فيديو مباشر (MP4)"
             });
        }
        if (m3u8Match) {
             formats.push({
                 type: "video",
                 quality: "مستخرج",
                 ext: "m3u8",
                 url: m3u8Match[0],
                 label: "رابط بث مباشر (M3U8)"
             });
        }
        
        return formats;
    } catch (e) {
        return [];
    }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" })); // Increased limit for cookie files

  app.post("/api/download", async (req, res) => {
    const { url, cookies } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: "الرابط مطلوب" });
    }

    let cookieFilePath: string | null = null;

    try {
      // Prepare options for yt-dlp
      const options: any = {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificate: true,
        format: "best", // best pre-merged format for direct download
      };

      // If user provided cookies, write them to a temp file
      if (cookies && cookies.trim().length > 0) {
        cookieFilePath = path.join(
          os.tmpdir(),
          `cookies-${Date.now()}-${Math.random().toString(36).substring(2)}.txt`
        );
        await fs.writeFile(cookieFilePath, cookies, "utf8");
        options.cookies = cookieFilePath;
      }

      // Execute yt-dlp to extract information without downloading
      let output;
      try {
        output = await youtubedl(url, options);
      } catch (ytdlError: any) {
        const errorMessage = ytdlError?.message || ytdlError?.stderr || String(ytdlError);
        
        // Check if we should try the smart HTML fallback
        if (
            errorMessage.includes("Unsupported URL") || 
            errorMessage.includes("Unsupported") ||
            errorMessage.includes("403")
        ) {
            console.log("yt-dlp failed, attempting smart HTML fallback...");
            const fallbackFormats = await smartHTMLFallback(url);
            if (fallbackFormats.length > 0) {
                return res.json({
                    success: true,
                    title: "فيديو مستخرج (احتياطي)",
                    thumbnail: "",
                    duration: 0,
                    uploader: "مستخرج الويب",
                    formats: fallbackFormats
                });
            }
        }
        throw ytdlError; // Re-throw if fallback fails or is not applicable
      }

      // Process formats to provide video and audio options
      const allFormats = output.formats || [];
      const formatsToReturn = [];

      // 1. Direct best video+audio (from the main output url)
      if (output.url) {
        formatsToReturn.push({
          type: "video+audio",
          quality: output.format_note || output.resolution || "best",
          ext: output.ext,
          url: output.url,
          label: "تحميل الفيديو (أفضل جودة متاحة)",
        });
      }

      // 2. Best audio only
      const audioFormats = allFormats.filter(
        (f) => f.acodec !== "none" && f.vcodec === "none"
      );
      if (audioFormats.length > 0) {
        // Sort by quality/bitrate and pick the best
        const bestAudio = audioFormats.reduce((prev, current) =>
          prev.abr > current.abr ? prev : current
        );
        if (bestAudio && bestAudio.url) {
          formatsToReturn.push({
            type: "audio only",
            quality: bestAudio.format_note || bestAudio.abr + "kbps" || "best",
            ext: bestAudio.ext,
            url: bestAudio.url,
            label: "تحميل الصوت فقط (MP3/M4A)",
          });
        }
      }

      res.json({
        success: true,
        title: output.title,
        thumbnail: output.thumbnail,
        duration: output.duration,
        uploader: output.uploader || output.extractor,
        formats: formatsToReturn,
      });
    } catch (error: any) {
      const errorMessage = error?.message || error?.stderr || String(error);
      console.log("YTDL Info (Expected):", errorMessage);
      let errorMsg =
        "حدث خطأ أثناء استخراج الرابط. تأكد من صحة الرابط أو حاول رفع ملف الكوكيز الخاص بك.";
      
      if (errorMessage.includes("Unsupported URL") || errorMessage.includes("Unsupported")) {
        errorMsg = "المنصة غير مدعومة حالياً.";
      } else if (errorMessage.includes("Private video") || errorMessage.includes("private")) {
        errorMsg = "هذا الفيديو خاص أو محمي، ولا يمكن الوصول إليه.";
      } else if (
        errorMessage.includes("Sign in to confirm") ||
        errorMessage.includes("bot") ||
        errorMessage.includes("cookies") ||
        errorMessage.includes("login") ||
        errorMessage.includes("requires authentication")
      ) {
        errorMsg = "هذه المنصة تتطلب تسجيل الدخول وتمنع التحميل التلقائي. يرجى رفع ملف cookies.txt من متصفحك والمحاولة مجدداً.";
      }
      
      res.status(500).json({ success: false, error: errorMsg, details: errorMessage });
    } finally {
      // Clean up the temporary cookie file if it was created
      if (cookieFilePath) {
        try {
          await fs.unlink(cookieFilePath);
        } catch (cleanupError) {
          console.error("Failed to clean up cookie file:", cleanupError);
        }
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
