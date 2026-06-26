const API_BASE = 'https://bayhon.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetchBtn');
    const videoUrlInput = document.getElementById('videoUrl');
    const cookieFileInput = document.getElementById('cookieFile');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const resultDiv = document.getElementById('result');
    const videoThumb = document.getElementById('videoThumb');
    const videoTitle = document.getElementById('videoTitle');
    const videoUploader = document.getElementById('videoUploader');
    const formatsList = document.getElementById('formatsList');

    fetchBtn.addEventListener('click', async () => {
        const url = videoUrlInput.value.trim();
        if (!url) {
            showError('الرجاء إدخال رابط الفيديو.');
            return;
        }

        let cookiesText = '';
        const cookieFile = cookieFileInput.files[0];
        
        if (cookieFile) {
            try {
                cookiesText = await cookieFile.text();
            } catch (err) {
                showError('تعذر قراءة ملف الكوكيز. تأكد من أنه ملف نصي صالح.');
                return;
            }
        }

        // Reset UI
        hideError();
        resultDiv.classList.add('hidden');
        loadingDiv.classList.remove('hidden');
        fetchBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE}/api/info`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, cookies: cookiesText })
            });

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                throw new Error('حدث خطأ في الخادم (استجابة غير صالحة). يرجى المحاولة لاحقاً.');
            }

            if (!response.ok || !data.success) {
                throw new Error(data.error || data.error_note || 'فشل استخراج الفيديو. يرجى التأكد من الرابط.');
            }

            displayResult(data);

        } catch (error) {
            showError(error.message);
        } finally {
            loadingDiv.classList.add('hidden');
            fetchBtn.disabled = false;
        }
    });

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    function hideError() {
        errorDiv.textContent = '';
        errorDiv.classList.add('hidden');
    }

    function displayResult(data) {
        // Populate info
        if (data.thumbnail) {
            videoThumb.src = data.thumbnail;
            videoThumb.classList.remove('hidden');
        } else {
            videoThumb.classList.add('hidden');
        }

        videoTitle.textContent = data.title || 'فيديو غير معروف';
        videoUploader.textContent = data.uploader ? `الناشر: ${data.uploader}` : '';
        
        if (data.error_note) {
            // If fallback was used, we might want to show a warning
            const p = document.createElement('p');
            p.textContent = data.error_note;
            p.style.color = 'orange';
            p.style.fontSize = '0.9rem';
            p.style.marginTop = '0.5rem';
            videoUploader.appendChild(p);
        }

        // Populate formats
        formatsList.innerHTML = '';
        
        if (!data.formats || data.formats.length === 0) {
            formatsList.innerHTML = '<p style="color:var(--text-muted);">لا توجد صيغ متاحة للتحميل المباشر.</p>';
        } else {
            data.formats.forEach(format => {
                const formatItem = document.createElement('div');
                formatItem.className = 'format-item';
                
                const detailsDiv = document.createElement('div');
                detailsDiv.className = 'format-details';
                
                const qualitySpan = document.createElement('span');
                qualitySpan.className = 'format-quality';
                qualitySpan.textContent = format.label || format.quality;
                
                const typeSpan = document.createElement('span');
                typeSpan.className = 'format-type';
                typeSpan.textContent = `النوع: ${format.type} • الصيغة: ${format.ext}`;
                
                detailsDiv.appendChild(qualitySpan);
                detailsDiv.appendChild(typeSpan);
                
                const downloadBtn = document.createElement('a');
                downloadBtn.className = 'download-btn';
                downloadBtn.href = format.url;
                downloadBtn.target = '_blank';
                downloadBtn.rel = 'noopener noreferrer';
                downloadBtn.textContent = 'تحميل';
                
                // For direct file downloads, you can add download attribute
                // downloadBtn.download = ''; 
                
                formatItem.appendChild(detailsDiv);
                formatItem.appendChild(downloadBtn);
                
                formatsList.appendChild(formatItem);
            });
        }

        resultDiv.classList.remove('hidden');
    }
});
