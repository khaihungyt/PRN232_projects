$(document).ready(function () {
    // Lấy token từ localStorage hoặc cookie
    const token = localStorage.getItem('token') || getCookie('designer_token');

    // Nếu không có token, chuyển hướng về trang login
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Load feedback khi trang tải
    loadFeedback();

    // Xử lý sự kiện làm mới
    $('#refresh-btn').click(function () {
        loadFeedback();
    });

    // Xử lý lọc theo rating
    $('#rating-filter').change(function () {
        loadFeedback();
    });

    // Hàm load feedback từ API
    function loadFeedback() {
        showLoader();

        const ratingFilter = $('#rating-filter').val();
        let apiUrl = '/api/Designer/designer_feedback';

        if (ratingFilter !== 'all') {
            apiUrl += `?rating=${ratingFilter}`;
        }

        $.ajax({
            url: apiUrl,
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            success: function (response) {
                renderFeedback(response);
                updateStats(response);
                hideLoader();
            },
            error: function (xhr, status, error) {
                console.error('Error fetching feedback:', error);
                alert('Có lỗi khi tải đánh giá. Vui lòng thử lại sau.');
                hideLoader();
            }
        });
    }

    // Hàm render danh sách feedback
    function renderFeedback(feedbacks) {
        const $feedbackList = $('#feedback-list');

        if (!feedbacks || feedbacks.length === 0) {
            $feedbackList.html(`
                <div class="empty-state">
                    <i class="fas fa-comment-alt"></i>
                    <p>Không có đánh giá nào</p>
                </div>
            `);
            return;
        }

        let html = '';
        feedbacks.forEach(feedback => {
            html += `
                <div class="feedback-item">
                    <div class="feedback-user">
                        <img src="${feedback.User.Avatar || '/images/default-avatar.jpg'}" 
                             alt="${feedback.User.UserName}" 
                             class="feedback-avatar">
                        <span class="feedback-user-name">${feedback.User.UserName || 'Khách hàng ẩn danh'}</span>
                    </div>
                    <div class="feedback-stars">
                        ${renderStars(feedback.FeedbackStars)}
                    </div>
                    <div class="feedback-content">
                        ${feedback.FeedbackDescription}
                    </div>
                </div>
            `;
        });

        $feedbackList.html(html);
    }

    // Hàm render sao đánh giá
    function renderStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += '<i class="fas fa-star"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        return stars;
    }

    // Hàm cập nhật thống kê
    function updateStats(feedbacks) {
        if (!feedbacks || feedbacks.length === 0) {
            $('#total-feedback').text('0');
            $('#avg-rating').text('0.0');
            $('#five-star').text('0');
            return;
        }

        const total = feedbacks.length;
        const totalStars = feedbacks.reduce((sum, fb) => sum + fb.FeedbackStars, 0);
        const avgRating = (totalStars / total).toFixed(1);
        const fiveStarCount = feedbacks.filter(fb => fb.FeedbackStars === 5).length;

        $('#total-feedback').text(total);
        $('#avg-rating').text(avgRating);
        $('#five-star').text(fiveStarCount);
    }

    // Hàm lấy cookie
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    // Hàm hiển thị loader
    function showLoader() {
        $('.loader-wrapper').addClass('active');
    }

    // Hàm ẩn loader
    function hideLoader() {
        $('.loader-wrapper').removeClass('active');
    }
});