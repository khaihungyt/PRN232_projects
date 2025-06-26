import { API_BASE_URL } from './config.js';
import './header.js'; // Import header functionality

class WalletPageManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 10;
        this.isLoading = false;
    }

    // Initialize wallet page
    async init() {
        // Check authentication
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        await this.loadWalletInfo();
        await this.loadTransactionHistory();
        this.setupEventListeners();
    }

    // Load wallet balance and info
    async loadWalletInfo() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.displayWalletInfo(data);
        } catch (error) {
            console.error('Error loading wallet info:', error);
            this.showError('Failed to load wallet information');
        }
    }

    // Display wallet information
    displayWalletInfo(walletData) {
        const balanceElement = document.getElementById('wallet-balance');
        const walletIdElement = document.getElementById('wallet-id');
        const lastUpdatedElement = document.getElementById('last-updated');

        if (balanceElement) {
            balanceElement.textContent = this.formatCurrency(walletData.balance);
        }
        if (walletIdElement) {
            walletIdElement.textContent = walletData.walletId || 'N/A';
        }
        if (lastUpdatedElement) {
            lastUpdatedElement.textContent = new Date(walletData.updatedAt).toLocaleString('vi-VN');
        }
    }

    // Load transaction history
    async loadTransactionHistory(page = 1) {
        if (this.isLoading) return;

        try {
            this.isLoading = true;
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/wallet/transactions?page=${page}&pageSize=${this.pageSize}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.displayTransactionHistory(data);
            this.setupPagination(data);
        } catch (error) {
            console.error('Error loading transaction history:', error);
            this.showError('Failed to load transaction history');
        } finally {
            this.isLoading = false;
        }
    }

    // Display transaction history
    displayTransactionHistory(data) {
        const transactionList = document.getElementById('transaction-list');
        if (!transactionList) return;

        if (!data.transactions || data.transactions.length === 0) {
            transactionList.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-inbox text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-2">No transactions found</p>
                </div>
            `;
            return;
        }

        transactionList.innerHTML = data.transactions.map(transaction => {
            const isPositive = transaction.amount > 0;
            const typeClass = this.getTransactionTypeClass(transaction.transactionType);
            const statusClass = this.getStatusClass(transaction.status);

            return `
                <div class="transaction-item border-bottom py-3">
                    <div class="row align-items-center">
                        <div class="col-md-2">
                            <span class="badge ${typeClass}">${transaction.transactionType}</span>
                        </div>
                        <div class="col-md-3">
                            <div class="fw-semibold ${isPositive ? 'text-success' : 'text-danger'}">
                                ${isPositive ? '+' : ''}${this.formatCurrency(transaction.amount)}
                            </div>
                            <small class="text-muted">Balance: ${this.formatCurrency(transaction.balanceAfter)}</small>
                        </div>
                        <div class="col-md-4">
                            <div class="transaction-description">
                                ${transaction.description || 'N/A'}
                            </div>
                            ${transaction.paymentMethod ? `<small class="text-muted">via ${transaction.paymentMethod}</small>` : ''}
                        </div>
                        <div class="col-md-2">
                            <span class="badge ${statusClass}">${transaction.status}</span>
                        </div>
                        <div class="col-md-1 text-end">
                            <small class="text-muted">
                                ${new Date(transaction.createdAt).toLocaleDateString('vi-VN')}
                            </small>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Setup pagination
    setupPagination(data) {
        const pagination = document.getElementById('pagination');
        if (!pagination || data.totalPages <= 1) {
            if (pagination) pagination.innerHTML = '';
            return;
        }

        let paginationHTML = '';
        
        // Previous button
        if (data.currentPage > 1) {
            paginationHTML += `<button class="btn btn-outline-primary btn-sm me-1" onclick="walletPageManager.loadTransactionHistory(${data.currentPage - 1})">Previous</button>`;
        }

        // Page numbers
        for (let i = 1; i <= data.totalPages; i++) {
            if (i === data.currentPage) {
                paginationHTML += `<button class="btn btn-primary btn-sm me-1" disabled>${i}</button>`;
            } else {
                paginationHTML += `<button class="btn btn-outline-primary btn-sm me-1" onclick="walletPageManager.loadTransactionHistory(${i})">${i}</button>`;
            }
        }

        // Next button
        if (data.currentPage < data.totalPages) {
            paginationHTML += `<button class="btn btn-outline-primary btn-sm" onclick="walletPageManager.loadTransactionHistory(${data.currentPage + 1})">Next</button>`;
        }

        pagination.innerHTML = paginationHTML;
    }

    // Setup event listeners
    setupEventListeners() {
        const rechargeBtn = document.getElementById('recharge-btn');
        if (rechargeBtn) {
            rechargeBtn.addEventListener('click', () => this.showRechargeModal());
        }

        const rechargeForm = document.getElementById('recharge-form');
        if (rechargeForm) {
            rechargeForm.addEventListener('submit', (e) => this.handleRecharge(e));
        }

        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }

        const confirmTransferBtn = document.getElementById('confirm-transfer-btn');
        if (confirmTransferBtn) {
            confirmTransferBtn.addEventListener('click', () => this.handleTransferConfirmation());
        }
    }

    // Show recharge modal
    showRechargeModal() {
        const modal = document.getElementById('recharge-modal');
        if (modal) {
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
        }
    }

    // Handle recharge form submission
    async handleRecharge(event) {
        event.preventDefault();
        
        const amountInput = document.getElementById('recharge-amount');
        const descriptionInput = document.getElementById('recharge-description');
        
        if (!amountInput) return;

        const amount = parseFloat(amountInput.value);
        const description = descriptionInput ? descriptionInput.value : '';

        if (amount < 10000) {
            this.showError('Minimum recharge amount is 10,000 VND');
            return;
        }

        if (amount > 50000000) {
            this.showError('Maximum recharge amount is 50,000,000 VND');
            return;
        }

        // Store recharge data for QR code generation
        this.rechargeData = {
            amount: amount,
            description: description
        };

        // Close the recharge modal and show QR code modal
        const rechargeModal = bootstrap.Modal.getInstance(document.getElementById('recharge-modal'));
        if (rechargeModal) {
            rechargeModal.hide();
        }

        // Generate QR code and show modal
        await this.generateQRCode(amount, description);
    }

    // Generate QR code for payment
    async generateQRCode(amount, description) {
        try {
            // First, get payment info from your API
            const token = localStorage.getItem('token');
            const paymentInfoResponse = await fetch(`${API_BASE_URL}/wallet/payment-info`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!paymentInfoResponse.ok) {
                throw new Error('Failed to get payment information');
            }

            const paymentInfo = await paymentInfoResponse.json();

            // Generate content for transfer
            const transferContent = `NAP TIEN ${localStorage.getItem('userId')} ${amount}`;

            // Generate VietQR using Quick Link (no API key needed)
            const bankId = this.getBankId(paymentInfo.BankName);
            const accountNo = paymentInfo.AccountNumber;
            const template = 'compact2'; // Using compact2 for better information display
            const encodedDescription = encodeURIComponent(transferContent);
            const encodedAccountName = encodeURIComponent(paymentInfo.AccountHolderName);

            // Build VietQR Quick Link URL
            const qrImageUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amount}&addInfo=${encodedDescription}&accountName=${encodedAccountName}`;

            console.log('Generated VietQR URL:', qrImageUrl);

            // Create mock data structure similar to API response
            const qrData = {
                accountName: paymentInfo.AccountHolderName,
                qrDataURL: qrImageUrl
            };

            this.showQRCodeModal(qrData, paymentInfo, amount, transferContent);
        } catch (error) {
            console.error('Error generating QR code:', error);
            this.showError(error.message || 'Failed to generate QR code');
        }
    }

    // Show QR code modal with payment information
    showQRCodeModal(qrData, paymentInfo, amount, transferContent) {
        // Update QR code image
        const qrImage = document.getElementById('qr-code-image');
        if (qrImage) {
            qrImage.src = qrData.qrDataURL;
        }

        // Update payment information
        const bankNames = {
            '970418': 'BIDV',
            '970415': 'Vietinbank', 
            '970436': 'Vietcombank',
            '970422': 'Military Bank',
            '970407': 'Techcombank'
        };
        
        document.getElementById('bank-name').textContent = bankNames[paymentInfo.BankName] || 'BIDV';
        document.getElementById('account-number').textContent = paymentInfo.AccountNumber;
        document.getElementById('account-name').textContent = qrData.accountName || paymentInfo.AccountHolderName;
        document.getElementById('transfer-amount').textContent = this.formatCurrency(amount);
        document.getElementById('transfer-content').textContent = transferContent;

        // Show the modal
        const qrModal = new bootstrap.Modal(document.getElementById('qr-code-modal'));
        qrModal.show();
    }

    // Handle transfer confirmation
    async handleTransferConfirmation() {
        try {
            // Close QR modal
            const qrModal = bootstrap.Modal.getInstance(document.getElementById('qr-code-modal'));
            if (qrModal) {
                qrModal.hide();
            }

            // Show loading state
            Swal.fire({
                title: 'Đang xử lý...',
                text: 'Vui lòng chờ trong giây lát',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Call the recharge API
            if (this.rechargeData) {
                const result = await this.callRechargeAPI(this.rechargeData.amount, this.rechargeData.description);
                
                if (result.success) {
                    // Show success message
                    await Swal.fire({
                        title: 'Thành công!',
                        text: 'Yêu cầu nạp tiền của bạn đang được phê duyệt',
                        icon: 'success',
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#28a745'
                    });
                } else {
                    throw new Error(result.message || 'Recharge API failed');
                }
            } else {
                throw new Error('No recharge data available');
            }

            // Clear recharge data
            this.rechargeData = null;

            // Refresh data
            await this.refresh();
        } catch (error) {
            console.error('Error handling transfer confirmation:', error);
            this.showError(error.message || 'An error occurred while processing your request');
        }
    }

    // Call the recharge API
    async callRechargeAPI(amount, description) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/wallet/recharge`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: amount,
                    description: description || 'Wallet recharge via QR transfer'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Recharge API failed');
            }

            const result = await response.json();
            console.log('Recharge API result:', result);
            return result;
        } catch (error) {
            console.error('Error calling recharge API:', error);
            throw error;
        }
    }



    // Refresh wallet data
    async refresh() {
        await this.loadWalletInfo();
        await this.loadTransactionHistory(this.currentPage);
        
        // Update header wallet display
        if (window.headerManager) {
            await window.headerManager.updateWalletBalance();
        }
    }

    // Helper methods
    getBankId(bankCode) {
        // Map bank codes to VietQR compatible bank IDs
        const bankMapping = {
            '970418': 'BIDV',
            '970415': 'VietinBank', 
            '970436': 'Vietcombank',
            '970422': 'MBBank',
            '970407': 'Techcombank',
            '970403': 'Sacombank',
            '970405': 'Agribank',
            '970432': 'VPBank',
            '970423': 'TPBank',
            '970431': 'Eximbank'
        };
        
        return bankMapping[bankCode] || bankCode;
    }

    formatCurrency(amount) {
        if (typeof amount !== 'number') {
            amount = parseFloat(amount) || 0;
        }
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            minimumFractionDigits: 0
        }).format(amount);
    }

    getTransactionTypeClass(type) {
        switch (type) {
            case 'CHARGE': return 'bg-success';
            case 'PAYMENT': return 'bg-primary';
            case 'REFUND': return 'bg-info';
            case 'WITHDRAWAL': return 'bg-warning';
            default: return 'bg-secondary';
        }
    }

    getStatusClass(status) {
        switch (status) {
            case 'COMPLETED': return 'bg-success';
            case 'PENDING': return 'bg-warning';
            case 'FAILED': return 'bg-danger';
            case 'CANCELLED': return 'bg-secondary';
            default: return 'bg-secondary';
        }
    }

    showError(message) {
        Swal.fire({
            title: 'Lỗi!',
            text: message,
            icon: 'error',
            confirmButtonText: 'OK',
            confirmButtonColor: '#dc3545'
        });
    }

    showSuccess(message) {
        Swal.fire({
            title: 'Thành công!',
            text: message,
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: '#28a745'
        });
    }
}

// Create global instance
window.walletPageManager = new WalletPageManager();

// Export global functions for onclick handlers
window.showRechargeModal = function() {
    window.walletPageManager.showRechargeModal();
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    await window.walletPageManager.init();
}); 