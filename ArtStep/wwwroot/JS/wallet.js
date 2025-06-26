console.log('[wallet.js] Loaded');
import { API_BASE_URL } from './config.js';

// Wallet functionality module
export class WalletManager {
    constructor() {
        this.walletBalance = 0;
        this.isLoading = false;
    }

    // Get wallet balance from API
    async fetchWalletBalance() {
        const token = localStorage.getItem('token');
        if (!token) {
            return null;
        }

        if (this.isLoading) {
            return this.walletBalance;
        }

        try {
            this.isLoading = true;
            const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired or invalid, clear localStorage
                    localStorage.removeItem('token');
                    localStorage.removeItem('role');
                    localStorage.removeItem('username');
                    localStorage.removeItem('userId');
                    window.location.reload();
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.walletBalance = data.balance || 0;
            return this.walletBalance;
        } catch (error) {
            console.error('Error fetching wallet balance:', error);
            return null;
        } finally {
            this.isLoading = false;
        }
    }

    // Format currency for display
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

    // Create wallet display HTML
    createWalletDisplay(balance) {
        return `
            <li class="nav-item">
                <a class="nav-link wallet-link" href="wallet.html" id="walletDisplay">
                    <i class="bi bi-wallet2"></i> 
                    <span class="wallet-balance">${this.formatCurrency(balance)}</span>
                </a>
            </li>
        `;
    }

    // Update wallet display in header
    async updateWalletDisplay() {
        const walletDisplayElement = document.getElementById('walletDisplay');
        
        if (walletDisplayElement) {
            const balance = await this.fetchWalletBalance();
            if (balance !== null) {
                const balanceSpan = walletDisplayElement.querySelector('.wallet-balance');
                if (balanceSpan) {
                    balanceSpan.textContent = this.formatCurrency(balance);
                }
            }
        }
    }

    goToWallet() {
        window.location.href = 'wallet';
    }

    init() {
        this.addWalletStyles();
        
        setInterval(() => {
            if (localStorage.getItem('token')) {
                this.updateWalletDisplay();
            }
        }, 30000);
    }

    // Add CSS styles for wallet display
    addWalletStyles() {
        const existingStyle = document.getElementById('wallet-styles');
        if (existingStyle) return;

        const style = document.createElement('style');
        style.id = 'wallet-styles';
        style.textContent = `
            .wallet-link {
                transition: all 0.3s ease;
            }
            
            .wallet-link:hover {
                background-color: rgba(0, 123, 255, 0.1);
                border-radius: 5px;
            }
            
            .wallet-balance {
                font-weight: 600;
                color: #28a745;
            }
            
            .wallet-link:hover .wallet-balance {
                color: #218838;
            }
            
            .bi-wallet2 {
                margin-right: 5px;
            }
            
            @media (max-width: 768px) {
                .wallet-balance {
                    font-size: 0.9em;
                }
            }
        `;
        document.head.appendChild(style);
    }
}
window.walletManager = new WalletManager();

window.goToWallet = function() {
    window.walletManager.goToWallet();
};

document.addEventListener('DOMContentLoaded', function() {
    window.walletManager.init();
}); 