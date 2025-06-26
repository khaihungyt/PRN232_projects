// Import the base chat functionality
import { API_BASE_URL } from '../config.js';

class DesignerChatSystem {
    constructor() {

        this.connection = null;
        this.currentUserId = null;
        this.currentUserName = null;
        this.token = localStorage.getItem('token');
        this.isConnected = false;
        this.conversations = [];
        this.uploadingImages = new Set();
        if (this.token) {
            this.initializeSignalR();
            this.bindEvents();
            this.loadConversations();
            this.startTimestampUpdater();
            this.handleResize();
        } else {
            console.warn('DesignerChatSystem: No token found');
            this.showError('Please login to access chat');
        }
    }

    async initializeSignalR() {
        if (!this.token) {
            console.warn('No token available for SignalR connection');
            return;
        }

        try {
            const connection = new signalR.HubConnectionBuilder()
                .withUrl("/chatHub", {
                    accessTokenFactory: () => this.token,
                    transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
                    skipNegotiation: false,
                    withCredentials: true,
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                })
                .withAutomaticReconnect({
                    nextRetryDelayInMilliseconds: retryContext => {
                        if (retryContext.previousRetryCount < 3) {
                            return Math.random() * 10000;
                        } else {
                            return null;
                        }
                    }
                })
                .configureLogging(signalR.LogLevel.Debug)
                .build();

            // Set up event handlers
            connection.on("ReceiveMessage", (data) => {
                this.handleIncomingMessage(data);
            });

            connection.on("MessageSent", (data) => {
                this.handleMessageSent(data);
            });

            connection.on("MessagesMarkedAsRead", (data) => {
                this.handleMessagesMarkedAsRead(data);
            });

            connection.on("MessagesReadConfirmation", (data) => {
                this.handleMessagesReadConfirmation(data);
            });

            connection.onreconnecting((error) => {
                this.isConnected = false;
            });

            connection.onreconnected((connectionId) => {
                this.isConnected = true;
                if (this.currentUserId) {
                    connection.invoke("JoinUserGroup", this.currentUserId);
                }
            });

            connection.onclose((error) => {
                this.isConnected = false;
            });

            await connection.start();
            this.connection = connection;
            this.isConnected = true;

            // Join user group for the designer
            const designerId = localStorage.getItem('userId');
            if (designerId) {
                await connection.invoke("JoinUserGroup", designerId);
            }
        } catch (err) {
            this.isConnected = false;
            console.error('SignalR connection failed:', err);
        }
    }

