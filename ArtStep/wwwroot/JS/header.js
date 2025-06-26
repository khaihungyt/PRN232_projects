import { API_BASE_URL } from './config.js';
import { WalletManager } from '/JS/wallet.js';

// Quản lý phần Header (Thanh điều hướng)
export class HeaderManager {
    constructor() {
        this.walletManager = new WalletManager();
    }

    // Khởi tạo header tùy theo trạng thái đăng nhập
    async initializeHeader() {
        const navbarAuth = document.getElementById('navbarAuth');
        if (!navbarAuth) {
            console.warn('Không tìm thấy phần tử navbarAuth');
            return;
        }

        const token = localStorage.getItem('token');

        if (token) {
            await this.renderAuthenticatedHeader(navbarAuth); // Nếu đã đăng nhập
        } else {
            this.renderUnauthenticatedHeader(navbarAuth); // Nếu chưa đăng nhập
        }
    }

    // Header cho người dùng đã đăng nhập
    async renderAuthenticatedHeader(navbarAuth) {
        try {
            const walletBalance = await this.walletManager.fetchWalletBalance();

            navbarAuth.innerHTML = `
                ${walletBalance !== null ? this.walletManager.createWalletDisplay(walletBalance) : ''}
                <li class="nav-item">
                    <a class="nav-link" href="#" onclick="goToCart()">
                        <i class="bi bi-cart"></i> Giỏ hàng
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/UserProfile.html">
                        <i class="bi bi-person-circle"></i> Hồ sơ
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" id="logoutBtn">
                        <i class="bi bi-box-arrow-right"></i> Đăng xuất
                    </a>
                </li>
            `;

            this.walletManager.init();
            this.setupLogoutHandler(); // Gán chức năng đăng xuất

        } catch (error) {
            console.error('Lỗi khi hiển thị header người dùng:', error);
            navbarAuth.innerHTML = `
                <li class="nav-item">
                    <a class="nav-link" href="#" onclick="goToCart()">
                        <i class="bi bi-cart"></i> Giỏ hàng
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="UserProfile.html">
                        <i class="bi bi-person-circle"></i> Hồ sơ
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" id="logoutBtn">
                        <i class="bi bi-box-arrow-right"></i> Đăng xuất
                    </a>
                </li>
            `;
            this.setupLogoutHandler();
        }
    }

    // Header cho người dùng chưa đăng nhập
    renderUnauthenticatedHeader(navbarAuth) {
        navbarAuth.innerHTML = `
            <li class="nav-item">
                <a class="nav-link" href="/Login.html">
                    <i class="bi bi-person-circle"></i> Đăng nhập
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" href="/Register.html">
                    <i class="bi bi-person-plus"></i> Đăng ký
                </a>
            </li>
        `;
    }

    // Xử lý khi người dùng nhấn nút Đăng xuất
    setupLogoutHandler() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function (e) {
                e.preventDefault();
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                localStorage.removeItem('username');
                localStorage.removeItem('userId');
                window.location.reload();
            });
        }
    }

    // Cập nhật số dư ví trong header sau khi thực hiện giao dịch
    async updateWalletBalance() {
        if (localStorage.getItem('token')) {
            await this.walletManager.updateWalletDisplay();
        }
    }

    // Lấy số dư ví hiện tại
    async getCurrentWalletBalance() {
        return await this.walletManager.fetchWalletBalance();
    }
}

// Khởi tạo header manager
window.headerManager = new HeaderManager();

// Chuyển hướng tới trang giỏ hàng
window.goToCart = function () {
    window.location.href = '/cart';
};

// Chuyển hướng tới trang ví
window.goToWallet = function () {
    window.location.href = '/wallet';
};

// Khi trang được tải, khởi tạo header
document.addEventListener('DOMContentLoaded', async function () {
    await window.headerManager.initializeHeader();
});
