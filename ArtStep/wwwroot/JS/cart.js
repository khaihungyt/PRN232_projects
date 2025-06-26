import { API_BASE_URL } from './config.js';
import { HeaderManager } from './header.js';

// Helper to get query params
function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

document.addEventListener('DOMContentLoaded', async function () {
    // Initialize header
    const headerManager = new HeaderManager();
    await headerManager.initializeHeader();
    
    // Store headerManager globally for access from other functions
    window.headerManager = headerManager;

    // Handle VNPay callback result
    const paymentInfo = getQueryParam('payment_info');
    if (paymentInfo) {
        if (paymentInfo === 'order_success') {
            // Get extra info if available
            const orderId = getQueryParam('orderId');
            const totalAmount = getQueryParam('totalAmount');
            const itemCount = getQueryParam('itemCount');
            await Swal.fire({
                title: 'Order Placed Successfully!',
                html: `
                    <div class="text-center">
                        <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>
                        <p class="mt-3 mb-2"><strong>Order ID:</strong> ${orderId || ''}</p>
                        <p class="mb-2"><strong>Total Amount:</strong> ${totalAmount ? formatVND(Number(totalAmount)) : ''}</p>
                        <p class="mb-2"><strong>Items:</strong> ${itemCount || ''} items</p>
                        <p class="mb-0"><strong>Status:</strong> Paid</p>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: '<i class="bi bi-house"></i> Go to Home',
                confirmButtonColor: '#28a745',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
            window.location.href = 'home';
            return;
        } else if (paymentInfo === 'payment_fail') {
            await Swal.fire({
                title: 'Payment Failed',
                text: 'Your payment was not successful. Please try again or choose another payment method.',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#dc3545'
            });
            // Optionally, you can redirect or let the user stay on the cart page
        } else if (paymentInfo === 'cart_empty') {
            await Swal.fire({
                title: 'Cart Empty',
                text: 'Your cart is empty. Please add items to your cart before checking out.',
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ffc107'
            });
        } else if (paymentInfo === 'invalid_user') {
            await Swal.fire({
                title: 'Invalid User',
                text: 'User information is invalid. Please log in again.',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#dc3545'
            });
            window.location.href = 'Login.html';
            return;
        } else if (paymentInfo === 'error') {
            await Swal.fire({
                title: 'Error',
                text: 'An error occurred during payment processing.',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#dc3545'
            });
        }
    }

    const token = localStorage.getItem('token');

    // Check if user is logged in
    if (!token) {
        showLoginRequired();
        return;
    }

    // Load cart data
    loadCartData();
    
    // Load wallet balance for payment option
    loadWalletBalance();

    // Global functions
    window.goToCart = function() {
        window.location.href = 'cart.html';
    }

    window.updateQuantity = async function(cartDetailId, newQuantity) {
        if (newQuantity < 1) {
            removeFromCart(cartDetailId);
            return;
        }

        try {
            // Update UI immediately for smooth experience
            updateItemQuantityUI(cartDetailId, newQuantity);

            const response = await fetch(`${API_BASE_URL}/Cart/${cartDetailId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token.trim()}`
                },
                body: JSON.stringify({
                    shoeId: '', // Not needed for update
                    quantity: newQuantity
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update quantity');
                // Revert UI changes on error
                loadCartData();
                return;
            }

            showToast('Success', 'Quantity updated successfully', 'success');
        } catch (error) {
            console.error('Error updating quantity:', error);
            showToast('Error', 'Failed to update quantity', 'error');
            // Reload cart data to revert changes
            loadCartData();
        }
    }

    window.checkout = async function() {
        try {
            const checkoutBtn = document.getElementById('checkout-btn');
            const originalText = checkoutBtn.innerHTML;
            checkoutBtn.disabled = true;
            checkoutBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang xử lý...';

            // Check wallet balance first
            const cartTotalElement = document.getElementById('cart-total');
            const cartTotalText = cartTotalElement.textContent.replace(/[^0-9]/g, '');
            const cartTotal = parseFloat(cartTotalText) || 0;

            if (window.walletBalance < cartTotal) {
                throw new Error(`Số dư ví không đủ. Cần: ${formatVND(cartTotal)}, Có: ${formatVND(window.walletBalance)}`);
            }

            // Create order first
            const response = await fetch(`${API_BASE_URL}/Order/checkout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token.trim()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create order');
            }

            const result = await response.json();

            // Pay with wallet
            const paymentResponse = await fetch(`${API_BASE_URL}/wallet/pay-order`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token.trim()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orderId: result.orderId
                })
            });

            if (!paymentResponse.ok) {
                const errorData = await paymentResponse.json();
                throw new Error(errorData.message || 'Wallet payment failed');
            }

            const paymentResult = await paymentResponse.json();

            // Show success message with feedback option
            const result2 = await Swal.fire({
                title: 'Thanh Toán Thành Công!',
                html: `
                    <div class="text-center">
                        <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>
                        <p class="mt-3 mb-2"><strong>Mã Đơn Hàng:</strong> ${result.orderId}</p>
                        <p class="mb-2"><strong>Số Tiền Thanh Toán:</strong> ${formatVND(paymentResult.amountPaid)}</p>
                        <p class="mb-2"><strong>Số Dư Còn Lại:</strong> ${formatVND(paymentResult.remainingBalance)}</p>
                        <p class="mb-0"><strong>Trạng Thái:</strong> Đã Thanh Toán</p>
                    </div>
                `,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: '<i class="bi bi-star-fill"></i> Đánh Giá Nhà Thiết Kế',
                cancelButtonText: '<i class="bi bi-house"></i> Về Trang Chủ',
                confirmButtonColor: '#ffc107',
                cancelButtonColor: '#28a745',
                allowOutsideClick: false,
                allowEscapeKey: false
            });

            if (result2.isConfirmed) {
                // Show feedback modal
                await showFeedbackModal(result.orderId);
                // Don't redirect to home immediately, let user finish feedback
                return;
            }

            // Update wallet balance display in header and cart
            if (window.headerManager) {
                await window.headerManager.updateWalletBalance();
            }
            loadWalletBalance();
            
            window.location.href = 'home.html';

        } catch (error) {
            console.error('Error during checkout:', error);
            
            // Reset button state
            const checkoutBtn = document.getElementById('checkout-btn');
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = '<i class="bi bi-credit-card"></i> Tiến Hành Thanh Toán';

            // Show error message
            await Swal.fire({
                title: 'Thanh Toán Thất Bại',
                text: error.message || 'Đã xảy ra lỗi trong quá trình thanh toán. Vui lòng thử lại.',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#dc3545'
            });
        }
    }

    function updateItemQuantityUI(cartDetailId, newQuantity) {
        // Find the item in the current cart data
        const cartItemElement = document.querySelector(`[data-cart-detail-id="${cartDetailId}"]`);
        
        if (!cartItemElement) {
            console.error('Cart item element not found for ID:', cartDetailId);
            return;
        }

        // Update quantity display
        const quantitySpan = cartItemElement.querySelector('.quantity-display');
        
        if (quantitySpan) {
            quantitySpan.textContent = newQuantity;
        }

        // Update button onclick handlers with new quantity values
        const decreaseBtn = cartItemElement.querySelector('.btn-decrease');
        const increaseBtn = cartItemElement.querySelector('.btn-increase');
        
        if (decreaseBtn) {
            decreaseBtn.setAttribute('onclick', `updateQuantity('${cartDetailId}', ${newQuantity - 1})`);
        }
        
        if (increaseBtn) {
            increaseBtn.setAttribute('onclick', `updateQuantity('${cartDetailId}', ${newQuantity + 1})`);
        }

        // Update total price for this item
        const priceElement = cartItemElement.querySelector('.item-total-price');
        const unitPriceElement = cartItemElement.querySelector('.unit-price');
        
        if (priceElement && unitPriceElement) {
            const unitPrice = parseFloat(unitPriceElement.getAttribute('data-price'));
            
            if (!isNaN(unitPrice)) {
                const newTotal = unitPrice * newQuantity;
                priceElement.setAttribute('data-total', newTotal);
                priceElement.textContent = formatVND(newTotal);
            }
        }

        // Update cart summary
        updateCartSummaryFromDOM();
    }

    function updateCartSummaryFromDOM() {
        let subtotal = 0;
        
        // Calculate subtotal from all visible items using data attributes
        const priceElements = document.querySelectorAll('.item-total-price');
        
        priceElements.forEach((priceElement) => {
            const totalPrice = parseFloat(priceElement.getAttribute('data-total'));
            
            if (!isNaN(totalPrice)) {
                subtotal += totalPrice;
            }
        });

        // Remove tax calculation - just use subtotal as total
        const total = subtotal;

        document.getElementById('subtotal').textContent = formatVND(subtotal);
        document.getElementById('cart-total').textContent = formatVND(total);

        // Update cart count
        const itemCount = document.querySelectorAll('[data-cart-detail-id]').length;
        document.getElementById('cart-count').textContent = `${itemCount} items`;

        // Enable/disable checkout button
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.disabled = itemCount === 0;
        }

        // Show/hide clear cart button
        const clearCartBtn = document.getElementById('clear-cart-btn');
        if (clearCartBtn) {
            clearCartBtn.style.display = itemCount > 0 ? 'block' : 'none';
        }
    }

    window.removeFromCart = async function(cartDetailId) {
        const result = await Swal.fire({
            title: 'Remove Item',
            text: 'Are you sure you want to remove this item from your cart?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, remove it',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d'
        });

        if (!result.isConfirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/Cart/${cartDetailId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token.trim()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to remove item');
            }

            // Remove item from UI smoothly
            const itemElement = document.querySelector(`[data-cart-detail-id="${cartDetailId}"]`);
            if (itemElement) {
                itemElement.style.transition = 'opacity 0.3s ease-out';
                itemElement.style.opacity = '0';
                setTimeout(() => {
                    itemElement.remove();
                    updateCartSummaryFromDOM();
                    
                    // Check if cart is empty
                    const remainingItems = document.querySelectorAll('[data-cart-detail-id]');
                    if (remainingItems.length === 0) {
                        showEmptyCart();
                    }
                }, 300);
            }

            showToast('Success', 'Item removed from cart', 'success');
        } catch (error) {
            console.error('Error removing item:', error);
            showToast('Error', 'Failed to remove item', 'error');
        }
    }

    window.clearCart = async function() {
        const result = await Swal.fire({
            title: 'Clear Cart',
            text: 'Are you sure you want to remove all items from your cart?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, clear cart',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d'
        });

        if (!result.isConfirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/Cart`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token.trim()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to clear cart');
            }

            // Reload cart data
            loadCartData();

            showToast('Success', 'Cart cleared successfully', 'success');
        } catch (error) {
            console.error('Error clearing cart:', error);
            showToast('Error', 'Failed to clear cart', 'error');
        }
    }

    async function loadCartData() {
        try {
            showLoading();

            const response = await fetch(`${API_BASE_URL}/Cart`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token.trim()}`
                }
            });

            if (response.status === 404) {
                // No cart found - show empty cart
                showEmptyCart();
                return;
            }

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired
                    localStorage.removeItem('token');
                    showLoginRequired();
                    return;
                }
                throw new Error('Failed to load cart');
            }

            const cartData = await response.json();
            
            // Handle the response format
            const cart = cartData.cart || cartData;
            
            const cartDetails = cart.cartDetails?.$values || cart.cartDetails || [];

            if (!cartDetails || cartDetails.length === 0) {
                showEmptyCart();
                return;
            }

            renderCartItems(cartDetails);
            updateCartSummaryFromDOM();

        } catch (error) {
            console.error('Error loading cart:', error);
            showError('Failed to load cart data');
        }
    }

    function renderCartItems(cartDetails) {
        const cartItemsContainer = document.getElementById('cart-items');
        const loadingState = document.getElementById('loading-state');
        const emptyCart = document.getElementById('empty-cart');
        const loginRequired = document.getElementById('login-required');

        // Hide all states
        loadingState.style.display = 'none';
        emptyCart.style.display = 'none';
        loginRequired.style.display = 'none';

        cartItemsContainer.innerHTML = '';

        cartDetails.forEach(item => {
            const shoe = item.shoeCustom || item.ShoeCustom;
            const cartDetailId = item.cartDetailID || item.CartDetailID || item.id || item.Id;
            
            // Parse image URL from the actual structure
            let imageUrl = 'placeholder.jpg';
            if (shoe?.images?.$values && shoe.images.$values.length > 0) {
                imageUrl = shoe.images.$values[0].imageLink;
            } else if (shoe?.images && Array.isArray(shoe.images) && shoe.images.length > 0) {
                imageUrl = shoe.images[0].imageLink || shoe.images[0].imageUrl;
            } else if (shoe?.Images?.$values && shoe.Images.$values.length > 0) {
                imageUrl = shoe.Images.$values[0].ImageLink;
            }
            
            const name = shoe?.shoeName || shoe?.ShoeName || shoe?.name || shoe?.Name || 'Product Name';
            const description = shoe?.shoeDescription || shoe?.ShoeDescription || shoe?.description || shoe?.Description || '';
            const price = shoe?.priceAShoe || shoe?.PriceAShoe || shoe?.price || shoe?.Price || 0;
            const quantity = item.quantityBuy || item.QuantityBuy || 1;
            const totalPrice = (price * quantity);
            

            const cartItemHtml = `
                <div class="col-12 mb-3" data-cart-detail-id="${cartDetailId}">
                    <div class="card shadow-sm border-0" style="background: white;">
                        <div class="card-body">
                            <div class="row align-items-center">
                                <div class="col-md-2">
                                    <img src="${imageUrl}" 
                                         class="img-fluid rounded" 
                                         alt="${name}"
                                         style="height: 80px; object-fit: cover;">
                                </div>
                                <div class="col-md-4">
                                    <h6 class="mb-1 text-dark">${name}</h6>
                                    <p class="text-muted mb-1 small">${description}</p>
                                    <p class="text-success mb-0 fw-bold unit-price" data-price="${price}">${formatVND(price)}</p>
                                </div>
                                <div class="col-md-3">
                                    <div class="d-flex align-items-center">
                                        <button class="btn btn-sm btn-decrease" 
                                                style="background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%); color: white; border: none;"
                                                onclick="updateQuantity('${cartDetailId}', ${quantity - 1})">
                                            <i class="bi bi-dash"></i>
                                        </button>
                                        <span class="mx-3 fw-bold text-dark quantity-display">${quantity}</span>
                                        <button class="btn btn-sm btn-increase" 
                                                style="background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%); color: white; border: none;"
                                                onclick="updateQuantity('${cartDetailId}', ${quantity + 1})">
                                            <i class="bi bi-plus"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="col-md-2">
                                    <p class="mb-0 fw-bold text-success item-total-price" data-total="${totalPrice}">
                                        ${formatVND(totalPrice)}
                                    </p>
                                </div>
                                <div class="col-md-1">
                                    <button class="btn btn-outline-danger btn-sm" 
                                            onclick="removeFromCart('${cartDetailId}')">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            cartItemsContainer.innerHTML += cartItemHtml;
        });

        document.getElementById('cart-count').textContent = `${cartDetails.length} items`;
        
        const clearCartBtn = document.getElementById('clear-cart-btn');
        if (clearCartBtn) {
            clearCartBtn.style.display = cartDetails.length > 0 ? 'block' : 'none';
        }
    }

    function showLoading() {
        document.getElementById('loading-state').style.display = 'block';
        document.getElementById('empty-cart').style.display = 'none';
        document.getElementById('login-required').style.display = 'none';
        document.getElementById('cart-items').innerHTML = '';
    }

    function showEmptyCart() {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('empty-cart').style.display = 'block';
        document.getElementById('login-required').style.display = 'none';
        document.getElementById('cart-items').innerHTML = '';
        document.getElementById('cart-count').textContent = '0 items';
        
        document.getElementById('subtotal').textContent = formatVND(0);
        document.getElementById('cart-total').textContent = formatVND(0);
        
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.disabled = true;
        }
        
        const clearCartBtn = document.getElementById('clear-cart-btn');
        if (clearCartBtn) {
            clearCartBtn.style.display = 'none';
        }
    }

    function showLoginRequired() {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('empty-cart').style.display = 'none';
        document.getElementById('login-required').style.display = 'block';
        document.getElementById('cart-items').innerHTML = '';
        document.getElementById('cart-count').textContent = '0 items';
        
        document.getElementById('subtotal').textContent = formatVND(0);
        document.getElementById('cart-total').textContent = formatVND(0);
        
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.disabled = true;
        }
    }

    function showError(message) {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('cart-items').innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger text-center">
                    <i class="bi bi-exclamation-triangle"></i>
                    <p class="mb-0">${message}</p>
                </div>
            </div>
        `;
    }

    function showToast(title, message, type) {
        const toastElement = document.getElementById('toast');
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');

        toastTitle.textContent = title;
        toastMessage.textContent = message;
        toastElement.className = 'toast';
        if (type === 'success') {
            toastElement.classList.add('bg-success', 'text-white');
        } else if (type === 'error') {
            toastElement.classList.add('bg-danger', 'text-white');
        } else if (type === 'info') {
            toastElement.classList.add('bg-info', 'text-white');
        }

        const toast = new bootstrap.Toast(toastElement);
        toast.show();
    }

    function formatVND(value) {
        return value.toLocaleString('vi-VN') + ' VND';
    }

    // Load wallet balance for payment option
    async function loadWalletBalance() {
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token.trim()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const balanceDisplay = document.getElementById('wallet-balance-display');
                
                if (balanceDisplay) {
                    balanceDisplay.textContent = formatVND(data.balance);
                    balanceDisplay.className = 'text-success fw-bold';
                }

                // Store wallet balance for later use
                window.walletBalance = data.balance;

                // Enable/disable checkout button based on balance and cart total
                updateWalletPaymentOption(data.balance);
            } else {
                // Wallet not found or error
                const balanceDisplay = document.getElementById('wallet-balance-display');
                
                if (balanceDisplay) {
                    balanceDisplay.textContent = formatVND(0);
                    balanceDisplay.className = 'text-warning fw-bold';
                }
                window.walletBalance = 0;
                updateWalletPaymentOption(0);
            }
        } catch (error) {
            console.error('Error loading wallet balance:', error);
            const balanceDisplay = document.getElementById('wallet-balance-display');
            if (balanceDisplay) {
                balanceDisplay.textContent = 'Lỗi tải số dư';
                balanceDisplay.className = 'text-danger fw-bold';
            }
            window.walletBalance = 0;
            updateWalletPaymentOption(0);
        }
    }

    // Update wallet payment option based on balance and cart total
    function updateWalletPaymentOption(walletBalance) {
        const cartTotalElement = document.getElementById('cart-total');
        const checkoutBtn = document.getElementById('checkout-btn');
        const walletStatus = document.getElementById('wallet-status');
        
        if (!cartTotalElement || !checkoutBtn) return;

        // Extract numeric value from cart total (remove 'VND' and commas)
        const cartTotalText = cartTotalElement.textContent.replace(/[^0-9]/g, '');
        const cartTotal = parseFloat(cartTotalText) || 0;

        if (walletBalance >= cartTotal && cartTotal > 0) {
            checkoutBtn.disabled = false;
            if (walletStatus) {
                walletStatus.className = 'alert alert-success';
                walletStatus.innerHTML = '<small><i class="bi bi-check-circle"></i> Số dư đủ để thanh toán</small>';
            }
        } else if (cartTotal > 0) {
            checkoutBtn.disabled = true;
            if (walletStatus) {
                walletStatus.className = 'alert alert-warning';
                walletStatus.innerHTML = `<small><i class="bi bi-exclamation-triangle"></i> Số dư không đủ. Cần thêm: ${formatVND(cartTotal - walletBalance)}</small>`;
            }
        } else {
            checkoutBtn.disabled = true;
            if (walletStatus) {
                walletStatus.className = 'alert alert-info';
                walletStatus.innerHTML = '<small><i class="bi bi-info-circle"></i> Thanh toán sẽ được thực hiện qua ví điện tử</small>';
            }
        }
    }

    // Add event listener to update wallet option when cart changes
    const originalUpdateCartSummaryFromDOM = updateCartSummaryFromDOM;
    updateCartSummaryFromDOM = function() {
        originalUpdateCartSummaryFromDOM();
        // After updating cart summary, check wallet balance again
        setTimeout(() => {
            if (window.walletBalance !== undefined) {
                updateWalletPaymentOption(window.walletBalance);
            }
        }, 100);
    };

    // Add wallet link functionality
    window.goToWallet = function() {
        window.location.href = 'wallet.html';
    };

    // Feedback functionality
    window.showFeedbackModal = async function(orderId) {
        try {
            const modal = new bootstrap.Modal(document.getElementById('feedbackModal'));
            const loadingDiv = document.getElementById('feedback-loading');
            const contentDiv = document.getElementById('feedback-content');
            
            // Store orderId for later use in feedback submission
            window.currentOrderId = orderId;
            
            // Show loading
            loadingDiv.style.display = 'block';
            contentDiv.style.display = 'none';
            modal.show();

            // Load designers from order
            const response = await fetch(`${API_BASE_URL}/Feedback/order/${orderId}/designers`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token.trim()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load designers');
            }

            const data = await response.json();
            const designers = data.designers || [];

            // Populate designer select
            const designerSelect = document.getElementById('designerSelect');
            designerSelect.innerHTML = '<option value="">-- Chọn nhà thiết kế để đánh giá --</option>';
            
            designers.forEach(designer => {
                const option = document.createElement('option');
                option.value = designer.designerId;
                option.textContent = `${designer.designerName} (${designer.shoeName})`;
                designerSelect.appendChild(option);
            });

            // Auto-select if only one designer
            if (designers.length === 1) {
                designerSelect.value = designers[0].designerId;
                designerSelect.disabled = true;
                
                // Update the label to show it's auto-selected
                const designerLabel = document.querySelector('label[for="designerSelect"]');
                if (designerLabel) {
                    designerLabel.innerHTML = `Nhà Thiết Kế <small class="text-success">(đã chọn tự động)</small>`;
                }
                
                // Change select appearance to show it's selected
                designerSelect.style.backgroundColor = '#e8f5e8';
                designerSelect.style.border = '2px solid #28a745';
            } else {
                // Reset in case of multiple designers
                designerSelect.disabled = false;
                designerSelect.style.backgroundColor = '';
                designerSelect.style.border = '';
                
                const designerLabel = document.querySelector('label[for="designerSelect"]');
                if (designerLabel) {
                    designerLabel.innerHTML = 'Chọn Nhà Thiết Kế';
                }
            }

            // Hide loading, show content
            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';

            // Setup star rating
            setupStarRating();

            // Setup form submission
            setupFeedbackSubmission();

            // Remove automatic redirect on modal close
            // Users should only redirect when they explicitly choose to

        } catch (error) {
            console.error('Error showing feedback modal:', error);
            
            // Hide loading and show error in modal
            loadingDiv.style.display = 'none';
            contentDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    <strong>Lỗi:</strong> Không thể tải danh sách nhà thiết kế. ${error.message}
                </div>
                <div class="text-center">
                    <button class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
                </div>
            `;
            contentDiv.style.display = 'block';
            
            showToast('Error', 'Không thể tải form đánh giá', 'error');
        }
    };

    function setupStarRating() {
        const stars = document.querySelectorAll('.star');
        const selectedRating = document.getElementById('selectedRating');

        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                const rating = index + 1;
                selectedRating.value = rating;

                // Update star display
                stars.forEach((s, i) => {
                    if (i < rating) {
                        s.classList.remove('bi-star');
                        s.classList.add('bi-star-fill', 'active');
                    } else {
                        s.classList.remove('bi-star-fill', 'active');
                        s.classList.add('bi-star');
                    }
                });
            });

            star.addEventListener('mouseenter', () => {
                const rating = index + 1;
                stars.forEach((s, i) => {
                    if (i < rating) {
                        s.classList.remove('bi-star');
                        s.classList.add('bi-star-fill');
                    } else {
                        s.classList.remove('bi-star-fill');
                        s.classList.add('bi-star');
                    }
                });
            });
        });

        // Reset stars on mouse leave
        document.getElementById('starRating').addEventListener('mouseleave', () => {
            const currentRating = parseInt(selectedRating.value) || 0;
            stars.forEach((s, i) => {
                if (i < currentRating) {
                    s.classList.remove('bi-star');
                    s.classList.add('bi-star-fill', 'active');
                } else {
                    s.classList.remove('bi-star-fill', 'active');
                    s.classList.add('bi-star');
                }
            });
        });
    }

    function setupFeedbackSubmission() {
        const submitBtn = document.getElementById('submitFeedbackBtn');
        const form = document.getElementById('feedbackForm');

        submitBtn.addEventListener('click', async () => {
            const designerSelect = document.getElementById('designerSelect');
            const selectedRating = document.getElementById('selectedRating');
            const feedbackDescription = document.getElementById('feedbackDescription');

            // Validate form
            if (!designerSelect.value) {
                showToast('Error', 'Vui lòng chọn nhà thiết kế', 'error');
                return;
            }

            if (!selectedRating.value) {
                showToast('Error', 'Vui lòng chọn số sao đánh giá', 'error');
                return;
            }

            if (!feedbackDescription.value.trim()) {
                showToast('Error', 'Vui lòng nhập nhận xét', 'error');
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang gửi...';

                const response = await fetch(`${API_BASE_URL}/Feedback`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token.trim()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        designerReceiveFeedbackId: designerSelect.value,
                        feedbackStars: parseInt(selectedRating.value),
                        feedbackDescription: feedbackDescription.value.trim(),
                        orderId: window.currentOrderId
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to submit feedback');
                }

                // Success - show options without closing modal first
                const feedbackResult = await Swal.fire({
                    title: 'Cảm ơn!',
                    text: 'Đánh giá của bạn đã được gửi thành công!',
                    icon: 'success',
                    showCancelButton: true,
                    confirmButtonText: '<i class="bi bi-house"></i> Về Trang Chủ',
                    cancelButtonText: '<i class="bi bi-star"></i> Đánh Giá Thêm',
                    confirmButtonColor: '#28a745',
                    cancelButtonColor: '#ffc107'
                });

                if (feedbackResult.isConfirmed) {
                    // User wants to go home - close modal and redirect
                    const modal = bootstrap.Modal.getInstance(document.getElementById('feedbackModal'));
                    modal.hide();
                    setTimeout(() => {
                        window.location.href = 'home.html';
                    }, 300);
                } else if (feedbackResult.isDismissed) {
                    // User wants to give more feedback - keep modal open and reset form
                    // Modal stays open for more feedback
                }

                // Reset form
                form.reset();
                selectedRating.value = '';
                document.querySelectorAll('.star').forEach(star => {
                    star.classList.remove('bi-star-fill', 'active');
                    star.classList.add('bi-star');
                });

            } catch (error) {
                console.error('Error submitting feedback:', error);
                showToast('Error', error.message || 'Không thể gửi đánh giá', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-send"></i> Gửi Đánh Giá';
            }
        });
    }
}); 