document.addEventListener('DOMContentLoaded', () => {
    const generalForm = document.getElementById('generalForm');
    const profileTab = document.getElementById('account-general');

    const avatarPreview = profileTab.querySelector('#avatarPreview');
    const avatarInput = profileTab.querySelector('#avatarInput');
    const fullNameInput = profileTab.querySelector('#fullName');
    const emailInput = profileTab.querySelector('#email');
    const phoneInput = profileTab.querySelector('#phoneNo');
    const roleInput = profileTab.querySelector('#role');
    const isActiveChk = profileTab.querySelector('#isActive');

    const showSuccessAlert = (message) => {
        Swal.fire({
            icon: 'success',
            title: 'Thành công!',
            text: message,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false
        });
    };

    const showErrorAlert = (message) => {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi!',
            text: message,
            showConfirmButton: true 
        });
    };

    //Load profile
    async function loadProfile() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('Chưa có token. Vui lòng đăng nhập trước khi load profile.');
                return;
            }

            const res = await fetch('/api/Profile/profile', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();

            if (res.ok) {
                if (data.ImageProfile?.startsWith('data:image')) {
                    avatarPreview.src = data.ImageProfile;
                } else if (data.ImageProfile) {
                    avatarPreview.src = `data:image/png;base64,${data.ImageProfile}`;
                } else {
                    avatarPreview.src = "https://bootdey.com/img/Content/avatar/avatar1.png";
                }

                fullNameInput.value = data.Name || ''; 
                emailInput.value = data.Email || ''; 
                phoneInput.value = data.PhoneNo || ''; 
                roleInput.value = data.Role || '';
                isActiveChk.checked = data.isActive === true; 
            } else {
                showErrorAlert(data.message || 'Không thể load thông tin người dùng.');
            }
        } catch (err) {
            showErrorAlert('Lỗi khi lấy thông tin profile.');
            console.error(err);
        }
    }

    loadProfile();

    avatarInput.addEventListener('change', () => {
        const file = avatarInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => {
                avatarPreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            avatarPreview.src = "https://bootdey.com/img/Content/avatar/avatar1.png";
        }
    });

    generalForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData();

        if (avatarInput.files[0]) {
            const file = avatarInput.files[0];
            const base64String = await convertToBase64(file);
            formData.append('Avatar', base64String);
        }

        formData.append('Name', fullNameInput.value.trim());
        formData.append('Email', emailInput.value.trim());
        formData.append('PhoneNo', phoneInput.value.trim());

        try {
            const res = await fetch('/api/Profile/UpdateProfile', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                showSuccessAlert(data.message || 'Cập nhật thông tin thành công!');
                loadProfile();
            } else {
                showErrorAlert(data.message || 'Đã có lỗi khi cập nhật thông tin.');
            }
        } catch (err) {
            showErrorAlert('Lỗi khi gửi yêu cầu cập nhật.');
            console.error(err);
        }
    });

    function convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

});

// Đặt ở ngoài DOMContentLoaded
const showSuccessAlert = (message) => {
    Swal.fire({
        icon: 'success',
        title: 'Thành công!',
        text: message,
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false
    });
};

const showErrorAlert = (message) => {
    Swal.fire({
        icon: 'error',
        title: 'Lỗi!',
        text: message,
        showConfirmButton: true
    });
};


// Change password:
const changePwdForm = document.querySelector('#account-change-password form');

const user = JSON.parse(localStorage.getItem('userInfo'));
if (user?.loginProvider === 'Google') {
    Swal.fire({
        icon: 'info',
        title: 'Không thể đổi mật khẩu',
        text: 'Tài khoản đăng nhập bằng Google không thể đổi mật khẩu.',
        confirmButtonText: 'Quay lại'
    }).then(() => {
        window.location.href = '/home.html'; 
    });
    document.querySelector('#account-change-password').style.display = 'none';
}

changePwdForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.querySelector('#currentPassword').value.trim();
    const newPassword = document.querySelector('#newPassword').value.trim();
    const confirmPassword = document.querySelector('#confirmPassword').value.trim();

    if (newPassword !== confirmPassword) {
        showErrorAlert('Mật khẩu mới và xác nhận mật khẩu không khớp.');
        return;
    }

    const payload = {
        currentPassword: currentPassword,
        newPassword: newPassword
    };

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/Profile/ChangePassword', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            showSuccessAlert(data.message || 'Đổi mật khẩu thành công!');
            document.querySelector('#currentPassword').value = '';
            document.querySelector('#newPassword').value = '';
            document.querySelector('#confirmPassword').value = '';
        } else {
            showErrorAlert(data.message || 'Đổi mật khẩu thất bại.');
        }
    } catch (err) {
        showErrorAlert('Lỗi khi gửi yêu cầu đổi mật khẩu.');
        console.error(err);
    }
});