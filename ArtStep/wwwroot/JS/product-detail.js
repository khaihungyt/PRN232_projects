import { API_BASE_URL } from './config.js';
import './header.js';

function formatPriceVND(price) {
    if (typeof price !== 'number') {
        price = parseFloat(price);
    }
    const actualPrice = price * 1000;


    return price.toLocaleString('vi-VN') + ' VNĐ';
}


document.addEventListener('DOMContentLoaded', async function () {
    // Get product ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        Swal.fire({
            title: 'Lỗi!',
            text: 'Không tìm thấy ID sản phẩm!',
            icon: 'error',
            confirmButtonText: 'Về trang chủ'
        }).then(() => {
            window.location.href = 'home.html';
        });
        return;
    }

    let currentProduct = null;
    let selectedSize = null;
    let selectedQuantity = 1;

    // Load product details
    await loadProductDetails(productId);
    await loadRelatedProducts();

    async function loadProductDetails(shoeId) {
        try {
            const response = await fetch(`${API_BASE_URL}/detailshoe/${shoeId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const product = await response.json();
            currentProduct = product;
            renderProductDetails(product);
        } catch (error) {
            console.error('Error loading product details:', error);
            Swal.fire({
                title: 'Lỗi!',
                text: 'Không thể tải thông tin sản phẩm!',
                icon: 'error',
                confirmButtonText: 'Về trang chủ'
            }).then(() => {
                window.location.href = 'home.html';
            });
        }
    }

    function renderProductDetails(product) {
        const designerId = product.Designer?.UserId;
        const designerName = product.Designer?.Name;
        const shoeId = product.ShoeId;
        const productName = product.ShoeName;
        const productPrice = product.PriceAShoe || 0;
        const productStyle = product.Category?.CategoryName || 'N/A';
        const productDescription = product.ShoeDescription || 'Không có mô tả cho sản phẩm này.';
        
        // Use images from API response
        const images = product.ShoeImages && product.ShoeImages.length > 0 
            ? product.ShoeImages.map(img => img.ImageLink)
            : ['placeholder.jpg'];

        const productDetailHTML = `
            <div class="col-md-6">
                <!-- Product Image Gallery -->
                <div class="mb-3">
                    <img src="${images[0]}" class="img-fluid product-image w-100" id="mainImage" alt="${productName}">
                </div>
                <div class="d-flex gap-2 flex-wrap">
                    ${images.map((img, index) => `
                        <img src="${img}" class="thumbnail-image ${index === 0 ? 'active' : ''}" 
                             alt="${productName} ${index + 1}" onclick="changeMainImage('${img}', ${index})">
                    `).join('')}
                </div>
            </div>
            
            <div class="col-md-6">
                <!-- Product Information -->
                <div class="ps-md-4">
                    <h1 class="h2 mb-3">${productName}</h1>
                    <p class="text-muted mb-2">Phong cách: ${productStyle}</p>
                    <p class="text-muted mb-2">Thiết kế bởi: ${designerName || 'N/A'}</p>
                <h5 class="card-subtitle mb-2 text-primary mt-auto">${formatPriceVND(productPrice)}</h5>
                    
                    <!-- Product Description -->
                    <div class="mb-4">
                        <h5>Mô tả sản phẩm</h5>
                        <p class="text-muted">${productDescription}</p>
                    </div>
                    
                    <!-- Size Selection -->
                    <!-- <div class="mb-4">
                        <h5 class="mb-3">Chọn kích thước</h5>
                        <div class="d-flex gap-2 flex-wrap" id="sizeOptions">
                            ${['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'].map(size => `
                                <div class="size-option" onclick="selectSize('${size}')" data-size="${size}">
                                    ${size}
                                </div>
                            `).join('')}
                        </div>
                    </div> -->
                    
                    <!-- Quantity Selection -->
                    <div class="mb-4">
                        <h5 class="mb-3">Số lượng</h5>
                        <div class="d-flex align-items-center gap-2">
                            <button class="quantity-btn" onclick="changeQuantity(-1)">
                                <i class="bi bi-dash"></i>
                            </button>
                            <input type="number" class="form-control quantity-input" id="quantityInput" 
                                   value="${selectedQuantity}" min="1" max="10" readonly>
                            <button class="quantity-btn" onclick="changeQuantity(1)">
                                <i class="bi bi-plus"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="d-flex gap-3 mb-4">
                        <button class="btn btn-primary flex-grow-1" onclick="addToCart()">
                            <i class="lnr lnr-cart me-2"></i>Thêm vào giỏ hàng
                        </button>
                        <button class="btn btn-outline-secondary" onclick="addToWishlist('${shoeId}')">
                            <i class="bi bi-heart"></i>
                        </button>
                    </div>
                    
                    <!-- Chat with Designer -->
                    ${designerId && localStorage.getItem('role') && localStorage.getItem('role').toLowerCase() === 'user' ?
                        `<button onclick="chatWithDesigner('${designerId}', '${designerName}')" 
                                class="btn btn-outline-success w-100 mb-3">
                            <i class="bi bi-chat-dots me-2"></i>Chat với nhà thiết kế
                        </button>` :
                        localStorage.getItem('role') && localStorage.getItem('role').toLowerCase() === 'designer' ?
                            `<button class="btn btn-outline-secondary w-100 mb-3" disabled>
                                <i class="bi bi-info-circle me-2"></i>Tài khoản nhà thiết kế
                            </button>` :
                            !localStorage.getItem('token') ?
                                `<button onclick="chatWithDesigner('${designerId}', '${designerName}')" 
                                        class="btn btn-outline-success w-100 mb-3">
                                    <i class="bi bi-chat-dots me-2"></i>Chat với nhà thiết kế
                                </button>` :
                                `<button class="btn btn-outline-secondary w-100 mb-3" disabled>
                                    <i class="bi bi-chat-dots me-2"></i>Nhà thiết kế không có sẵn
                                </button>`
                    }
                    
                    <!-- Product Features -->
                    <div class="border-top pt-4">
                        <h5 class="mb-3">Thông tin sản phẩm</h5>
                        <ul class="list-unstyled">
                            <li class="mb-2"><i class="bi bi-check-circle text-success me-2"></i>Chất liệu cao cấp</li>
                            <li class="mb-2"><i class="bi bi-check-circle text-success me-2"></i>Thiết kế tùy chỉnh</li>
                            <li class="mb-2"><i class="bi bi-check-circle text-success me-2"></i>Bảo hành 6 tháng</li>
                            <li class="mb-2"><i class="bi bi-truck text-primary me-2"></i>Miễn phí vận chuyển</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('productDetailContainer').innerHTML = productDetailHTML;
    }

    async function loadRelatedProducts() {
        try {
            const response = await fetch(`${API_BASE_URL}/products?limit=4`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const products = data.products || [];

            if (Array.isArray(products) && products.length > 0) {
                renderRelatedProducts(products.filter(p => (p.shoeId || p.ShoeId) !== productId).slice(0, 4));
            }
        } catch (error) {
            console.error('Error loading related products:', error);
        }
    }

    function renderRelatedProducts(products) {
        const relatedProductsHTML = products.map(product => {
            // Handle both the products API response and potential detailshoe API response format
            const designerId = product.designerUserId || product.DesignerUserId || product.Designer?.UserId;
            const designerName = product.designer || product.Designer || product.Designer?.Name;
            const shoeId = product.shoeId || product.ShoeId;
            const productName = product.name || product.Name || product.ShoeName;
            const productPrice = product.price || product.Price || product.PriceAShoe || 0;
            const productImage = product.imageUrl || product.ImageUrl || 
                               (product.ShoeImages && product.ShoeImages.length > 0 ? product.ShoeImages[0].ImageLink : 'placeholder.jpg');
            
            return `
                <div class="col-md-3 mb-4">
                    <div class="card h-100 shadow-sm">
                        <img src="${productImage}" 
                             class="card-img-top" alt="${productName}" 
                             style="height: 200px; object-fit: cover;">
                        <div class="card-body d-flex flex-column">
                            <h6 class="card-title">${productName}</h6>
                            <p class="card-text text-muted small">
                                ${designerName || 'N/A'}
                            </p>
                        <h5 class="card-subtitle mb-2 text-primary mt-auto">${formatPriceVND(productPrice)}</h5>
                            <button onclick="viewProductDetails('${shoeId}')" class="btn btn-outline-dark btn-sm">
                                Xem chi tiết
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('relatedProducts').innerHTML = relatedProductsHTML;
    }

    // Global functions for interaction
    window.changeMainImage = function(imageSrc, index) {
        document.getElementById('mainImage').src = imageSrc;
        
        // Update active thumbnail
        document.querySelectorAll('.thumbnail-image').forEach((img, i) => {
            img.classList.toggle('active', i === index);
        });
    };

    // Size selection function commented out
    // window.selectSize = function(size) {
    //     selectedSize = size;
    //     
    //     // Update UI
    //     document.querySelectorAll('.size-option').forEach(option => {
    //         option.classList.toggle('selected', option.dataset.size === size);
    //     });
    // };

    window.changeQuantity = function(delta) {
        const newQuantity = selectedQuantity + delta;
        if (newQuantity >= 1 && newQuantity <= 10) {
            selectedQuantity = newQuantity;
            document.getElementById('quantityInput').value = selectedQuantity;
        }
    };

    window.addToCart = async function() {
        // Size selection commented out
        // if (!selectedSize) {
        //     Swal.fire({
        //         title: 'Vui lòng chọn kích thước!',
        //         text: 'Bạn cần chọn kích thước trước khi thêm vào giỏ hàng.',
        //         icon: 'warning',
        //         confirmButtonText: 'OK'
        //     });
        //     return;
        // }

        const token = localStorage.getItem('token');

        if (!token) {
            const result = await Swal.fire({
                title: 'Cần đăng nhập',
                text: 'Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Đăng nhập',
                cancelButtonText: 'Hủy',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33'
            });

            if (result.isConfirmed) {
                window.location.href = 'Login.html';
            }
            return;
        }

        try {
            const requestBody = {
                shoeId: currentProduct.ShoeId,
                quantity: selectedQuantity
                // size: selectedSize // Size commented out
            };

            const response = await fetch(`${API_BASE_URL}/Cart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token.trim()}`
                },
                body: JSON.stringify(requestBody)
            });

            let responseData;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                const responseText = await response.text();
                try {
                    responseData = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('JSON parse error:', parseError);
                    throw new Error('Invalid JSON response from server');
                }
            } else {
                const responseText = await response.text();
                console.error('Non-JSON response:', responseText);
                throw new Error('Server returned non-JSON response');
            }

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    const result = await Swal.fire({
                        title: 'Phiên làm việc hết hạn',
                        text: 'Phiên làm việc của bạn đã hết hạn. Vui lòng đăng nhập lại!',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Đăng nhập',
                        cancelButtonText: 'Hủy',
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33'
                    });

                    if (result.isConfirmed) {
                        window.location.href = 'Login.html';
                    }
                    return;
                }
                throw new Error(responseData.message || 'Failed to add to cart');
            }

            const result = await Swal.fire({
                title: 'Thành công!',
                text: responseData.message || 'Đã thêm sản phẩm vào giỏ hàng!',
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Xem giỏ hàng',
                cancelButtonText: 'Tiếp tục mua sắm',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#28a745'
            });

            if (result.isConfirmed) {
                window.location.href = 'cart.html';
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            await Swal.fire({
                title: 'Lỗi!',
                text: error.message || 'Lỗi khi thêm sản phẩm vào giỏ hàng!',
                icon: 'error',
                timer: 3000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
        }
    };

    window.addToWishlist = function(shoeId) {
        Swal.fire({
            title: 'Tính năng sắp ra mắt!',
            text: 'Tính năng danh sách yêu thích sẽ có sớm.',
            icon: 'info',
            confirmButtonText: 'OK'
        });
    };

    window.viewProductDetails = function(shoeId) {
        window.location.href = `product-detail.html?id=${shoeId}`;
    };

    window.chatWithDesigner = function(designerUserId, designerName) {
    console.log('chatWithDesigner called with:', designerUserId, designerName);

    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('role');

    if (!token) {
        console.log('No token found, showing login prompt');
        Swal.fire({
            title: 'Cần đăng nhập',
            text: 'Vui lòng đăng nhập để chat với nhà thiết kế!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Đăng nhập',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = 'Login.html';
            }
        });
        return;
    }

    if (!userRole || userRole.toLowerCase() !== 'user') {
        console.log('User role check failed:', userRole);
        Swal.fire({
            title: 'Quyền truy cập bị từ chối',
            text: 'Chỉ khách hàng mới có thể chat với nhà thiết kế!',
            icon: 'warning',
            confirmButtonText: 'OK',
            confirmButtonColor: '#3085d6'
        });
        return;
    }

    // Redirect to designers page with chat parameters
    window.location.href = `designers.html?chatWith=${designerUserId}&designerName=${encodeURIComponent(designerName)}`;
};
}); 