import { API_BASE_URL } from './config.js';
import './header.js';

document.addEventListener('DOMContentLoaded', async function () {
    await loadDesigners();
    
    // Check if we should auto-open chat with a specific designer
    const urlParams = new URLSearchParams(window.location.search);
    const chatWithDesignerId = urlParams.get('chatWith');
    const designerName = urlParams.get('designerName');
    
    if (chatWithDesignerId && designerName) {
        // Wait a bit for designers to load, then auto-open the chat
        setTimeout(() => {
            autoOpenDesignerChat(chatWithDesignerId, decodeURIComponent(designerName));
        }, 500);
    }
});

function autoOpenDesignerChat(designerId, designerName) {
    // Check if the designer exists in the loaded list
    const designerCard = document.querySelector(`[data-designer-id="${designerId}"]`);
    
    if (designerCard) {
        // Select the designer first
        window.selectDesigner(designerId, designerName, '', 0);
        
        // Then start the chat
        window.startChat(designerId, designerName, '');
    } else {
        // Designer not found in list, still try to open chat directly
        console.log('Designer not found in list, opening chat directly');
        window.startChat(designerId, designerName, '');
    }
    
    // Clean the URL
    const url = new URL(window.location);
    url.searchParams.delete('chatWith');
    url.searchParams.delete('designerName');
    window.history.replaceState({}, document.title, url.pathname);
}

async function loadDesigners() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const designersContainer = document.getElementById('designersContainer');

    try {
        console.log('Loading designers from:', `${API_BASE_URL}/Designer/public`);
        const response = await fetch(`${API_BASE_URL}/Designer/public`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const designers = await response.json();
        console.log('Designers data:', designers);

        // Hide loading spinner
        loadingSpinner.style.display = 'none';

        if (!Array.isArray(designers) || designers.length === 0) {
            renderNoDesigners(designersContainer);
            return;
        }

        renderDesigners(designers, designersContainer);
    } catch (error) {
        console.error('Error loading designers:', error);
        loadingSpinner.style.display = 'none';
        renderError(designersContainer);
    }
}

