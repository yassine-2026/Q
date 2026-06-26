// Modified to use Render backend https://bayhon.onrender.com
const API_BASE = 'https://bayhon.onrender.com';

// عناصر الواجهة (تأكد من وجودها في index.html)
const form = document.getElementById('download-form');
const urlInput = document.getElementById('url-input');
const resultDiv = document.getElementById('result');
const errorDiv = document.getElementById('error');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const url = urlInput.value.trim();
    if (!url) {
      showError('الرجاء إدخال رابط الفيديو');
      return;
    }

    // إخفاء النتائج السابقة وإظهار حالة التحميل
    resultDiv.innerHTML = '<div style="text-align:center; padding:20px;">جاري التحليل...</div>';
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
    resultDiv.style.display = 'block';

    // تجهيز FormData
    const formData = new FormData();
    formData.append('url', url);

    // إضافة ملف الكوكيز إذا اختاره المستخدم
    const cookiesFile = document.getElementById('cookies-file')?.files[0];
    if (cookiesFile) {
      formData.append('cookies', cookiesFile);
    }

    try {
      const response = await fetch(`${API_BASE}/api/info`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        displayInfo(data);
      } else {
        showError(data.error || 'فشل تحليل الرابط');
      }
    } catch (err) {
      showError('حدث خطأ في الاتصال بالخادم. تأكد من اتصالك بالإنترنت.');
    }
  });
}

function displayInfo(info) {
  let html = `
    <div style="text-align: center; margin-bottom: 20px;">
        <h3>${info.title}</h3>
        ${info.thumbnail ? `<img src="${info.thumbnail}" alt="صورة مصغرة" style="max-width:100%; border-radius: 8px; margin: 10px 0; max-height: 300px; object-fit: cover;">` : ''}
        <p style="color: var(--text-muted);">المنصة: ${info.uploader || info.platform || 'غير معروف'}</p>
    </div>
    <h4>اختر الجودة:</h4>
    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
  `;

  if (info.formats && info.formats.length > 0) {
      info.formats.forEach((format) => {
        const filesizeText = format.filesize ? `${(format.filesize / 1024 / 1024).toFixed(2)} MB` : 'غير معروف الحجم';
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid var(--border);">
              <div>
                  <div style="font-weight: bold;">${format.quality || format.label}</div>
                  <div style="font-size: 0.85em; color: var(--text-muted);">${format.ext} - ${format.type} | ${filesizeText}</div>
              </div>
              ${format.url && format.label && format.label.includes("مباشر") ? 
                `<a href="${format.url}" target="_blank" class="download-btn" style="text-decoration:none; display:inline-block; line-height: normal; text-align:center;">تحميل مباشر</a>` :
                `<button class="download-btn" data-format="${format.format_id}">تحميل (${format.ext})</button>`
              }
          </div>
        `;
      });
  } else {
      html += `<p>لا توجد صيغ متاحة.</p>`;
  }
  
  html += `</div>`;
  resultDiv.innerHTML = html;

  // إضافة أحداث النقر على أزرار التحميل
  document.querySelectorAll('.download-btn[data-format]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const originalText = btn.textContent;
        btn.textContent = 'جاري التحميل...';
        btn.disabled = true;
        downloadVideo(info, btn.dataset.format).finally(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        });
    });
  });
}

async function downloadVideo(info, formatId) {
  const formData = new FormData();
  formData.append('url', urlInput.value.trim()); // نفس الرابط الأصلي
  formData.append('format_id', formatId);

  const cookiesFile = document.getElementById('cookies-file')?.files[0];
  if (cookiesFile) {
    formData.append('cookies', cookiesFile);
  }

  try {
    const response = await fetch(`${API_BASE}/api/download`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      showError(errData.error || 'فشل التحميل');
      return;
    }

    // استخراج اسم الملف من رأس Content-Disposition إن وجد
    const disposition = response.headers.get('Content-Disposition');
    let filename = 'video.mp4';
    if (disposition && disposition.includes('filename=')) {
        const matches = disposition.match(/filename="?([^"]+)"?/);
        if (matches && matches[1]) {
            filename = matches[1];
        } else {
            filename = disposition.split('filename=')[1].replace(/"/g, '');
        }
    } else {
        const safeTitle = info.title ? info.title.replace(/[\/\\]/g, '_') : 'video';
        filename = `${safeTitle}.mp4`;
    }

    // تحميل الملف
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    showError('حدث خطأ أثناء التحميل');
  }
}

function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.style.display = 'block';
  resultDiv.innerHTML = '';
  resultDiv.style.display = 'none';
}
