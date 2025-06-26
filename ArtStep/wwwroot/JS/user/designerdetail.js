function isValidBase64(str) {
    // Kiểm tra chuỗi base64 hợp lệ (bao gồm cả prefix data URL)
    const base64Regex = /^data:image\/(png|jpeg|jpg|gif);base64,([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/i;

    // Nếu đã có prefix data URL
    if (str.startsWith('data:image/')) {
        return base64Regex.test(str);
    }

    // Nếu chỉ là chuỗi base64 không có prefix
    const pureBase64Regex = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;
    return pureBase64Regex.test(str);
}
function getSafeImageSrc(imageData) {
    if (!imageData) return '../img/default-shoe.jpg';

    // Nếu đã là URL hoàn chỉnh
    if (imageData.startsWith('http') || imageData.startsWith('/') || imageData.startsWith('./')) {
        return imageData;
    }

    // Nếu là base64 hợp lệ (có hoặc không có prefix)
    if (isValidBase64(imageData)) {
        // Nếu đã có sẵn prefix
        if (imageData.startsWith('data:image/')) {
            return imageData;
        }
        // Thêm prefix nếu chỉ là chuỗi base64
        return `data:image/jpeg;base64,${imageData}`;
    }

    // Trường hợp không nhận dạng được
    console.warn('Invalid image data:', imageData);
    return '../img/default-shoe.jpg';
}

// Hàm gọi API để lấy thông tin designer
async function fetchDesignerDetail(designerId) {
    try {
        const response = await fetch(`/api/Designer/designer_detail/${designerId}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching designer details:', error);
        return null;
    }
}

// Hàm hiển thị dữ liệu lên trang
async function displayDesignerDetail() {
    // Lấy designerId từ URL (ví dụ: /designer.html?designerId=user002)
    const urlParams = new URLSearchParams(window.location.search);
    const designerId = urlParams.get('designerId') || 'user002'; // Fallback nếu không có

    const designerData = await fetchDesignerDetail(designerId);
    console.log(designerData);
    if (!designerData) {
        // Xử lý khi không lấy được dữ liệu
        document.getElementById('designsList').innerHTML = '<p class="text-danger">Không thể tải dữ liệu nhà thiết kế</p>';
        return;
    }

    // Hiển thị thông tin cơ bản của designer
    document.getElementById('designerName').textContent = designerData.DesignerName;
    document.getElementById('designerEmail').textContent = designerData.Email;
    document.getElementById('designerPhone').textContent = designerData.Phone;

    // Cập nhật avatar nếu có
    const avatarImg = document.querySelector('.designer-avatar');
    if (designerData.AvatarImage) {
        avatarImg.src = designerData.AvatarImage;
    }

    // Hiển thị đánh giá trung bình
    updateRatingStars(designerData.averageRating);
    document.getElementById('feedbackCount').textContent = designerData.FeedBackList.length;

    // Hiển thị danh sách thiết kế (shoe customs)
    const designsContainer = document.getElementById('designsList');
    if (designerData.ShoeCustomList?.length > 0) {
        designsContainer.innerHTML = designerData.ShoeCustomList.map(shoe => {
            const firstImage = shoe.ShoeImages?.[0]?.ImageLink || 'https://placehold.co/300x300';
            const imageSrc = getSafeImageSrc(firstImage);
            return `
            <div class="col-12 col-md-6 col-lg-4 col-xl-3">
                <div class="design-card card h-100 shadow-sm">
                    <img src="${imageSrc}" 
                         class="card-img-top" 
                         alt="${shoe.ShoeName}" 
                         style="height: 180px; object-fit: cover;"
                         onerror="this.src='../img/default-shoe.jpg'
                         loading="lazy"">
                    <div class="card-body">
                        <h5 class="card-title">${shoe.ShoeName}</h5>
                        <p class="card-text text-primary fw-bold">${shoe.PriceAShoe?.toLocaleString('vi-VN')}₫</p>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    } else {
        designsContainer.innerHTML = '<p>Nhà thiết kế chưa có sản phẩm nào</p>';
    }

    // Hiển thị danh sách feedback
    const feedbackContainer = document.getElementById('feedbackList');
    if (designerData.FeedBackList && designerData.FeedBackList.length > 0) {
        feedbackContainer.innerHTML = designerData.FeedBackList.map(feedback => `
            <div class="feedback-item p-3 mb-3">
                <div class="d-flex align-items-center mb-2">
                    <div class="rating-stars me-2">
                        ${'<i class="bi bi-star-fill"></i>'.repeat(feedback.FeedbackStars)}
                        ${'<i class="bi bi-star"></i>'.repeat(5 - feedback.FeedbackStars)}
                    </div>
                    <small class="text-muted">${feedback.User.UserName}</small>
                </div>
                <p class="mb-0">${feedback.FeedbackDescription}</p>
            </div>
        `).join('');
    } else {
        feedbackContainer.innerHTML = '<p>Chưa có đánh giá nào</p>';
    }
}

// Hàm cập nhật hiển thị sao đánh giá trung bình
function updateRatingStars(averageRating) {
    const starsContainer = document.getElementById('averageRating');
    starsContainer.innerHTML = '';

    const fullStars = Math.floor(averageRating);
    const hasHalfStar = averageRating % 1 >= 0.5;

    // Thêm sao đầy
    for (let i = 0; i < fullStars; i++) {
        starsContainer.innerHTML += '<i class="bi bi-star-fill"></i>';
    }

    // Thêm sao nửa nếu cần
    if (hasHalfStar) {
        starsContainer.innerHTML += '<i class="bi bi-star-half"></i>';
    }

    // Thêm sao rỗng cho phần còn lại
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
        starsContainer.innerHTML += '<i class="bi bi-star"></i>';
    }
}

// Gọi hàm chính khi trang tải xong
document.addEventListener('DOMContentLoaded', displayDesignerDetail);