    bindEvents() {
        const requiredElements = {
            'send-btn': document.getElementById('send-btn'),
            'message-input': document.getElementById('message-input'),
            'mobile-back-btn': document.getElementById('mobile-back-btn'),
            'image-btn': document.getElementById('image-btn'),
            'image-input': document.getElementById('image-input'),
            'chat-input': document.getElementById('chat-input'),
            'chat-header': document.getElementById('chat-header'),
            'conversations-list': document.getElementById('conversations-list'),
            'chat-messages': document.getElementById('chat-messages')
        };
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        } else {
            console.error('Send button not found!');
        }
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            messageInput.addEventListener('paste', (e) => {
                this.handlePaste(e);
            });
        } else {
            console.error('Message input not found!');
        }
        const mobileBackBtn = document.getElementById('mobile-back-btn');
        if (mobileBackBtn) {
            mobileBackBtn.addEventListener('click', () => {
                this.showConversationsList();
            });
        }

        // Image upload button
        const imageBtn = document.getElementById('image-btn');
        const imageInput = document.getElementById('image-input');
        if (imageBtn && imageInput) {
            imageBtn.addEventListener('click', () => {
                imageInput.click();
            });

            imageInput.addEventListener('change', (e) => {
                this.handleMultipleImageSelect(e);
            });
        } else {
            console.error('Image upload elements not found!', { imageBtn: !!imageBtn, imageInput: !!imageInput });
        }
    }

    async loadConversations() {
        try {
            this.token = localStorage.getItem('token');

            if (!this.token) {
                this.showError('Please login to view conversations');
                this.displayConversations([]);
                return;
            }

            const response = await fetch(`${API_BASE_URL}/Chat/conversations`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (response.ok) {
                const data = await response.json();
                if (data && data.conversations) {
                    this.conversations = data.conversations;
                    this.displayConversations(data.conversations);
                } else {
                    this.conversations = [];
                    this.displayConversations([]);
                }
            } else {
                this.displayConversations([]);
                this.showError('Failed to load conversations');
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
            this.displayConversations([]);
            this.showError('Error loading conversations');
        }
    }

    displayConversations(conversations) {
        const container = document.getElementById('conversations-list');

        if (!conversations || !Array.isArray(conversations) || conversations.length === 0) {
            container.innerHTML = '<div class="loading">No conversations yet</div>';
            return;
        }

        container.innerHTML = conversations
            .filter(conv => conv && conv.partnerId && conv.partnerName)
            .map(conv => `
                <div class="conversation-item" onclick="designerChat.openConversation('${conv.partnerId}', '${conv.partnerName}')" data-user-id="${conv.partnerId}">
                    <div class="conversation-user">
                        <span>${conv.partnerName || 'Unknown User'}</span>
                        <span class="conversation-time" data-timestamp="${conv.lastMessageTime}">${this.formatTime(conv.lastMessageTime)}</span>
                    </div>
                    <div class="conversation-preview">${this.getDisplayMessageForList(conv.lastMessage)}</div>
                    ${conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : ''}
                </div>
            `).join('');
    }

    openConversation(userId, userName) {
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });

        const selectedItem = document.querySelector(`[data-user-id="${userId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        this.currentUserId = userId;
        this.currentUserName = userName;
        const chatHeader = document.getElementById('chat-header');
        const chatInput = document.getElementById('chat-input');
        const userNameEl = document.getElementById('chat-user-name');
        if (chatHeader) {
            chatHeader.style.display = 'block';
            console.log('Chat header displayed');
        }
        if (chatInput) {
            chatInput.style.display = 'block';
            console.log('Chat input displayed');
        }
        if (userNameEl) {
            userNameEl.textContent = userName;
        }

        this.loadChatHistory(userId);

        const unreadBadge = selectedItem?.querySelector('.unread-badge');
        if (unreadBadge) {
            unreadBadge.remove();
        }
        this.markMessagesAsRead(userId);

        if (window.innerWidth <= 768) {
            document.getElementById('conversations-panel').classList.remove('mobile-show');
            document.getElementById('chat-panel').classList.add('mobile-show');
            const mobileBackBtn = document.getElementById('mobile-back-btn');
            if (mobileBackBtn) {
                mobileBackBtn.style.display = 'inline-block';
            }
        }
    }

    showConversationsList() {
        if (window.innerWidth <= 768) {
            document.getElementById('conversations-panel').classList.add('mobile-show');
            document.getElementById('chat-panel').classList.remove('mobile-show');
        }

        this.currentUserId = null;
        this.currentUserName = null;

        const chatHeader = document.getElementById('chat-header');
        const chatInput = document.getElementById('chat-input');
        const mobileBackBtn = document.getElementById('mobile-back-btn');

        if (chatHeader) chatHeader.style.display = 'none';
        if (chatInput) chatInput.style.display = 'none';
        if (mobileBackBtn) mobileBackBtn.style.display = 'none';

        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = `
                <div class="empty-chat">
                    <div>
                        <i class="fas fa-comments" style="font-size: 48px; color: #ddd; margin-bottom: 16px;"></i>
                        <div>Select a conversation to start chatting</div>
                    </div>
                </div>
            `;
        }

        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    async loadChatHistory(userId) {
        try {
            this.token = localStorage.getItem('token');

            if (!this.token) {
                this.showError('Please login to view chat history');
                this.displayMessages([]);
                return;
            }

            const response = await fetch(`${API_BASE_URL}/Chat/history/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (response.ok) {
                const data = await response.json();
                if (data && data.messages) {
                    this.displayMessages(data.messages);
                } else {
                    this.displayMessages([]);
                }
            } else {
                this.displayMessages([]);
                this.showError('Failed to load chat history');
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            this.displayMessages([]);
            this.showError('Error loading chat history');
        }
    }

    displayMessages(messages) {
        const container = document.getElementById('chat-messages');

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            container.innerHTML = `
                <div class="empty-chat">
                    <div>
                        <i class="fas fa-comments" style="font-size: 48px; color: #ddd; margin-bottom: 16px;"></i>
                        <div>No messages yet. Start the conversation!</div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = messages
            .filter(msg => msg && msg.messageText)
            .map(msg => `
                <div class="message ${msg.isFromCurrentUser ? 'sent' : 'received'}">
                    <div class="message-bubble">
                        <div>${this.formatMessageContent(msg.messageText)}</div>
                        <div class="message-time">
                            ${this.formatTime(msg.sendAt)}
                            ${msg.isFromCurrentUser && msg.isRead ? '<i class="fas fa-check-double read-indicator" title="Read"></i>' : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        container.scrollTop = container.scrollHeight;
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');

        if (!input || !this.currentUserId) return;
        const messageContent = input.innerHTML.trim();
        const messageText = input.innerText.trim();

        if (!messageText && !messageContent.includes('<img')) return;

        if (sendBtn) sendBtn.disabled = true;

        try {
            this.token = localStorage.getItem('token');

            if (!this.token) {
                this.showError('Please login to send messages');
                return;
            }
            let finalMessageContent = await this.processMessageContent(messageContent);

            const response = await fetch(`${API_BASE_URL}/Chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    receiverId: this.currentUserId,
                    messageText: finalMessageContent
                })
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (response.ok) {
                input.innerHTML = '';
                this.addMessageToUI(finalMessageContent, true);

                this.loadConversations();
            } else {
                this.showError('Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Error sending message');
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    addMessageToUI(messageText, isFromCurrentUser) {
        const container = document.getElementById('chat-messages');

        const emptyChat = container.querySelector('.empty-chat');
        if (emptyChat) {
            emptyChat.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isFromCurrentUser ? 'sent' : 'received'}`;

        messageDiv.innerHTML = `
            <div class="message-bubble">
                <div>${this.formatMessageContent(messageText)}</div>
                <div class="message-time">Just now</div>
            </div>
        `;

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }

    handleIncomingMessage(data) {

        if (this.currentUserId === data.senderId) {
            this.addMessageToUI(data.message, false);
        }

        this.loadConversations();
    }

    handleMessageSent(data) {
    }

    handleMessagesMarkedAsRead(data) {
        if (this.currentUserId === data.readByUserId) {
            this.loadChatHistory(this.currentUserId);
        }
    }

    handleMessagesReadConfirmation(data) {
    }

    async markMessagesAsRead(senderId) {
        try {
            this.token = localStorage.getItem('token');

            if (!this.token || !senderId) return;

            const response = await fetch(`${API_BASE_URL}/Chat/mark-read/${senderId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (this.connection && this.isConnected) {
                    await this.connection.invoke("MarkMessagesAsRead", senderId);
                }
            }
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }

    formatTime(dateString) {
        if (!dateString) return 'Unknown time';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';

        const now = new Date();
        const diff = now - date;

        // Time formatting logic
        if (diff < 30000) return 'Just now';
        if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

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

    startTimestampUpdater() {
        setInterval(() => {
            const timeElements = document.querySelectorAll('.conversation-time');
            timeElements.forEach(timeElement => {
                const timestamp = timeElement.getAttribute('data-timestamp');
                if (timestamp) {
                    timeElement.textContent = this.formatTime(timestamp);
                }
            });
        }, 30000);
    }

    handleAuthError() {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        this.showError('Session expired. Please login again.');

        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
    }

    showError(message) {
        console.error(message);

        let toast = document.getElementById('error-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'error-toast';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f44336;
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                z-index: 1000;
                display: none;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 4000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatMessageContent(messageText) {
        if (!messageText) return '';

        if (messageText.includes('<img') || messageText.includes('<br>')) {
            return messageText; // Return as is if it contains HTML
        }

        return this.escapeHtml(messageText); // Escape plain text
    }

    getDisplayMessageForList(messageText) {
        if (!messageText) return 'No messages';

        if (messageText.includes('<img')) {
            return 'Sent you a picture';
        }

        if (messageText.includes('<br>') && messageText.includes('<img')) {
            const textPart = messageText.split('<br>')[0];
            return textPart.length > 30 ? textPart.substring(0, 30) + '... and a picture' : textPart + ' and a picture';
        }

        const plainText = messageText.replace(/<[^>]*>/g, '');
        return plainText.length > 50 ? plainText.substring(0, 50) + '...' : plainText;
    }

    handleMultipleImageSelect(event) {
        const files = Array.from(event.target.files);
        if (!files.length) return;

        files.forEach(file => {
            this.processAndInsertImage(file);
        });

        event.target.value = '';
    }

    async processAndInsertImage(file) {
        if (!file.type.startsWith('image/')) {
            this.showError('Please select valid image files only');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showError('Image size must be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.insertImageAtCursor(e.target.result, file);
        };
        reader.readAsDataURL(file);
    }

    insertImageAtCursor(imageSrc, file) {
        const editor = document.getElementById('message-input');

        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.maxWidth = '200px';
        img.style.maxHeight = '150px';
        img.style.borderRadius = '8px';
        img.style.margin = '4px 2px';
        img.setAttribute('data-file-name', file.name);
        img.setAttribute('data-file-size', file.size);

        editor.focus();

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

        range.deleteContents();
        range.insertNode(img);

        const textNode = document.createTextNode(' ');
        range.setStartAfter(img);
        range.insertNode(textNode);

        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

        editor.focus();
    }

    handlePaste(event) {
        const items = event.clipboardData.items;

        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                event.preventDefault();
                const file = item.getAsFile();
                this.processAndInsertImage(file);
            }
        }
    }

    async processMessageContent(htmlContent) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        const images = tempDiv.querySelectorAll('img[src^="data:"]');

        for (const img of images) {
            const base64Data = img.src;
            const fileName = img.getAttribute('data-file-name') || 'image.png';

            const response = await fetch(base64Data);
            const blob = await response.blob();

            const file = new File([blob], fileName, { type: blob.type });

            const imageUrl = await this.uploadImage(file);
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

    async uploadImage(imageFile) {
        try {
            const formData = new FormData();
            formData.append('image', imageFile);

            const response = await fetch(`${API_BASE_URL}/Chat/upload-image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
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

    handleResize() {
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                document.getElementById('conversations-panel').classList.remove('mobile-show');
                document.getElementById('chat-panel').classList.remove('mobile-show');
                const mobileBackBtn = document.getElementById('mobile-back-btn');
                if (mobileBackBtn) {
                    mobileBackBtn.style.display = 'none';
                }
            } else {
                if (!this.currentUserId) {
                    document.getElementById('conversations-panel').classList.add('mobile-show');
                    document.getElementById('chat-panel').classList.remove('mobile-show');
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {

    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (token && role === 'designer') {
        window.designerChat = new DesignerChatSystem();
    } else {
        console.warn('Designer chat requires Designer role and valid token');
        const conversationsList = document.getElementById('conversations-list');
        if (conversationsList) {
            conversationsList.innerHTML = '<div class="loading">Please login as a Designer to access chat</div>';
        }
    }
});
window.DesignerChatSystem = DesignerChatSystem; 