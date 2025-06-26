document.addEventListener("DOMContentLoaded", () => {
    // ==================== MODULE MANAGERS ====================
    const ModalManager = {
        show(modal) {
            modal.classList.add("show");
            document.body.classList.add("modal-open");
        },
        hide(modal) {
            modal.classList.remove("show");
            document.body.classList.remove("modal-open");
        },
        init() {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.hide(modal);
                    }
                });
            });
        }
    };

    const FormValidator = {
        showError(elementId, message) {
            const errorElement = document.getElementById(elementId);
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.style.display = 'block';
            }
        },
        resetErrors() {
            document.querySelectorAll('.form-error').forEach(el => {
                el.textContent = "";
                el.style.display = 'none';
            });
        },
        validateForm() {
            this.resetErrors();
            let isValid = true;

            // Kiểm tra tên thiết kế
            const name = document.getElementById("design-name").value.trim();
            if (!name) {
                this.showError("name-error", "Tên thiết kế là bắt buộc");
                isValid = false;
            } else if (name.length > 100) {
                this.showError("name-error", "Tối đa 100 ký tự");
                isValid = false;
            }

            // Kiểm tra mô tả
            const description = document.getElementById("design-description").value.trim();
            if (!description) {
                this.showError("description-error", "Mô tả là bắt buộc");
                isValid = false;
            } else if (description.length > 500) {
                this.showError("description-error", "Tối đa 500 ký tự");
                isValid = false;
            }

            // Kiểm tra danh mục
            const category = document.getElementById("design-category").value;
            if (!category) {
                this.showError("category-error", "Vui lòng chọn danh mục");
                isValid = false;
            }

            // Kiểm tra giá
            const price = parseFloat(document.getElementById("design-price").value);
            if (isNaN(price) || price < 0) {
                this.showError("price-error", "Vui lòng nhập giá hợp lệ");
                isValid = false;
            }

            // Kiểm tra số lượng
            const quantity = parseInt(document.getElementById("design-quantity").value, 10);
            if (isNaN(quantity)) {
                this.showError("quantity-error", "Vui lòng nhập số lượng hợp lệ");
                isValid = false;
            } else if (quantity < 1) {
                this.showError("quantity-error", "Số lượng tối thiểu là 1");
                isValid = false;
            }

            // Kiểm tra hình ảnh
            if (ImageManager.getImageCount() < 1) {
                this.showError("images-error", "Cần tải lên ít nhất 1 hình ảnh");
                isValid = false;
            } else if (ImageManager.getImageCount() > 5) {
                this.showError("images-error", "Tối đa 5 hình ảnh được phép");
                isValid = false;
            }

            return isValid;
        }
    };

    const ImageManager = {
        images: [],
        init() {
            const uploadArea = document.getElementById("image-upload-area");
            const imageUpload = document.getElementById("image-upload");
            const previewGrid = document.getElementById("image-preview-grid");

            uploadArea.addEventListener("click", () => imageUpload.click());

            uploadArea.addEventListener("dragover", e => {
                e.preventDefault();
                uploadArea.classList.add("dragover");
            });

            uploadArea.addEventListener("dragleave", () => {
                uploadArea.classList.remove("dragover");
            });

            uploadArea.addEventListener("drop", e => {
                e.preventDefault();
                uploadArea.classList.remove("dragover");
                if (e.dataTransfer.files.length > 0) {
                    this.handleFiles(e.dataTransfer.files);
                }
            });

            imageUpload.addEventListener("change", () => {
                if (imageUpload.files.length > 0) {
                    this.handleFiles(imageUpload.files);
                }
            });
        },
        handleFiles(files) {
            // Reset error
            FormValidator.showError("images-error", "");

            // Validate file count
            if (files.length > 5 || (this.images.length + files.length) > 5) {
                FormValidator.showError("images-error", "Maximum 5 images allowed");
                return;
            }

            const previewGrid = document.getElementById("image-preview-grid");
            let processedCount = 0;

            Array.from(files).forEach(file => {
                // Validate file type
                if (!file.type.match(/image\/(jpeg|png)/i)) {
                    console.warn(`Invalid file type: ${file.name}`);
                    return;
                }

                // Validate file size (5MB max)
                if (file.size > 5 * 1024 * 1024) {
                    console.warn(`File too large: ${file.name}`);
                    return;
                }

                processedCount++;
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imgContainer = document.createElement("div");
                    imgContainer.className = "image-preview-item";

                    const img = document.createElement("img");
                    img.src = e.target.result;

                    const removeBtn = document.createElement("button");
                    removeBtn.className = "remove-image";
                    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                    removeBtn.addEventListener("click", () => this.removeImage(e.target.result));

                    imgContainer.appendChild(img);
                    imgContainer.appendChild(removeBtn);
                    previewGrid.appendChild(imgContainer);

                    this.images.push(e.target.result);
                };
                reader.readAsDataURL(file);
            });

            if (processedCount === 0 && files.length > 0) {
                FormValidator.showError("images-error", "No valid images were selected");
            }
        },
        removeImage(imageData) {
            this.images = this.images.filter(img => img !== imageData);
            const previewGrid = document.getElementById("image-preview-grid");
            previewGrid.innerHTML = "";

            // Re-render remaining images
            this.images.forEach(img => {
                const imgContainer = document.createElement("div");
                imgContainer.className = "image-preview-item";

                const imgElement = document.createElement("img");
                imgElement.src = img;

                const removeBtn = document.createElement("button");
                removeBtn.className = "remove-image";
                removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                removeBtn.addEventListener("click", () => this.removeImage(img));

                imgContainer.appendChild(imgElement);
                imgContainer.appendChild(removeBtn);
                previewGrid.appendChild(imgContainer);
            });
        },
        getImageCount() {
            return this.images.length;
        },
        getImages() {
            return this.images;
        }
    };

    const ApiManager = {
        async loadCategories() {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    console.warn('Chưa có token. Vui lòng đăng nhập trước khi load profile.');
                    return;
                }
                const response = await fetch("/api/categories");
                if (!response.ok) throw new Error("Failed to fetch categories");

                const data = await response.json();
                const categorySelect = document.getElementById("design-category");

                // Clear existing options
                categorySelect.innerHTML = '<option value="" disabled selected>Chọn danh mục</option>';

                data.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.CategoryId;
                    option.textContent = cat.CategoryName;
                    categorySelect.appendChild(option);
                });
            } catch (error) {
                console.error("Error loading categories:", error);
                alert("Failed to load categories. Please refresh the page.");
            }
        },
        async submitDesign(formData) {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    console.warn('Chưa có token. Vui lòng đăng nhập trước khi load profile.');
                    return;
                }
                const response = await fetch('/api/Designer/Create_Design', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...formData,
                        Images: ImageManager.getImages()
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Failed to submit design");
                }

                return data;
            } catch (error) {
                console.error("API Error:", error);
                throw error;
            }
        },
        async generateVietQR(designId) {
            try {
                const response = await fetch(`/api/Designer/GenerateVietQR/${designId}`, {
                    method: 'POST'
                });
                return await response.json();
            } catch (error) {
                console.error("VietQR Error:", error);
                throw error;
            }
        }
    };

    // ==================== MAIN APPLICATION ====================
    const App = {
        currentDesignId: null,
        init() {
            ModalManager.init();
            ImageManager.init();
            ApiManager.loadCategories();
            this.setupEventListeners();
        },
        setupEventListeners() {
            const form = document.getElementById("design-form");
            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                const submitBtn = document.getElementById('submit-button');
                const spinner = document.getElementById('submit-spinner');
                const submitText = submitBtn.querySelector('.submit-text');

                // Show loading spinner
                spinner.classList.remove('hidden');
                submitText.textContent = 'Submitting...';
                submitBtn.disabled = true;
                // Simulate API call delay (1.5s)
                setTimeout(() => {
                    // Your actual form submission logic here
                    const quantity = parseInt(document.getElementById('design-quantity').value, 10);

                    if (quantity === 1) {
                        document.getElementById('vietqr-modal').classList.add('show');
                    } else {
                        document.getElementById('success-modal').classList.add('show');
                    }

                    // Reset button UI
                    spinner.classList.add('hidden');
                    submitText.textContent = 'Submit Design';
                    submitBtn.disabled = false;

                    // Optionally reset form
                    // document.getElementById('design-form').reset();
                }, 1500);
                await this.handleFormSubmit();

            });

            document.getElementById("generate-vietqr").addEventListener("click", async () => {
                await this.handleVietQRGeneration();
            });

            document.getElementById("skip-vietqr").addEventListener("click", () => {
                ModalManager.hide(document.getElementById("vietqr-modal"));
                ModalManager.show(document.getElementById("success-modal"));
            });
        },
        async handleFormSubmit() {
            if (!FormValidator.validateForm()) return;

            const submitButton = document.getElementById("submit-button");
            const submitSpinner = document.getElementById("submit-spinner");

            submitButton.disabled = true;
            submitSpinner.classList.remove("hidden");

            try {
                const formData = {
                    ShoeName: document.getElementById("design-name").value.trim(),
                    ShoeDescription: document.getElementById("design-description").value.trim(),
                    CategoryId: document.getElementById("design-category").value,
                    PriceAShoe: parseFloat(document.getElementById("design-price").value),
                    Quantity: parseInt(document.getElementById("design-quantity").value, 10)
                };

                const response = await ApiManager.submitDesign(formData);
                this.currentDesignId = response.designId;

                if (formData.Quantity === 1) {
                    ModalManager.show(document.getElementById("vietqr-modal"));
                } else {
                    ModalManager.show(document.getElementById("success-modal"));
                }
            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                submitButton.disabled = false;
                submitSpinner.classList.add("hidden");
            }
        },
        async handleVietQRGeneration() {
            try {
                await ApiManager.generateVietQR(this.currentDesignId);
                ModalManager.hide(document.getElementById("vietqr-modal"));
                ModalManager.show(document.getElementById("success-modal"));
            } catch (error) {
                alert("Failed to generate VietQR. Please try again later.");
            }
        }
    };

    // Initialize the application
    App.init();
});