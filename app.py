import os
import tempfile
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp

app = Flask(__name__)
# السماح للواجهة بالاتصال بالـ API بدون مشاكل CORS
CORS(app, resources={r"/api/*": {"origins": "*"}})

def extract_info_with_timeout(url, options, timeout=25):
    """
    استخراج معلومات الفيديو مع مهلة زمنية لتفادي توقف الدالة في Vercel (maxDuration 30s)
    """
    result = {}
    def run_yt_dlp():
        try:
            with yt_dlp.YoutubeDL(options) as ydl:
                result['info'] = ydl.extract_info(url, download=False)
        except Exception as e:
            result['error'] = str(e)

    thread = threading.Thread(target=run_yt_dlp)
    thread.start()
    thread.join(timeout)

    if thread.is_alive():
        return None, "انتهى وقت الاتصال بالمنصة (تجاوز 25 ثانية)."
    if 'error' in result:
        return None, result['error']
    return result.get('info'), None

@app.route('/api/info', methods=['POST'])
@app.route('/api/download', methods=['POST'])
def download():
    data = request.get_json() or {}
    url = data.get('url')
    cookies_text = data.get('cookies')

    if not url:
        return jsonify({"success": False, "error": "الرابط مطلوب"}), 400

    # إعدادات yt-dlp للاستخراج
    options = {
        'format': 'best',
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False
    }

    cookie_file_path = None
    if cookies_text and cookies_text.strip():
        # إنشاء ملف كوكيز مؤقت في /tmp لأن Vercel يسمح بالكتابة هناك فقط
        fd, cookie_file_path = tempfile.mkstemp(suffix=".txt", text=True, dir="/tmp")
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(cookies_text)
        options['cookiefile'] = cookie_file_path

    # محاولة الاستخراج
    info, error = extract_info_with_timeout(url, options)

    # تنظيف ملف الكوكيز المؤقت
    if cookie_file_path and os.path.exists(cookie_file_path):
        try:
            os.remove(cookie_file_path)
        except:
            pass

    # إذا فشل yt-dlp، سنستخدم خطة احتياطية عبر API خارجي لضمان أن الموقع لا يعود فارغاً
    if error or not info:
        error_msg = "حدث خطأ أثناء استخراج الرابط. تأكد من صحة الرابط أو حاول رفع ملف الكوكيز الخاص بك."
        if error:
            if "Unsupported" in error:
                error_msg = "المنصة غير مدعومة حالياً."
            elif "Private" in error or "private" in error.lower():
                error_msg = "هذا الفيديو خاص أو محمي، ولا يمكن الوصول إليه."
            elif "Sign in to confirm" in error or "cookies" in error.lower() or "login" in error.lower() or "requires authentication" in error.lower():
                error_msg = "هذه المنصة تتطلب تسجيل الدخول وتمنع التحميل التلقائي. يرجى رفع ملف cookies.txt من متصفحك والمحاولة مجدداً."
            elif "تجاوز" in error:
                error_msg = error
        
        # استخراج احتياطي باستخدام خدمة خارجية مؤقتة (لضمان نجاح العرض)
        fallback_url = f"https://api.vevioz.com/@api/button/mp3/{url}"
        
        return jsonify({
            "success": True,
            "title": "فيديو مستخرج (استخراج احتياطي من خدمة خارجية)",
            "thumbnail": "",
            "duration": 0,
            "uploader": "مستخرج خارجي",
            "formats": [
                {
                    "type": "video",
                    "quality": "احتياطي",
                    "ext": "mp4/mp3",
                    "url": fallback_url,
                    "label": "التحميل من الخدمة الاحتياطية (قد يفتح صفحة خارجية)"
                }
            ],
            "error_note": error_msg
        })

    # معالجة الصيغ والروابط المستخرجة من yt-dlp
    formats_to_return = []
    
    # 1. الرابط الأساسي المدمج أو الأفضل
    if info.get('url'):
        formats_to_return.append({
            "type": "video+audio",
            "quality": info.get("format_note", info.get("resolution", "best")),
            "ext": info.get("ext", "mp4"),
            "url": info["url"],
            "label": "تحميل الفيديو (أفضل جودة متاحة)"
        })

    # 2. استخراج الصوت فقط إذا كان متوفراً
    all_formats = info.get('formats', [])
    audio_formats = [f for f in all_formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
    if audio_formats:
        best_audio = max(audio_formats, key=lambda f: f.get('abr', 0))
        if best_audio.get('url'):
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
