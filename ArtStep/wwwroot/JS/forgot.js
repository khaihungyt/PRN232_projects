document.addEventListener('DOMContentLoaded', () => {
    const forgotForm = document.getElementById('forgotForm');
    const resetForm = document.getElementById('resetForm');
    const emailInput = document.getElementById('emailInput');
    const resetCodeInput = document.getElementById('resetCode');
    const newPasswordInput = document.getElementById('newPassword');
    const successMessage = document.getElementById('successMessage');

    let userEmail = '';

    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();

        try {
            const res = await fetch(`/api/Auth/forgot?email=${encodeURIComponent(email)}`);
            const data = await res.json();

            if (res.ok) {
                toastr.success(data.message);
                userEmail = email;
                resetForm.style.display = 'block';
                forgotForm.querySelector('button').disabled = true;
            } else {
                toastr.error(data.message || "Email không hợp lệ.");
            }
        } catch (err) {
            toastr.error("Lỗi gửi mã xác nhận.");
            console.error(err);
        }
    });

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const resetCode = resetCodeInput.value.trim();
        const newPassword = newPasswordInput.value;

        try {
            const res = await fetch('/api/Auth/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userEmail,
                    resetCode,
                    newPassword
                })
            });

            const data = await res.json();

            if (res.ok) {
                toastr.success(data.message);
                resetForm.reset();
                resetForm.style.display = 'none';
                successMessage.textContent = "Mật khẩu đã đặt lại thành công!";
                successMessage.style.display = 'block';
            } else {
                toastr.error(data.message || "Không thể đặt lại mật khẩu.");
            }
        } catch (err) {
            toastr.error("Lỗi đặt lại mật khẩu.");
            console.error(err);
        }
    });
});