function renderDesigners(designers, container) {
    const designersHTML = designers.map(designer => {
        const designerId = designer.UserId;
        const designerName = designer.Name || 'Tên không xác định';
        const profileImage = designer.ImageProfile;
        const totalDesigns = designer.TotalDesigns || 0;

        return `
            <div class="designer-card" onclick="selectDesigner('${designerId}', '${designerName}', '${profileImage || ''}', ${totalDesigns})" data-designer-id="${designerId}">
                <div class="designer-list-item">
                    ${profileImage ? 
                        `<img src="${profileImage}" class="designer-avatar" alt="${designerName}">` :
                        `<div class="default-avatar">
                            <i class="bi bi-person-fill"></i>
                        </div>`
                    }
                    
                    <div class="flex-grow-1">
                        <h6 class="designer-name mb-1">${designerName}</h6>
                        <small class="text-muted">
                            <i class="bi bi-brush"></i> ${totalDesigns} thiết kế
                        </small>
                    </div>
                    
                    <div class="d-flex flex-column gap-1">
                        <button onclick="event.stopPropagation(); viewDesignerProducts('${designerId}', '${designerName}')" 
                                class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${localStorage.getItem('role') && localStorage.getItem('role').toLowerCase() === 'user' ?
                            `<button onclick="event.stopPropagation(); startChat('${designerId}', '${designerName}', '${profileImage || ''}')" 
                                    class="btn btn-sm btn-success">
                                <i class="bi bi-chat-dots"></i>
                            </button>` :
                            localStorage.getItem('role') && localStorage.getItem('role').toLowerCase() === 'designer' ?
                                `<button class="btn btn-sm btn-outline-secondary" disabled>
                                    <i class="bi bi-info-circle"></i>
                                </button>` :
                                !localStorage.getItem('token') ?
                                    `<button onclick="event.stopPropagation(); startChat('${designerId}', '${designerName}', '${profileImage || ''}')" 
                                            class="btn btn-sm btn-success">
                                        <i class="bi bi-chat-dots"></i>
                                    </button>` :
                                    `<button class="btn btn-sm btn-outline-secondary" disabled>
                                        <i class="bi bi-chat-dots"></i>
                                    </button>`
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = designersHTML;
}

function renderNoDesigners(container) {
    container.innerHTML = `
        <div class="col-12 no-designers">
            <i class="bi bi-people" style="font-size: 4rem; color: #dee2e6; margin-bottom: 20px;"></i>
            <h3 class="mb-3">Không có nhà thiết kế nào</h3>
            <p class="text-muted">Hiện tại chưa có nhà thiết kế nào hoạt động trên hệ thống.</p>
        </div>
    `;
}

function renderError(container) {
    container.innerHTML = `
        <div class="col-12 no-designers">
            <i class="bi bi-exclamation-triangle" style="font-size: 4rem; color: #dc3545; margin-bottom: 20px;"></i>
            <h3 class="mb-3">Lỗi tải dữ liệu</h3>
            <p class="text-muted">Không thể tải danh sách nhà thiết kế. Vui lòng thử lại sau.</p>
            <button onclick="window.location.reload()" class="btn btn-primary">
                <i class="bi bi-arrow-clockwise"></i> Thử lại
            </button>
        </div>
    `;
}

// Designer selection and chat functionality
let currentDesignerId = null;
let connection = null;

window.selectDesigner = function(designerId, designerName, profileImage, totalDesigns) {
    // Remove active class from all designer cards
    document.querySelectorAll('.designer-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // Add active class to selected designer
    document.querySelector(`[data-designer-id="${designerId}"]`).classList.add('active');
    
    // Show welcome screen (hide chat until user clicks chat button)
    showWelcomeScreen();
};

window.startChat = function(designerId, designerName, profileImage) {
    try {
        if (!localStorage.getItem('token')) {
            Swal.fire({
                title: 'Yêu cầu đăng nhập',
                text: 'Bạn cần đăng nhập để chat với nhà thiết kế',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Đăng nhập',
                cancelButtonText: 'Hủy'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = '/account/login.html';
                }
            });
            return;
        }

        const role = localStorage.getItem('role');
        if (role && role.toLowerCase() === 'designer') {
            Swal.fire({
                title: 'Không thể thực hiện',
                text: 'Nhà thiết kế không thể chat với nhà thiết kế khác',
                icon: 'error'
            });
            return;
        }

        // Initialize chat interface
        openChatInterface(designerId, designerName, profileImage);
    } catch (error) {
        console.error('Error starting chat:', error);
        Swal.fire({
            title: 'Lỗi',
            text: 'Có lỗi xảy ra khi khởi tạo chat',
            icon: 'error'
        });
    }
};

function openChatInterface(designerId, designerName, profileImage) {
    currentDesignerId = designerId;
    
    // Update chat header
    document.getElementById('chatDesignerName').textContent = designerName;
    const chatAvatar = document.getElementById('chatDesignerAvatar');
    if (profileImage && profileImage !== 'null' && profileImage !== '') {
        chatAvatar.src = profileImage;
        chatAvatar.style.display = 'block';
    } else {
        chatAvatar.style.display = 'none';
    }
    
    // Show chat interface
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('chatHeader').style.display = 'block';
    document.getElementById('chatMessages').style.display = 'block';
    document.getElementById('chatInput').style.display = 'flex';
    
    // Initialize SignalR connection and load messages
    initializeSignalR();
    loadChatHistory(designerId);
}

function showWelcomeScreen() {
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('chatHeader').style.display = 'none';
    document.getElementById('chatMessages').style.display = 'none';
    document.getElementById('chatInput').style.display = 'none';
}

window.closeChat = function() {
    showWelcomeScreen();
    currentDesignerId = null;
    if (connection) {
        connection.stop();
    }
};

// Chat functionality
async function initializeSignalR() {
    if (connection && connection.state === signalR.HubConnectionState.Connected) {
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        connection = new signalR.HubConnectionBuilder()
            .withUrl("https://localhost:7241/chathub", {
                accessTokenFactory: () => token
            })
            .build();

        connection.on("ReceiveMessage", function (fromUserId, message, timestamp) {
            if (fromUserId === currentDesignerId) {
                addMessageToChat(message, 'received', timestamp);
            }
        });

        await connection.start();
        console.log("SignalR Connected");
    } catch (err) {
        console.error("Error starting SignalR connection:", err);
    }
}

async function loadChatHistory(designerId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        console.log('Loading chat history for designer:', designerId);

        const response = await fetch(`${API_BASE_URL}/Chat/history/${designerId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('role');
            showToast('Session expired. Please login again.', 'error');
            return;
        }

        if (response.ok) {
            const data = await response.json();
            console.log('Chat history data:', data);

            const chatMessages = document.getElementById('chatMessages');
            
            // Handle the response format from chat.js
            const messages = data.messages || [];
            
            if (!messages || messages.length === 0) {
                chatMessages.innerHTML = '<p class="text-muted text-center">No messages yet. Start the conversation!</p>';
                return;
            }

            const messagesHTML = messages.map(msg => {
                const messageType = msg.isFromCurrentUser ? 'sent' : 'received';
                const formattedContent = formatMessageContent(msg.messageText);
                const timeString = formatTime(msg.sendAt);
                const readIndicator = msg.isFromCurrentUser && msg.isRead ? ' <i class="bi bi-check2-all text-primary" title="Read"></i>' : '';
                
                return `<div class="chat-message ${messageType}"><div class="message-bubble ${messageType}"><div>${formattedContent}</div><small class="message-time">${timeString}${readIndicator}</small></div></div>`;
            }).join('');

            chatMessages.innerHTML = messagesHTML;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
            console.error('Failed to load chat history:', response.status);
            showToast('Failed to load chat history', 'error');
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
        showToast('Error loading chat history', 'error');
    }
}

function addMessageToChat(message, type, timestamp) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    const time = timestamp ? new Date(timestamp).toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    }) : new Date().toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    messageDiv.innerHTML = `
        <div class="message-bubble ${type}">
            ${message}
        </div>
        <div class="message-time">${time}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.sendMessage = async function() {
    const messageInput = document.getElementById('messageInput');
    const messageContent = messageInput.innerHTML.trim();
    const messageText = messageInput.innerText.trim();
    
    if ((!messageText && !messageContent.includes('<img')) || !currentDesignerId) return;

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Please login to send messages', 'error');
            return;
        }

        // Process content to upload any base64 images and replace with URLs
        let finalMessageContent = await processMessageContent(messageContent);

        const response = await fetch(`${API_BASE_URL}/Chat/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                receiverId: currentDesignerId,
                messageText: finalMessageContent
            })
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('role');
            showToast('Session expired. Please login again.', 'error');
            return;
        }

        if (response.ok) {
            messageInput.innerHTML = '';
            
            // Add message to UI immediately
            addMessageToUI(finalMessageContent, true);
            
            // Send through SignalR if connected
            if (connection && connection.state === signalR.HubConnectionState.Connected) {
                await connection.invoke("SendMessage", currentDesignerId, finalMessageContent);
            }
        } else {
            throw new Error('Failed to send message');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Error sending message', 'error');
    }
};

