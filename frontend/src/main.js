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
    resultDiv.innerHTML = 'جاري التحليل...';
    errorDiv.textContent = '';

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
    <h3>${info.title}</h3>
    <img src="${info.thumbnail}" alt="صورة مصغرة" style="max-width:100%">
    <p>المنصة: ${info.platform || 'غير معروف'}</p>
    <h4>اختر الجودة:</h4>
  `;

  info.formats.forEach((format) => {
    html += `
      <button class="download-btn" data-format="${format.format_id}">
        ${format.quality} (${format.ext}) - ${format.filesize ? format.filesize + ' بايت' : 'حجم غير معروف'}
      </button><br>
    `;
  });

  resultDiv.innerHTML = html;

  // إضافة أحداث النقر على أزرار التحميل
  document.querySelectorAll('.download-btn').forEach((btn) => {
    btn.addEventListener('click', () => downloadVideo(info, btn.dataset.format));
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
      filename = disposition.split('filename=')[1].replace(/"/g, '');
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
  resultDiv.innerHTML = '';
}
