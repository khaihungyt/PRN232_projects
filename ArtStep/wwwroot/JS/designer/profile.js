
// =============================================
// Global Variables
// =============================================
let avatarBase64 = null;
let currentProfileData = null;

// =============================================
// Utility Functions
// =============================================

/**
 * Hiển thị thông báo toast
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại thông báo (success, error)
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Bật/tắt trạng thái loading của button
 * @param {HTMLElement} button - Button element
 * @param {boolean} isLoading - Trạng thái loading
 */
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        button.disabled = true;
    } else {
        button.textContent = button.dataset.originalText;
        button.disabled = false;
    }
}

// =============================================
// Profile Functions
// =============================================

/**
 * Lấy thông tin profile từ API
 */
async function fetchProfile() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('Chưa có token. Vui lòng đăng nhập trước khi load profile.');
            return;
        }
        const response = await fetch('/api/profile/Profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch profile data');
        }

        return data;
    } catch (error) {
        console.error('Fetch profile error:', error);
        showToast(error.message || 'Failed to load profile data', 'error');
        throw error;
    }
}

/**
 * Cập nhật thông tin profile lên form
 */
async function loadProfileData() {
    try {
        currentProfileData = await fetchProfile();

        document.getElementById('full-name').value = currentProfileData.Name || '';
        document.getElementById('email').value = currentProfileData.Email || '';
        document.getElementById('phone').value = currentProfileData.PhoneNo || '';
        //document.getElementById('username').value = data.username || '';

        // Cập nhật avatar
        if (currentProfileData.ImageProfile) {
            document.getElementById('profile-avatar-img').src = currentProfileData.ImageProfile;
            avatarBase64 = currentProfileData.ImageProfile;
        }
    } catch (error) {
        // Error đã được xử lý trong fetchProfile
        throw new Error(error);
    }
}

/**
 * Xử lý upload avatar
 */
function setupAvatarUpload() {
    const avatarUpload = document.getElementById('avatar-upload');
    const changeAvatarBtn = document.getElementById('change-avatar-btn');

    changeAvatarBtn.addEventListener('click', () => avatarUpload.click());

    avatarUpload.addEventListener('change', (e) => {
        if (!e.target.files?.length) return;

        const file = e.target.files[0];

        // Validate file
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            showToast('Image size should be less than 2MB', 'error');
            return;
        }

        const reader = new FileReader();

        reader.onload = (event) => {
            avatarBase64 = event.target.result;
            document.getElementById('profile-avatar-img').src = avatarBase64;
        };

        reader.onerror = () => {
            showToast('Error reading image file', 'error');
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Xử lý submit form profile
 */
function setupProfileForm() {
    const form = document.getElementById('profile-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');

        try {
            setButtonLoading(submitBtn, true);

            // Tạo đối tượng FormData
            const formData = new FormData();

            // Thêm các trường text
            formData.append('name', document.getElementById('full-name').value.trim());
            formData.append('email', document.getElementById('email').value.trim());
            formData.append('phoneNo', document.getElementById('phone').value.trim());

            // Thêm avatarBase64 nếu có (truyền trực tiếp dạng string)
            if (avatarBase64) {
                formData.append('avatar', avatarBase64);
            }

            // Validate
            if (!formData.get('name') || !formData.get('email')) {
                throw new Error('Name and email are required');
            }
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('Chưa có token. Vui lòng đăng nhập trước khi load profile.');
                return;
            }
            const response = await fetch('/api/Profile/UpdateProfile', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update profile');
            }

            showToast('Chỉnh sửa thông tin thành công!', 'success');
            avatarBase64 = null; // Reset sau khi update thành công
            currentProfileData = await fetchProfile(); // Refresh data
        } catch (error) {
            console.error('Update profile error:', error);
            showToast(error.message || 'Failed to update profile', 'error');
        } finally {
            setButtonLoading(submitBtn, false);
        }
    });
}

// =============================================
// Account Functions
// =============================================

/**
 * Xử lý submit form account
 */
function setupAccountForm() {
    const form = document.getElementById('account-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');

        try {
            setButtonLoading(submitBtn, true);

            const formData = {
                currentPassword: document.getElementById('current-password').value,
                newPassword: document.getElementById('new-password').value,
                confirmPassword: document.getElementById('confirm-password').value
            };

            // Validate
            if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
                throw new Error('New password and confirmation do not match');
            }
            const payload = new FormData();
            // Chỉ gửi newPassword nếu có
            //const payload = {
            //    oldPassword: formData.currentPassword,
            //    ...(formData.newPassword && { newPassword: formData.newPassword })
            //};
            payload.append('oldPassword', formData.currentPassword);
            if (formData.newPassword) {
                payload.append('newPassword', formData.newPassword);
            }
            const response = await fetch('/api/Profile/ChangePassword', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: payload
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update account');
            }

            showToast('Account updated successfully!', 'success');

            // Clear password fields
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';

            currentProfileData = await fetchProfile(); // Refresh data
        } catch (error) {
            console.error('Update account error:', error);
            showToast(error.message || 'Failed to update account', 'error');
        } finally {
            setButtonLoading(submitBtn, false);
        }
    });
}

// =============================================
// Tab Functionality
// =============================================

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            this.classList.add('active');
            document.getElementById(`${this.dataset.tab}-tab`).classList.add('active');
        });
    });
}

// =============================================
// Initialization
// =============================================

document.addEventListener('DOMContentLoaded', async function () {
    // Setup tabs
    setupTabs();

    // Setup avatar upload
    setupAvatarUpload();

    // Setup forms
    setupProfileForm();
    setupAccountForm();

    // Load profile data
    await loadProfileData();
});

// =============================================
// Logout Functionality (if needed)
// =============================================

document.getElementById('logout-btn')?.addEventListener('click', function () {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
});














