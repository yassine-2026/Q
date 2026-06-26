from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp
import os
import subprocess
import sys

app = Flask(__name__)
CORS(app)  # السماح بالطلبات عبر النطاقات

# تحديث مكتبة yt-dlp عند تشغيل الخادم
def update_ytdlp():
    try:
        print("جاري التحقق من تحديثات yt-dlp...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"])
        print("تم التحديث بنجاح.")
    except Exception as e:
        print(f"فشل في تحديث yt-dlp: {e}")

update_ytdlp()

@app.route('/api/download', methods=['POST'])
def download():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"success": False, "error": "الرابط مطلوب"}), 400

    url = data['url']
    
    # إعدادات yt-dlp
    ydl_opts = {
        'format': 'bestvideo+bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }

    # دعم الكوكيز إذا كان الملف موجوداً
    if os.path.exists('cookies.txt'):
        ydl_opts['cookiefile'] = 'cookies.txt'

    # دعم البروكسي من متغيرات البيئة
    proxy = os.environ.get('PROXY')
    if proxy:
        ydl_opts['proxy'] = proxy

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            formats_to_return = []
            
            # 1. أفضل جودة دمج (فيديو + صوت) أو الرابط الأساسي
            if 'url' in info:
                formats_to_return.append({
                    "type": "video+audio",
                    "quality": info.get("format_note", info.get("resolution", "best")),
                    "ext": info.get("ext", "mp4"),
                    "url": info["url"],
                    "label": "تحميل الفيديو (أفضل جودة متاحة)"
                })
            
            # 2. أفضل جودة صوت
            formats = info.get('formats', [])
            audio_formats = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
            
            if audio_formats:
                # اختيار الأفضل بناءً على معدل نقل البيانات
                best_audio = max(audio_formats, key=lambda f: f.get('abr', 0))
                if 'url' in best_audio:
                    formats_to_return.append({
                        "type": "audio only",
                        "quality": best_audio.get("format_note", f"{best_audio.get('abr', 'best')}kbps"),
                        "ext": best_audio.get("ext", "mp3"),
                        "url": best_audio["url"],
                        "label": "تحميل الصوت فقط (MP3/M4A)"
                    })

            return jsonify({
                "success": True,
                "title": info.get('title'),
                "thumbnail": info.get('thumbnail'),
                "duration": info.get('duration'),
                "uploader": info.get('uploader', info.get('extractor')),
                "formats": formats_to_return
            })

    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        user_msg = "حدث خطأ غير معروف."
        if "Unsupported URL" in error_msg:
            user_msg = "المنصة غير مدعومة حالياً."
        elif "Private video" in error_msg or "private" in error_msg.lower():
            user_msg = "هذا الفيديو خاص أو محمي، ولا يمكن الوصول إليه."
        else:
            user_msg = f"فشل الاستخراج: {error_msg}"
        return jsonify({"success": False, "error": user_msg}), 500
    except Exception as e:
        return jsonify({"success": False, "error": "حدث خطأ في الخادم أو الشبكة، يرجى المحاولة لاحقاً."}), 500

if __name__ == '__main__':
    # تشغيل الخادم على المنفذ 5000
    app.run(host='0.0.0.0', port=5000)
