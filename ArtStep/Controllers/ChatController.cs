using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ArtStep.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using ArtStep.Hubs;

namespace ArtStep.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly ArtStepDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public ChatController(ArtStepDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        [HttpPost("send")]
        public async Task<ActionResult> SendMessage([FromBody] SendMessageDto messageDto)
        {
            try
            {
                var senderId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(senderId))
                    return Unauthorized(new { message = "User not authenticated" });

                // Create message record
                var message = new Message
                {
                    MessageId = Guid.NewGuid().ToString(),
                    MessageDescription = messageDto.MessageText,
                    MessageType = true, // true for sent, false for received
                    SenderId = senderId,
                    ReceivedId = messageDto.ReceiverId,
                    SendAt = DateTime.Now
                };

                _context.Message.Add(message);
                await _context.SaveChangesAsync();

                // Get sender info for real-time notification
                var sender = await _context.User.FindAsync(senderId);

                // Send real-time notification via SignalR
                await _hubContext.Clients.Group($"User_{messageDto.ReceiverId}")
                    .SendAsync("ReceiveMessage", new
                    {
                        messageId = message.MessageId,
                        senderId = senderId,
                        senderName = sender?.Name ?? "Unknown",
                        message = messageDto.MessageText,
                        timestamp = message.SendAt
                    });

                return Ok(new
                {
                    message = "Message sent successfully",
                    messageId = message.MessageId,
                    timestamp = message.SendAt
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while sending the message" });
            }
        }

        [HttpGet("history/{designerId}")]
        public async Task<ActionResult> GetChatHistory(string designerId)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                var messages = await _context.Message
                    .Include(m => m.UserSend)
                    .Include(m => m.UserReceived)
                    .Where(m => (m.SenderId == userId && m.ReceivedId == designerId) ||
                               (m.SenderId == designerId && m.ReceivedId == userId))
                    .OrderBy(m => m.SendAt)
                    .Select(m => new
                    {
                        messageId = m.MessageId,
                        messageText = m.MessageDescription,
                        senderId = m.SenderId,
                        senderName = m.UserSend != null ? m.UserSend.Name : "Unknown",
                        receiverId = m.ReceivedId,
                        receiverName = m.UserReceived != null ? m.UserReceived.Name : "Unknown",
                        sendAt = m.SendAt,
                        isFromCurrentUser = m.SenderId == userId,
                        isRead = m.IsRead,
                        readTime = m.ReadTime
                    })
                    .ToListAsync();

                // Mark all unread messages received by current user as read
                var unreadMessages = await _context.Message
                    .Where(m => m.SenderId == designerId && m.ReceivedId == userId && !m.IsRead)
                    .ToListAsync();

                if (unreadMessages.Any())
                {
                    foreach (var message in unreadMessages)
                    {
                        message.IsRead = true;
                        message.ReadTime = DateTime.Now;
                    }
                    await _context.SaveChangesAsync();

                    // Notify the sender via SignalR that messages were read
                    await _hubContext.Clients.Group($"User_{designerId}")
                        .SendAsync("MessagesMarkedAsRead", new
                        {
                            readByUserId = userId,
                            readAt = DateTime.Now
                        });
                }

                return Ok(new { messages });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving chat history" });
            }
        }

        [HttpGet("conversations")]
        public async Task<ActionResult> GetConversations()
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                // Get all unique conversations for the current user
                var conversations = await _context.Message
                    .Include(m => m.UserSend)
                    .Include(m => m.UserReceived)
                    .Where(m => m.SenderId == userId || m.ReceivedId == userId)
                    .GroupBy(m => m.SenderId == userId ? m.ReceivedId : m.SenderId)
                    .Select(g => new
                    {
                        partnerId = g.Key,
                        partnerName = g.FirstOrDefault(m => m.SenderId == userId) != null 
                            ? g.FirstOrDefault(m => m.SenderId == userId).UserReceived.Name
                            : g.FirstOrDefault(m => m.ReceivedId == userId).UserSend.Name,
                        lastMessage = g.OrderByDescending(m => m.SendAt).FirstOrDefault().MessageDescription,
                        lastMessageTime = g.OrderByDescending(m => m.SendAt).FirstOrDefault().SendAt,
                        unreadCount = g.Count(m => m.ReceivedId == userId && !m.IsRead) // Count unread messages received by current user
                    })
                    .OrderByDescending(c => c.lastMessageTime)
                    .ToListAsync();

                return Ok(new { conversations });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving conversations" });
            }
        }

        [HttpGet("designers")]
        public async Task<ActionResult> GetDesigners()
        {
            try
            {
                var designers = await _context.User
                    .Where(u => u.Role == "Designer")
                    .Select(d => new
                    {
                        userId = d.UserId,
                        name = d.Name,
                        email = d.Email,
                        imageProfile = d.ImageProfile
                    })
                    .ToListAsync();

                return Ok(new { designers });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving designers" });
            }
        }

        [HttpPost("mark-read/{senderId}")]
        public async Task<ActionResult> MarkMessagesAsRead(string senderId)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                // Mark all unread messages from senderId to current user as read
                var unreadMessages = await _context.Message
                    .Where(m => m.SenderId == senderId && m.ReceivedId == userId && !m.IsRead)
                    .ToListAsync();

                if (unreadMessages.Any())
                {
                    foreach (var message in unreadMessages)
                    {
                        message.IsRead = true;
                        message.ReadTime = DateTime.Now;
                    }
                    await _context.SaveChangesAsync();

                    // Notify the sender via SignalR that messages were read
                    await _hubContext.Clients.Group($"User_{senderId}")
                        .SendAsync("MessagesMarkedAsRead", new
                        {
                            readByUserId = userId,
                            readAt = DateTime.Now,
                            messageCount = unreadMessages.Count
                        });
                }

                return Ok(new 
                { 
                    message = "Messages marked as read",
                    markedCount = unreadMessages.Count
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while marking messages as read" });
            }
        }

        [HttpPost("upload-image")]
        public async Task<ActionResult> UploadImage(IFormFile image)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                if (image == null || image.Length == 0)
                    return BadRequest(new { message = "No image file provided" });

                // Validate file type
                var allowedTypes = new[] { "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp" };
                if (!allowedTypes.Contains(image.ContentType.ToLower()))
                    return BadRequest(new { message = "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed." });

                // Validate file size (max 5MB)
                if (image.Length > 5 * 1024 * 1024)
                    return BadRequest(new { message = "File size must be less than 5MB" });

                // Create directory if it doesn't exist
                var chatImagesPath = Path.Combine("wwwroot", "images", "chat");
                if (!Directory.Exists(chatImagesPath))
                    Directory.CreateDirectory(chatImagesPath);

                // Generate unique filename
                var fileExtension = Path.GetExtension(image.FileName);
                var fileName = $"{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(chatImagesPath, fileName);

                // Save the file
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await image.CopyToAsync(stream);
                }

                // Return the relative URL
                var imageUrl = $"/images/chat/{fileName}";
                return Ok(new { imageUrl = imageUrl });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while uploading the image" });
            }
        }
    }

    public class SendMessageDto
    {
        public string ReceiverId { get; set; } = string.Empty;
        public string MessageText { get; set; } = string.Empty;
    }
} 