import os
import tempfile
import json
import traceback
import requests
import subprocess
import re
from flask import Flask, request, jsonify, send_file, Response, after_this_request
from flask_cors import CORS
import yt_dlp

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({
        "status": "ok", 
        "yt_dlp_version": yt_dlp.version.__version__
    }), 200

def smart_html_fallback(url):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=10)
        html = resp.text
        
        mp4_match = re.search(r'https?://[^\s\'"]+\.mp4[^\s\'"]*', html, re.IGNORECASE)
        m3u8_match = re.search(r'https?://[^\s\'"]+\.m3u8[^\s\'"]*', html, re.IGNORECASE)
        
        formats = []
        if mp4_match:
            formats.append({
                "type": "video",
                "quality": "مستخرج احتياطي",
                "ext": "mp4",
                "url": mp4_match.group(0),
                "label": "رابط فيديو مباشر (MP4)",
                "format_id": "fallback_mp4"
            })
        if m3u8_match:
            formats.append({
                "type": "video",
                "quality": "مستخرج احتياطي",
                "ext": "m3u8",
                "url": m3u8_match.group(0),
                "label": "رابط بث مباشر (M3U8)",
                "format_id": "fallback_m3u8"
            })
            
        return formats
    except Exception as e:
        print(f"HTML Fallback Error: {e}")
        return []

@app.route('/api/info', methods=['POST'])
def info():
    try:
        url = request.form.get('url')
        if not url:
            return jsonify({"success": False, "error": "الرابط مطلوب"}), 200

        cookie_file_path = None
        if 'cookies' in request.files:
            file = request.files['cookies']
            if file.filename:
                fd, cookie_file_path = tempfile.mkstemp(suffix=".txt", dir=tempfile.gettempdir())
                file.save(cookie_file_path)

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'ignoreerrors': True,
            'socket_timeout': 15,
            'format': 'best'
        }
        
        if cookie_file_path:
            ydl_opts['cookiefile'] = cookie_file_path

        info_dict = None
        error_msg = None

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                extracted = ydl.extract_info(url, download=False)
                if extracted:
                    if extracted.get('_type') == 'playlist':
                        entries = extracted.get('entries')
                        if entries and len(entries) > 0:
                            info_dict = entries[0]
                    else:
                        info_dict = extracted
                
                if not info_dict:
                    error_msg = "لم يتم العثور على معلومات."
        except Exception as e:
            error_msg = str(e)
            
        if not info_dict:
            try:
                cmd = ['yt-dlp', '--dump-json', '--no-warnings', '--ignore-errors']
                if cookie_file_path:
                    cmd.extend(['--cookies', cookie_file_path])
                cmd.append(url)
                
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                if proc.stdout:
                    lines = proc.stdout.strip().split('\n')
                    if lines:
                        info_dict = json.loads(lines[0])
            except Exception as e:
                print(f"Subprocess Fallback Error: {e}")

        if cookie_file_path and os.path.exists(cookie_file_path):
            try:
                os.remove(cookie_file_path)
            except:
                pass

        formats_to_return = []
        
        if info_dict:
            if info_dict.get('url'):
                formats_to_return.append({
                    "type": "video+audio",
                    "quality": info_dict.get("format_note", info_dict.get("resolution", "best")),
                    "ext": info_dict.get("ext", "mp4"),
                    "url": info_dict["url"],
                    "label": "أفضل جودة",
                    "format_id": info_dict.get("format_id", "best"),
                    "filesize": info_dict.get("filesize") or info_dict.get("filesize_approx")
                })

            audio_formats = [f for f in info_dict.get('formats', []) if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
            if audio_formats:
                best_audio = max(audio_formats, key=lambda f: f.get('abr', 0) or 0)
                if best_audio and best_audio.get('url'):
                    formats_to_return.append({
                        "type": "audio only",
                        "quality": best_audio.get("format_note", f"{best_audio.get('abr', 'best')}kbps"),
                        "ext": best_audio.get("ext", "mp3"),
                        "url": best_audio["url"],
                        "label": "صوت فقط",
                        "format_id": best_audio.get("format_id", "bestaudio"),
                        "filesize": best_audio.get("filesize") or best_audio.get("filesize_approx")
                    })
                    
        if not formats_to_return:
            fallback_formats = smart_html_fallback(url)
            if fallback_formats:
                formats_to_return.extend(fallback_formats)
            else:
                fallback_url = f"https://api.vevioz.com/@api/button/mp3/{url}"
                formats_to_return.append({
                    "type": "video",
                    "quality": "احتياطي",
                    "ext": "mp4/mp3",
                    "url": fallback_url,
                    "label": "التحميل من خدمة خارجية (مباشر)",
                    "format_id": "fallback"
                })
                
        return jsonify({
            "success": True,
            "title": info_dict.get('title', 'فيديو مستخرج') if info_dict else 'فيديو مستخرج',
            "thumbnail": info_dict.get('thumbnail', '') if info_dict else '',
            "duration": info_dict.get('duration', 0) if info_dict else 0,
            "uploader": info_dict.get('uploader', info_dict.get('extractor', 'غير معروف')) if info_dict else 'غير معروف',
            "formats": formats_to_return,
            "error_note": error_msg if not info_dict else None
        }), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": "حدث خطأ داخلي في الخادم: " + str(e)
        }), 200


@app.route('/api/download', methods=['POST'])
def download():
    try:
        url = request.form.get('url')
        format_id = request.form.get('format_id', 'best')

        if not url:
            return jsonify({"success": False, "error": "الرابط مطلوب"}), 200
            
        cookie_file_path = None
        if 'cookies' in request.files:
            file = request.files['cookies']
            if file.filename:
                fd, cookie_file_path = tempfile.mkstemp(suffix=".txt", dir=tempfile.gettempdir())
                file.save(cookie_file_path)

        tmp_dir = tempfile.gettempdir()
        out_tmpl = os.path.join(tmp_dir, '%(id)s_%(format_id)s.%(ext)s')

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'format': format_id,
            'outtmpl': out_tmpl,
        }
        
        if cookie_file_path:
            ydl_opts['cookiefile'] = cookie_file_path

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                
            @after_this_request
            def remove_file(response):
                try:
                    os.remove(filename)
                except Exception as e:
                    print(f"Error removing file {filename}: {e}")
                
                if cookie_file_path and os.path.exists(cookie_file_path):
                    try:
                        os.remove(cookie_file_path)
                    except:
                        pass
                return response

            safe_title = info.get('title', 'video').replace('/', '_').replace('\\', '_')
            ext = info.get('ext', 'mp4')
            download_name = f"{safe_title}.{ext}"

            return send_file(filename, as_attachment=True, download_name=download_name)
            
        except Exception as e:
            if cookie_file_path and os.path.exists(cookie_file_path):
                try:
                    os.remove(cookie_file_path)
                except:
                    pass
            return jsonify({"success": False, "error": "فشل التحميل: " + str(e)}), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": "حدث خطأ داخلي في الخادم أثناء التحميل: " + str(e)
        }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
