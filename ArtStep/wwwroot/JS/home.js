import { API_BASE_URL } from './config.js';
import './header.js';

function formatPriceVND(price) {
    if (typeof price !== 'number') {
        price = parseFloat(price);
    }

    return price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
}

document.addEventListener('DOMContentLoaded', async function () {
    await new Promise(resolve => setTimeout(resolve, 100));
    const designerFilter = document.getElementById('designerFilter');

    async function fetchDesigners() {
        try {
            const response = await fetch(`${API_BASE_URL}/designers`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            const designers = data || [];
            console.log('Designers data:', designers);

            if (!Array.isArray(designers)) {
                console.error('Designers data is not an array:', data);
                return;
            }
            if (designerFilter) {
                designerFilter.innerHTML = '<option value="">All Designers</option>';
                designers.forEach(designer => {
                    const option = document.createElement('option');
                    option.value = designer.UserId;
                    option.textContent = designer.Name;
                    designerFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);
        }
    }
    fetchDesigners();

    const styleFilter = document.getElementById('styleFilter');

    async function fetchCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/categories`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            const categories = Array.isArray(data) ? data : [];

            styleFilter.innerHTML = '<option value="">All Categories</option>';

            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.CategoryId;
                option.textContent = category.CategoryName;
                styleFilter.appendChild(option);
            });


        } catch (error) {
            console.error('Fetch categories error:', error);
        }
    }
    fetchCategories();

    // Define best sellers functions first
    async function loadBestSellers() {
        try {
            console.log('Loading best sellers from:', `${API_BASE_URL}/bestsellers`);
            const response = await fetch(`${API_BASE_URL}/bestsellers`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const bestSellers = await response.json();
            console.log('Best sellers data:', bestSellers);
            renderBestSellers(bestSellers);
        } catch (error) {
            console.error('Error loading best sellers:', error);
            // Hide the best sellers section if there's an error
            const bestSellersContainer = document.querySelector('.container.my-5');
            if (bestSellersContainer) {
                bestSellersContainer.style.display = 'none';
            }
        }
    }

    function renderBestSellers(products) {
        const bestSellersContainer = document.getElementById('bestSellersList');
        if (!bestSellersContainer) {
            console.error('Best sellers container not found');
            return;
        }

        if (!Array.isArray(products) || products.length === 0) {
            console.log('No best sellers data or empty array');
            bestSellersContainer.innerHTML = '<div class="col-12 text-center"><p class="text-muted">Không có dữ liệu sản phẩm bán chạy</p></div>';
            return;
        }

        console.log('Rendering best sellers:', products);

        const bestSellersHTML = products.slice(0, 4).map((product, index) => {
            const designerId = product.DesignerUserId;
            const designerName = product.Designer;
            const shoeId = product.ShoeId;
            const productName = product.Name;
            const productPrice = product.Price || 0;
            const productStyle = product.Style || 'N/A';
            const productImage = product.ImageUrl || 'placeholder.jpg';
            const totalSold = product.TotalSold || 0;

            return `
                <div class="col-lg-3 col-md-3 col-sm-4 col-6 mb-4">
                    <div class="card bestseller-card h-100">
                        <div class="bestseller-badge">
                            #${index + 1} HOT
                        </div>
                        <img src="${productImage}" 
                             class="card-img-top bestseller-image" 
                             alt="${productName}">
                        <div class="card-body d-flex flex-column text-center">
                            <h6 class="card-title bestseller-title fw-bold mb-2">${productName}</h6>
                            <p class="text-muted small mb-2">${designerName || 'N/A'}</p>
                            <p class="text-muted small mb-2">${productStyle}</p>
                            <div class="sold-count mb-2">
                                <i class="bi bi-fire"></i> ${totalSold} đã bán
                            </div>
                                <h5 class="bestseller-price mb-3">${formatPriceVND(product.price || product.Price || 0)}</h5>
                            <button onclick="orderNow('${shoeId}')" 
                                    class="btn order-now-btn mt-auto">
                                Đặt ngay
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        bestSellersContainer.innerHTML = bestSellersHTML;
    }

    // Load best sellers after functions are defined
    await loadBestSellers();

    const productList = document.getElementById('productList');
    const paginationElement = document.getElementById('pagination');

    let currentPage = 1;
    const productsPerPage = 6;

    let currentFilters = {
        style: '',
        designer: '',
        search: ''
    };

    async function fetchProducts() {
        const queryParams = new URLSearchParams({
            page: currentPage,
            limit: productsPerPage,
            style: currentFilters.style,
            price: currentFilters.price,
            designer: currentFilters.designer,
            search: currentFilters.search
        }).toString();

        try {
            const response = await fetch(`${API_BASE_URL}/products?${queryParams}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const products = data.products || [];
            const totalProducts = data.total || 0;

            if (!Array.isArray(products)) {
                console.error('Products data is not an array:', data);
                return;
            }


            const productList = document.getElementById('productList');
            if (!productList) {
                console.error('Product list container not found');
                return;
            }

            productList.innerHTML = '';
            products.forEach(product => {

                const designerId = product.designerUserId || product.DesignerUserId;
                const designerName = product.designer || product.Designer;
                const shoeId = product.shoeId || product.ShoeId;
                const productCard = `
                <div class="col-md-4 mb-4">
                    <div class="card h-100 shadow-sm">
                            <img src="${product.imageUrl || product.ImageUrl || 'placeholder.jpg'}" 
                                 class="card-img-top" alt="${product.name || product.Name}" 
                             style="height: 200px; object-fit: cover;">
                        <div class="card-body d-flex flex-column">
                                <h5 class="card-title">${product.name || product.Name}</h5>
                            <p class="card-text text-muted">
                                    Style: ${product.style || product.Style || 'N/A'}<br>
                                    Designer: ${designerName || 'N/A'}
                            </p>
                                <h4 class="card-subtitle mb-2 text-primary mt-auto">${formatPriceVND(product.price || product.Price || 0)}</h4>
                                <div class="d-flex gap-2 mt-2">
                                    <button onclick="viewProductDetails('${shoeId}')" class="btn btn-dark flex-grow-1">View Details</button>
                                    <button onclick="addToCart('${shoeId}')" class="btn btn-outline-primary">
                                        <i class="lnr lnr-cart"></i>
                                    </button>
                        </div>
                                <!-- Chat with Designer functionality commented out -->
                                <!-- <div class="mt-2">
                                    ${designerId && localStorage.getItem('role') && localStorage.getItem('role').toLowerCase() === 'user' ?
                        `<button onclick="chatWithDesigner('${designerId}', '${designerName}')" 
                                                class="btn btn-outline-success btn-sm w-100">
                                            <i class="bi bi-chat-dots"></i> Chat with Designer
                                        </button>` :
                        localStorage.getItem('role') && localStorage.getItem('role').toLowerCase() === 'designer' ?
                            `<button class="btn btn-outline-secondary btn-sm w-100" disabled>
                                            <i class="bi bi-info-circle"></i> Designer Account
                                        </button>` :
                            !localStorage.getItem('token') ?
                                `<button onclick="chatWithDesigner('${designerId}', '${designerName}')" 
                                                class="btn btn-outline-success btn-sm w-100">
                                            <i class="bi bi-chat-dots"></i> Chat with Designer
                                        </button>` :
                                `<button class="btn btn-outline-secondary btn-sm w-100" disabled>
                                            <i class="bi bi-chat-dots"></i> Designer Not Available
                                        </button>`
                    }
                    </div> -->
                </div>
                        </div>
                    </div>
            `;
                productList.innerHTML += productCard;
            });
            renderPagination(totalProducts);
        } catch (error) {
            console.error('There was a problem with the fetch operation for products:', error);
            const productList = document.getElementById('productList');
            if (productList) {
                productList.innerHTML = '<p class="text-danger">An error occurred while loading the product.</p>';
            }
        }
    }
    function renderPagination(totalProducts) {
        paginationElement.innerHTML = '';

        const totalPages = Math.ceil(totalProducts / productsPerPage);

        if (totalPages <= 1) return;

        // Previous button
        const prevLi = document.createElement('li');
        prevLi.classList.add('page-item');
        if (currentPage === 1) {
            prevLi.classList.add('disabled');
        }
        prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>`;
        prevLi.addEventListener('click', function (e) {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                fetchProducts();
            }
        });
        paginationElement.appendChild(prevLi);

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            const pageLi = document.createElement('li');
            pageLi.classList.add('page-item');
            if (currentPage === i) {
                pageLi.classList.add('active');
            }
            pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            pageLi.addEventListener('click', function (e) {
                e.preventDefault();
                currentPage = i;
                fetchProducts();
            });
            paginationElement.appendChild(pageLi);
        }

        // Next button
        const nextLi = document.createElement('li');
        nextLi.classList.add('page-item');
        if (currentPage === totalPages) {
            nextLi.classList.add('disabled');
        }
        nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>`;
        nextLi.addEventListener('click', function (e) {
            e.preventDefault();
            if (currentPage < totalPages) {
                currentPage++;
                fetchProducts();
            }
        });
        paginationElement.appendChild(nextLi);
    }

    const priceFilter = document.getElementById('priceFilter');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    designerFilter.addEventListener('change', function () {
        currentFilters.designer = this.value;
        currentPage = 1;
        fetchProducts();
    });

    styleFilter.addEventListener('change', function () {
        currentFilters.style = this.value;
        currentPage = 1;
        fetchProducts();
    });

    priceFilter.addEventListener('change', function () {
        currentFilters.price = this.value;
        currentPage = 1;
        fetchProducts();
    });

    if (searchInput) {
        searchInput.addEventListener('keyup', function (event) {
            if (event.key === 'Enter') {
                currentFilters.search = this.value;
                currentPage = 1;
                fetchProducts();
            }
        });
    }

    if (searchButton) {
        searchButton.addEventListener('click', function () {
            currentFilters.search = searchInput.value;
            currentPage = 1;
            fetchProducts();
        });
    }
    fetchProducts();

    window.addToCart = async function (shoeId) {
        const token = localStorage.getItem('token');

        if (!token) {
            const result = await Swal.fire({
                title: 'Login Required',
                text: 'Please login to add products to cart!',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Đăng nhập',
                cancelButtonText: 'Hủy',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33'
            });

            if (result.isConfirmed) {
                window.location.href = 'Login';
            }
            return;
        }

        try {
            const requestBody = {
                shoeId: shoeId,
                quantity: 1
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
                    // Token expired or invalid
                    localStorage.removeItem('token');
                    const result = await Swal.fire({
                        title: 'Session Expired',
                        text: 'Your session has expired.Please log in again.!',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Đăng nhập',
                        cancelButtonText: 'Hủy',
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33'
                    });

                    if (result.isConfirmed) {
                        window.location.href = 'Login';
                    }
                    return;
                }
                throw new Error(responseData.message || 'Failed to add to cart');
            }

            const result = await Swal.fire({
                title: 'Success!',
                text: responseData.message || 'Successfully add to cart!',
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'View cart',
                cancelButtonText: 'Contiunue shopping!',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#28a745'
            });

            if (result.isConfirmed) {
                window.location.href = 'cart';
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            await Swal.fire({
                title: 'Error!',
                text: error.message || 'Error when add item to cart!',
                icon: 'error',
                timer: 3000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
        }
    }

    window.viewProductDetails = function (shoeId) {
        window.location.href = `product-detail.html?id=${shoeId}`;
    }

    // Chat with Designer functionality commented out
    /*
    window.chatWithDesigner = function (designerUserId, designerName) {
        console.log('chatWithDesigner called with:', designerUserId, designerName);

        const token = localStorage.getItem('token');
        const userRole = localStorage.getItem('role');

        if (!token) {
            console.log('No token found, showing login prompt');
            Swal.fire({
                title: 'Login Required',
                text: 'Please login to chat with designer!',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Đăng nhập',
                cancelButtonText: 'Hủy',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = 'login';
                }
            });
            return;
        }
        if (!userRole || userRole.toLowerCase() !== 'user') {
            console.log('User role check failed:', userRole);
            Swal.fire({
                title: 'Access Denied',
                text: 'Only customers can chat with designers!',
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        // Redirect to designers page with chat parameters
        window.location.href = `designers.html?chatWith=${designerUserId}&designerName=${encodeURIComponent(designerName)}`;
    }
    */

    window.goToCart = function () {
        const token = localStorage.getItem('token');

        if (!token) {
            Swal.fire({
                title: 'Login Required',
                text: 'Please login to view cart!',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Login',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = 'login';
                }
            });
            return;
        }

        window.location.href = 'cart';
    }

    window.orderNow = function (shoeId) {
        // Redirect to product detail page for immediate ordering
        window.location.href = `product-detail.html?id=${shoeId}`;
    }

});