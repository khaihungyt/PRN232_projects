document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');
    const avatarInput = document.getElementById('avatarInput');

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const termsCheckbox = document.getElementById("termsCheckbox");

        // Kiểm tra mật khẩu khớp
        if (password !== confirmPassword) {
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: 'Mật khẩu không khớp!'
            });
            return;
        }

        // Kiểm tra đã đồng ý điều khoản chưa
        if (!termsCheckbox.checked) {
            Swal.fire({
                icon: 'warning',
                title: 'Bạn chưa đồng ý điều khoản!',
                text: 'Vui lòng đọc và đồng ý với Điều khoản và dịch vụ trước khi đăng ký.'
            });
            return;
        }

        const formData = new FormData(form);

        // Chuyển avatar thành base64 nếu có
        if (avatarInput && avatarInput.files.length > 0) {
            const base64 = await toBase64(avatarInput.files[0]);
            formData.append('Avatar', base64);
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Thành công',
                    text: result.message || 'Đăng ký thành công!',
                    confirmButtonText: 'OK'
                }).then(() => {
                    window.location.href = '/Login.html'; // Redirect to login page
                });
                form.reset();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Thất bại',
                    text: result.message || 'Đăng ký thất bại.'
                });
            }
        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: 'Có lỗi xảy ra khi đăng ký.'
            });
        }
    });

    function toBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
        });
    }
});