// Utility functions from chat.js
function formatTime(dateString) {
    if (!dateString) return 'Unknown time';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diff = now - date;
    
    // More precise time formatting
    if (diff < 30000) return 'Just now'; // Less than 30 seconds
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`; // Less than 1 minute
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; // Less than 1 hour
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; // Less than 1 day
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`; // Less than 1 week
    
    // For older messages, show actual date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

function formatMessageContent(messageText) {
    if (!messageText) return '';
    
    // Check if message contains HTML tags (like image tags)
    if (messageText.includes('<img') || messageText.includes('<br>')) {
        return messageText; // Return as is if it contains HTML
    }
    
    // Escape plain text
    const div = document.createElement('div');
    div.textContent = messageText;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    // Create toast if it doesn't exist
    let toast = document.getElementById('chat-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'chat-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 5px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        document.body.appendChild(toast);
    }

    // Set background color based on type
    const colors = {
        'info': '#17a2b8',
        'error': '#dc3545',
        'success': '#28a745',
        'warning': '#ffc107'
    };
    
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.textContent = message;
    toast.style.display = 'block';

    // Hide after 3 seconds
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function addMessageToUI(messageText, isFromCurrentUser) {
    const container = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isFromCurrentUser ? 'sent' : 'received'}`;
    
    const messageBubble = document.createElement('div');
    messageBubble.className = `message-bubble ${isFromCurrentUser ? 'sent' : 'received'}`;
    
    const messageContent = document.createElement('div');
    messageContent.innerHTML = formatMessageContent(messageText);
    
    const timeElement = document.createElement('small');
    timeElement.className = 'message-time';
    timeElement.textContent = 'Just now';
    
    messageBubble.appendChild(messageContent);
    messageBubble.appendChild(timeElement);
    messageDiv.appendChild(messageBubble);

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

async function processMessageContent(htmlContent) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const images = tempDiv.querySelectorAll('img[src^="data:"]');
    
    for (const img of images) {
        const base64Data = img.src;
        const fileName = img.getAttribute('data-file-name') || 'image.png';
        
        // Convert base64 to blob
        const response = await fetch(base64Data);
        const blob = await response.blob();
        
        // Create file from blob
        const file = new File([blob], fileName, { type: blob.type });
        
        // Upload the file
        const imageUrl = await uploadImage(file);
        if (imageUrl) {
            img.src = imageUrl;
            img.removeAttribute('data-file-name');
            img.removeAttribute('data-file-size');
            img.style.maxWidth = '300px';
            img.style.maxHeight = '200px';
        }
    }
    
    return tempDiv.innerHTML;
}

async function uploadImage(imageFile) {
    try {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('image', imageFile);

        const response = await fetch(`${API_BASE_URL}/Chat/upload-image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            return data.imageUrl;
        } else {
            console.error('Failed to upload image');
            return null;
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        return null;
    }
}

