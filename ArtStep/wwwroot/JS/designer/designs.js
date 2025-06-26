document.addEventListener('DOMContentLoaded', async function () {
    // ====================== DOM ELEMENTS ======================
    const designsGrid = document.getElementById('designs-grid');
    const filterButtons = document.querySelectorAll('.btn-filter');
    const actionsMenu = document.getElementById('design-actions-menu');
    const previewModal = document.getElementById('preview-modal');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const categorySelect = document.getElementById('edit-category');
    const imageListContainer = document.getElementById('edit-image-list');
    const addImageBtn = document.getElementById('add-image-btn');
    const imageUploadInput = document.getElementById('image-upload');
    const previewImagesContainer = document.getElementById('preview-images-container');
    const previewMainImage = document.getElementById('preview-main-image');
    const previewThumbnails = document.getElementById('preview-thumbnails');

    // ====================== STATE ======================
    let designs = [];
    let categories = [];
    let currentFilter = 'all';
    let activeDropdown = null;
    let currentEditImages = [];

    // ====================== INITIALIZATION ======================
    try {
        await Promise.all([fetchDesigns(), fetchCategories()]);
        renderDesigns();
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('Failed to load data. Please refresh the page.', 'error');
    }

    // ====================== DATA FETCHING ======================
    async function fetchDesigns() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('Chưa có token. Vui lòng đăng nhập trước khi load profile.');
                return;
            }
            const response = await fetch('/api/designer', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            designs = data.map(design => ({
                ...design,
                ShoeImages: design.ShoeImages || []
            }));
        } catch (error) {
            console.error('Error fetching designs:', error);
            throw error;
        }
    }

    async function fetchCategories() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('Chưa có token. Vui lòng đăng nhập trước khi load profile.');
                return;
            }
            const response = await fetch('/api/categories');

            if (!response.ok) throw new Error('Failed to fetch categories');

            categories = await response.json();
            populateCategoryDropdown();
        } catch (error) {
            console.error('Error fetching categories:', error);
            throw error;
        }
    }

    function populateCategoryDropdown() {
        categorySelect.innerHTML = categories.map(cat =>
            `<option value="${cat.CategoryId}">${cat.CategoryName}</option>`
        ).join('');
    }

    // ====================== RENDERING ======================
    function renderDesigns() {
        fetchDesigns();
        designsGrid.innerHTML = '';

        const filteredDesigns = filterDesigns();
        filteredDesigns.forEach(design => {
            const designCard = createDesignCard(design);
            designsGrid.appendChild(designCard);
        });
    }

    function filterDesigns() {
        return designs.filter(design => {
            if (currentFilter === 'all') return true;
            const status = design.IsHidden == 1 ? 'hidden' : 'shown';
            return status === currentFilter;
        });
    }

    function createDesignCard(design) {
        const status = design.IsHidden == 1 ? 'hidden' : 'shown';
        const mainImage = design.ShoeImages[0]?.ImageLink || 'https://placehold.co/300x300';

        const designCard = document.createElement('div');
        designCard.className = 'card design-card';
        designCard.dataset.id = design.ShoeId;

        designCard.innerHTML = `
            <div class="design-image">
                <img src="${mainImage}" alt="${design.ShoeName}" loading="lazy">
                <div class="design-badge ${status}" style="display: block;">
                    ${status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
            </div>
            <div class="design-info">
                <div class="design-details">
                    <h3>${design.ShoeName}</h3>
                    <p class="design-price">${design.PriceAShoe}</p>
                    <p class="design-desc">${design.ShoeDescription || 'No description available'}</p>
                </div>
                <div class="design-actions">
                    <button class="design-menu-btn" data-id="${design.ShoeId}">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                </div>
            </div>
            <div class="design-footer">
                <button class="btn btn-outline edit-btn" data-id="${design.ShoeId}">
                    <i class="fas fa-edit"></i> Sửa 
                </button>
                <button class="btn btn-secondary preview-btn" data-id="${design.ShoeId}">
                    <i class="fas fa-eye"></i> Xem Trước 
                </button>
            </div>
        `;

        return designCard;
    }

 
    // ====================== IMAGE MANAGEMENT ======================
    function renderImageList(images = []) {
        imageListContainer.innerHTML = '';
        currentEditImages = [...images];

        if (currentEditImages.length === 0) {
            imageListContainer.innerHTML = '<p class="no-images">No images added</p>';
            return;
        }

        currentEditImages.forEach((image, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.dataset.index = index;

            imageItem.innerHTML = `
            <img src="${image.ImageLink}" alt="Design image ${index + 1}" loading="lazy">
            <div class="image-actions">
                <button class="btn btn-sm btn-move-up" ${index === 0 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="btn btn-sm btn-move-down" ${index === currentEditImages.length - 1 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-down"></i>
                </button>
                <button class="btn btn-sm btn-delete-image">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
            imageListContainer.appendChild(imageItem);
        });
    }


    function createImageItem(image, index) {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.dataset.index = index;

        imageItem.innerHTML = `
            <img src="${image.ImageLink}" alt="Design image ${index + 1}" loading="lazy">
            <div class="image-actions">
                <button class="btn btn-sm btn-move-up" ${index === 0 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="btn btn-sm btn-move-down" ${index === currentEditImages.length - 1 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-down"></i>
                </button>
                <button class="btn btn-sm btn-delete-image">
                    <i class="fas fa-trash"></i>
                </button>
                ${index === 0 ? '<span class="main-badge">Main</span>' : ''}
            </div>
        `;

        return imageItem;
    }

    // ====================== IMAGE HANDLING ======================
    async function handleImageUpload(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            showAlert('Uploading images...', 'info');

            const newImages = await Promise.all(
                Array.from(files).map(file => convertToBase64(file))
            );

            currentEditImages = [
                ...currentEditImages,
                ...newImages.map(base64 => ({
                    ImageId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    ImageLink: base64
                }))
            ];

            renderImageList(currentEditImages);
            showAlert('Images added successfully!', 'success');
        } catch (error) {
            console.error('Error processing images:', error);
            showAlert('Failed to process images', 'error');
        } finally {
            e.target.value = '';
        }
    }

    function convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // ====================== FORM SUBMISSION ======================

    function mockUploadImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                resolve({
                    ImageLink: event.target.result,
                    ImageId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    IsMain: false
                });
            };
            reader.readAsDataURL(file);
        });
    }

    // ====================== MODAL FUNCTIONS ======================
    function openPreviewModal(designId) {
        const design = designs.find(d => d.ShoeId === designId);
        if (!design) return;

        const images = design.ShoeImages || [];

        // Set main image
        previewMainImage.src = images[0]?.ImageLink || '';
        previewMainImage.alt = design.ShoeName;

        // Set thumbnails
        renderPreviewThumbnails(images, design.ShoeName);

        // Set other details
        document.getElementById('preview-title').textContent = design.ShoeName;
        document.getElementById('preview-price').textContent = `Price:${design.PriceAShoe}`;
        document.getElementById('preview-quantity').textContent = `Quantity: ${design.Quantity}`;
        // document.getElementById('preview-description').textContent = design.ShoeDescription || 'No description';
        document.getElementById('preview-category').textContent = `Category: ${design.Category?.CategoryName || 'N/A'}`;
        document.getElementById('preview-status').textContent = `Status: ${design.IsHidden == 1 ? 'Hidden' : 'Shown'}`;

        previewModal.style.display = 'block';
    }

    function renderPreviewThumbnails(images, shoeName) {
        previewThumbnails.innerHTML = '';

        images.forEach((img, index) => {
            const thumb = document.createElement('img');
            thumb.src = img.ImageLink;
            thumb.alt = `${shoeName} thumbnail ${index + 1}`;
            thumb.classList.add('thumbnail');
            if (index === 0) thumb.classList.add('active');

            thumb.addEventListener('click', () => {
                previewMainImage.src = img.ImageLink;
                document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });

            previewThumbnails.appendChild(thumb);
        });
    }

    function openEditModal(designId) {
        const design = designs.find(d => d.ShoeId === designId);
        if (!design) return;

        // Fill form
        document.getElementById('edit-shoe-id').value = design.ShoeId;
        document.getElementById('edit-shoe-name').value = design.ShoeName;
        document.getElementById('edit-price').value = design.PriceAShoe;
        document.getElementById('edit-quantity').value = design.Quantity;
        document.getElementById('edit-description').value = design.ShoeDescription || '';
        document.getElementById('edit-category').value = design.Category?.CategoryId || '';

        // Set images
        renderImageList(design.ShoeImages);

        editModal.style.display = 'block';
    }

    async function submitEditForm(e) {
        e.preventDefault();

        const formData = createFormData();

        try {

            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('Chưa có token. Vui lòng đăng nhập trước khi load profile.');
                return;
            }
            showAlert('Saving changes...', 'info');

            const response = await fetch('/api/Designer/update', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update design');
            }

            const updatedDesign = await response.json();
            updateDesignInList(updatedDesign);

            showAlert('Design updated successfully!', 'success');
            editModal.style.display = 'none';
        } catch (error) {
            console.error('Error updating design:', error);
            showAlert(error.message || 'Failed to update design', 'error');
        }
    }

    function createFormData() {
        return {
            ShoeId: document.getElementById('edit-shoe-id').value,
            ShoeName: document.getElementById('edit-shoe-name').value,
            ShoeDescription: document.getElementById('edit-description').value.trim(),
            PriceAShoe: parseFloat(document.getElementById('edit-price').value),
            Quantity: parseInt(document.getElementById('edit-quantity').value),
            CategoryId: document.getElementById('edit-category').value,
            ShoeImages: currentEditImages.map(img => ({
                ImageId: img.ImageId,
                ImageLink: img.ImageLink // Sử dụng ImageData thay vì ImageLink
            }))
        };
    }

    function updateDesignInList(updatedDesign) {
        const index = designs.findIndex(d => d.ShoeId === updatedDesign.ShoeId);
        if (index !== -1) {
            designs[index] = {
                ...updatedDesign,
                ShoeImages: updatedDesign.ShoeImages || []
            };
            renderDesigns();
        }
    }

    // ====================== EVENT HANDLERS ======================
    function handleImageListAction(e) {
        const target = e.target.closest('button');
        if (!target) return;

        const imageItem = target.closest('.image-item');
        if (!imageItem) return;

        const index = parseInt(imageItem.dataset.index);

        if (target.classList.contains('btn-delete-image')) {
            handleDeleteImage(index);
        }
        else if (target.classList.contains('btn-move-up')) {
            handleMoveImage(index, 'up');
        }
        else if (target.classList.contains('btn-move-down')) {
            handleMoveImage(index, 'down');
        }

        renderImageList(currentEditImages);
    }

    function handleDeleteImage(index) {
        currentEditImages.splice(index, 1);
        if (index === 0 && currentEditImages.length > 0) {
            currentEditImages[0].IsMain = true;
        }
    }

    function handleMoveImage(index, direction) {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        [currentEditImages[index], currentEditImages[newIndex]] =
            [currentEditImages[newIndex], currentEditImages[index]];

        // Update main image if needed
        if (newIndex === 0 || index === 0) {
            currentEditImages[0].IsMain = true;
            if (newIndex === 0) {
                currentEditImages[1].IsMain = false;
            } else {
                currentEditImages[0].IsMain = true;
            }
        }
    }

    function handleFilterClick() {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.dataset.filter;
        renderDesigns();
    }

    function handleActionMenuClick(e) {
        e.preventDefault();
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            openEditModal(editBtn.dataset.id);
        }
    
        e.stopPropagation();

        const designId = this.dataset.id;
        if (e.target.closest('.delete-design')) {
            confirmDeleteDesign(designId);
        }

        this.classList.remove('open');
        activeDropdown = null;
    }

    async function confirmDeleteDesign(designId) {
        if (!confirm('Are you sure you want to delete this design? This action cannot be undone.')) {
            return;
        }
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('Chưa có token. Vui lòng đăng nhập trước khi load profile.');
            return;
        }
        try {
            const response = await fetch(`/api/designer/${designId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to delete design');

            designs = designs.filter(d => d.ShoeId !== designId);
            renderDesigns();
            showAlert('Design deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting design:', error);
            showAlert('Failed to delete design', 'error');
        }
    }

    // ====================== UTILITY FUNCTIONS ======================
    function showAlert(message, type = 'info') {
        const alertBox = document.createElement('div');
        alertBox.className = `alert alert-${type}`;
        alertBox.textContent = message;

        document.body.appendChild(alertBox);

        setTimeout(() => {
            alertBox.classList.add('fade-out');
            setTimeout(() => alertBox.remove(), 500);
        }, 3000);
    }

    function closeAllModals() {
        previewModal.style.display = 'none';
        editModal.style.display = 'none';
    }

    // ====================== EVENT LISTENERS SETUP ======================
    function setupEventListeners() {
        // Filter buttons
        filterButtons.forEach(button => {
            button.addEventListener('click', handleFilterClick);
        });

        // Dropdown menu
        actionsMenu.addEventListener('click', handleActionMenuClick);

        // Modal close buttons
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', closeAllModals);
        });

        // Cancel edit button
        document.getElementById('cancel-edit').addEventListener('click', () => {
            editModal.style.display = 'none';
        });

        // Form submission
        editForm.addEventListener('submit', submitEditForm);

        // Image management
        imageListContainer.addEventListener('click', handleImageListAction);
        addImageBtn.addEventListener('click', () => imageUploadInput.click());
        imageUploadInput.addEventListener('change', handleImageUpload);

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === previewModal || e.target === editModal) {
                closeAllModals();
            }
            if (activeDropdown && !e.target.closest('.dropdown-menu')) {
                activeDropdown.classList.remove('open');
                activeDropdown = null;
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAllModals();
            }
        });

        // Delegate events for dynamic elements
        designsGrid.addEventListener('click', (e) => {
            const menuBtn = e.target.closest('.design-menu-btn');
            const editBtn = e.target.closest('.edit-btn');
            const previewBtn = e.target.closest('.preview-btn');

            if (menuBtn) {
                e.preventDefault();
                toggleDropdown.call(menuBtn, e);
            } else if (editBtn) {
                e.preventDefault();
                openEditModal(editBtn.dataset.id);
            } else if (previewBtn) {
                e.preventDefault();
                openPreviewModal(previewBtn.dataset.id);
            }
        });
    }

    function toggleDropdown(e) {
        e.stopPropagation();
        const designId = this.dataset.id;

        if (activeDropdown) {
            activeDropdown.classList.remove('open');
        }

        const rect = this.getBoundingClientRect();
        actionsMenu.style.top = `${rect.bottom + window.scrollY}px`;
        actionsMenu.style.right = `${window.innerWidth - rect.right}px`;

        actionsMenu.dataset.id = designId;
        actionsMenu.classList.add('open');
        activeDropdown = actionsMenu;
    }
    fetchDesigns();
});