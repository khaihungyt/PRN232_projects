document.addEventListener('DOMContentLoaded', function () {
    // Check authentication
    const token = localStorage.getItem('token');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const generateBtn = document.getElementById('generateBtn');

    if (token) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
    } else {
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="bi bi-lock"></i> Vui lòng đăng nhập để sử dụng tính năng này';
    }

    // Login/Logout handlers
    loginBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
    });

    logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.removeItem('token');
        window.location.reload();
    });

    // Generate button handler
    generateBtn.addEventListener('click', async function () {
        const prompt = document.getElementById('aiPrompt').value.trim();
        const size = document.getElementById('aiSize').value;
        const number = parseInt(document.getElementById('aiNumber').value);

        if (!prompt) {
            alert('Vui lòng nhập mô tả cho hình ảnh');
            return;
        }

        // Show loading
        document.getElementById('loadingIndicator').style.display = 'block';
        document.getElementById('emptyState').style.display = 'none';

        try {
            const response = await fetch('/api/AIImange/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    Prompt: prompt,
                    NumImages: number,
                    Size: size
                })
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            const data = await response.json();
            displayResults(data);
        } catch (error) {
            console.error('Generation error:', error);
            alert('Có lỗi xảy ra khi tạo hình ảnh: ' + error.message);
        } finally {
            document.getElementById('loadingIndicator').style.display = 'none';
        }
    });

    // Display generated images
    function displayResults(data) {
        const resultsContainer = document.getElementById('generatedResults');
        const emptyState = document.getElementById('emptyState');

        // Clear previous results
        resultsContainer.innerHTML = '';

        if (data.data && data.data.length > 0) {
            emptyState.style.display = 'none';

            data.data.forEach((image, index) => {
                const imageCard = document.createElement('div');
                imageCard.className = 'ai-image-card';
                imageCard.innerHTML = `
                    <img src="${image.url}" class="ai-image" alt="AI Generated Image" data-full-url="${image.url}">
                    <div class="ai-image-actions">
                        <small class="text-muted">${new Date().toLocaleString()}</small>
                        <button class="btn btn-sm btn-outline-primary download-btn" data-url="${image.url}">
                            <i class="bi bi-download"></i> Tải về
                        </button>
                    </div>
                `;
                resultsContainer.appendChild(imageCard);
            });

            // Add click handlers for download buttons
            document.querySelectorAll('.download-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const imageUrl = btn.getAttribute('data-url');
                    downloadImageDirectly(imageUrl);
                });
            });

            // Add click handlers for zooming images
            document.querySelectorAll('.ai-image').forEach(img => {
                img.addEventListener('click', function () {
                    const fullUrl = this.getAttribute('data-full-url');
                    document.getElementById('modalImage').src = fullUrl;
                    document.getElementById('downloadFullBtn').href = fullUrl;
                    const modal = new bootstrap.Modal(document.getElementById('imageModal'));
                    modal.show();
                });
            });
        } else {
            emptyState.style.display = 'flex';
        }
    }

    // Direct download using iframe method
    function downloadImageDirectly(imageUrl) {
        // First try with iframe method
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = imageUrl;
        document.body.appendChild(iframe);

        // Fallback if iframe doesn't work
        setTimeout(() => {
            document.body.removeChild(iframe);
            showDownloadGuide(imageUrl);
        }, 3000);
    }

    // Fallback download guide
    function showDownloadGuide(imageUrl) {
        const guideWindow = window.open('', '_blank');
        guideWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Hướng dẫn tải ảnh</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 20px; 
                        text-align: center; 
                        background-color: #f8f9fa;
                    }
                    .guide-container {
                        max-width: 500px;
                        margin: 0 auto;
                        padding: 20px;
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    img { 
                        max-width: 100%; 
                        margin: 20px 0; 
                        border: 1px solid #ddd;
                        border-radius: 8px;
                    }
                    .instructions { 
                        margin: 20px 0; 
                        line-height: 1.6;
                    }
                    button {
                        padding: 10px 20px;
                        background: #0d6efd;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                    }
                </style>
            </head>
            <body>
                <div class="guide-container">
                    <h3>Hướng dẫn tải ảnh</h3>
                    <div class="instructions">
                        <p>Để tải ảnh, vui lòng:</p>
                        <ol>
                            <li>Nhấn chuột phải vào ảnh bên dưới</li>
                            <li>Chọn <strong>"Lưu hình ảnh thành..."</strong></li>
                            <li>Chọn vị trí lưu trên máy tính của bạn</li>
                        </ol>
                    </div>
                    <img src="${imageUrl}" alt="AI Generated Image">
                    <button onclick="window.close()">Đóng hướng dẫn</button>
                </div>
            </body>
            </html>
        `);
    }

    // Modal download button handler
    document.getElementById('downloadFullBtn').addEventListener('click', function (e) {
        e.preventDefault();
        const imageUrl = document.getElementById('modalImage').src;
        downloadImageDirectly(imageUrl);
    });

    // Load previously generated images
    function loadPreviousGenerations() {
        const savedGenerations = JSON.parse(localStorage.getItem('aiGenerations')) || [];
        if (savedGenerations.length > 0) {
            document.getElementById('emptyState').style.display = 'none';
            savedGenerations.forEach(generation => {
                displayResults({ data: generation.images });
            });
        }
    }

    // Load any previous generations on page load
    loadPreviousGenerations();
});