function handleMultipleImageSelect(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    files.forEach(file => {
        processAndInsertImage(file);
    });

    // Clear the input so the same files can be selected again
    event.target.value = '';
}

async function processAndInsertImage(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select valid image files only', 'error');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image size must be less than 5MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        insertImageAtCursor(e.target.result, file);
    };
    reader.readAsDataURL(file);
}

function insertImageAtCursor(imageSrc, file) {
    const editor = document.getElementById('messageInput');
    
    // Create image element
    const img = document.createElement('img');
    img.src = imageSrc;
    img.style.maxWidth = '200px';
    img.style.maxHeight = '150px';
    img.style.borderRadius = '8px';
    img.style.margin = '4px 2px';
    img.setAttribute('data-file-name', file.name);
    img.setAttribute('data-file-size', file.size);
    
    // Focus on the editor first
    editor.focus();
    
    // Get current selection/cursor position
    const selection = window.getSelection();
    let range;
    
    if (selection.rangeCount > 0) {
        const currentRange = selection.getRangeAt(0);
        if (editor.contains(currentRange.commonAncestorContainer) || 
            currentRange.commonAncestorContainer === editor) {
            range = currentRange;
        } else {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
        }
    } else {
        range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
    }
    
    // Insert image at cursor
    range.deleteContents();
    range.insertNode(img);
    
    // Add a space after the image
    const textNode = document.createTextNode(' ');
    range.setStartAfter(img);
    range.insertNode(textNode);
    
    // Move cursor after the space
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    editor.focus();
}

function handlePaste(event) {
    const items = event.clipboardData.items;
    
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            event.preventDefault();
            const file = item.getAsFile();
            processAndInsertImage(file);
        }
    }
}

// Event bindings
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            // Enter key to send message (for contenteditable)
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    window.sendMessage();
                }
            });

            // Handle paste events for images
            messageInput.addEventListener('paste', handlePaste);
        }

        // Image upload functionality
        const imageBtn = document.getElementById('image-btn-designers');
        const imageInput = document.getElementById('image-input-designers');

        if (imageBtn && imageInput) {
            imageBtn.addEventListener('click', () => {
                imageInput.click();
            });

            imageInput.addEventListener('change', handleMultipleImageSelect);
        }
    }, 100);
});

window.viewDesignerProducts = function (designerId, designerName) {
    // Redirect to home page with designer filter
    window.location.href = `user/designerdetail.html?designerId=${designerId}`;
};