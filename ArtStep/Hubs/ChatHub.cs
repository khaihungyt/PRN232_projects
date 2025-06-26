using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace ArtStep.Hubs
{
    //[Authorize] 
    public class ChatHub : Hub
    {
        public async Task JoinUserGroup(string userId)
        {
            try
            {
                Console.WriteLine($"ChatHub: JoinUserGroup called for user {userId}");
                await Groups.AddToGroupAsync(Context.ConnectionId, $"User_{userId}");

                // Send confirmation back to client
                await Clients.Caller.SendAsync("JoinedGroup", $"User_{userId}");
                Console.WriteLine($"ChatHub: User {userId} successfully joined group");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatHub: Error joining group for user {userId}: {ex.Message}");
                await Clients.Caller.SendAsync("Error", "Failed to join user group");
            }
        }

        public async Task LeaveUserGroup(string userId)
        {
            try
            {
                Console.WriteLine($"ChatHub: LeaveUserGroup called for user {userId}");
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"User_{userId}");
                Console.WriteLine($"ChatHub: User {userId} successfully left group");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatHub: Error leaving group for user {userId}: {ex.Message}");
            }
        }

        public async Task SendMessage(string receiverId, string message)
        {
            try
            {
                Console.WriteLine($"ChatHub: SendMessage called - receiverId: {receiverId}, message: {message}");

                var senderId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var senderName = Context.User?.FindFirst(ClaimTypes.Name)?.Value;

                if (string.IsNullOrEmpty(senderId))
                {
                    Console.WriteLine("ChatHub: SenderId is null or empty");
                    await Clients.Caller.SendAsync("Error", "Authentication required");
                    return;
                }

                if (string.IsNullOrEmpty(receiverId))
                {
                    Console.WriteLine("ChatHub: ReceiverId is null or empty");
                    await Clients.Caller.SendAsync("Error", "Receiver ID is required");
                    return;
                }

                if (string.IsNullOrEmpty(message))
                {
                    Console.WriteLine("ChatHub: Message is null or empty");
                    await Clients.Caller.SendAsync("Error", "Message cannot be empty");
                    return;
                }

                var messageData = new
                {
                    senderId = senderId,
                    senderName = senderName,
                    message = message,
                    timestamp = DateTime.UtcNow
                };

                // Send message to the receiver's group
                await Clients.Group($"User_{receiverId}").SendAsync("ReceiveMessage", messageData);
                Console.WriteLine($"ChatHub: Message sent to User_{receiverId} group");

                // Send confirmation back to sender
                await Clients.Caller.SendAsync("MessageSent", new
                {
                    receiverId = receiverId,
                    message = message,
                    timestamp = DateTime.UtcNow
                });

                Console.WriteLine($"ChatHub: Message confirmation sent to sender {senderId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatHub: Error sending message: {ex.Message}");
                await Clients.Caller.SendAsync("Error", "Failed to send message");
            }
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                Console.WriteLine($"ChatHub: Client connected - ConnectionId: {Context.ConnectionId}");
                Console.WriteLine($"ChatHub: User claims: {string.Join(", ", Context.User?.Claims?.Select(c => $"{c.Type}:{c.Value}") ?? new string[0])}");

                var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var userName = Context.User?.FindFirst(ClaimTypes.Name)?.Value;

                if (!string.IsNullOrEmpty(userId))
                {
                    Console.WriteLine($"ChatHub: Adding user {userId} ({userName}) to group");
                    await Groups.AddToGroupAsync(Context.ConnectionId, $"User_{userId}");

                    // Notify client of successful connection
                    await Clients.Caller.SendAsync("Connected", new
                    {
                        userId = userId,
                        userName = userName,
                        connectionId = Context.ConnectionId
                    });
                }
                else
                {
                    Console.WriteLine("ChatHub: No userId found in claims - authentication may have failed");
                    await Clients.Caller.SendAsync("Error", "Authentication failed");
                }

                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatHub: Error in OnConnectedAsync: {ex.Message}");
                await Clients.Caller.SendAsync("Error", "Connection failed");
            }
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            try
            {
                Console.WriteLine($"ChatHub: Client disconnected - ConnectionId: {Context.ConnectionId}");
                if (exception != null)
                {
                    Console.WriteLine($"ChatHub: Disconnection reason: {exception.Message}");
                }

                var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(userId))
                {
                    Console.WriteLine($"ChatHub: Removing user {userId} from group");
                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"User_{userId}");
                }

                await base.OnDisconnectedAsync(exception);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatHub: Error in OnDisconnectedAsync: {ex.Message}");
            }
        }

        public async Task MarkMessagesAsRead(string senderId)
        {
            try
            {
                Console.WriteLine($"ChatHub: MarkMessagesAsRead called - senderId: {senderId}");

                var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    Console.WriteLine("ChatHub: UserId is null or empty");
                    await Clients.Caller.SendAsync("Error", "Authentication required");
                    return;
                }

                if (string.IsNullOrEmpty(senderId))
                {
                    Console.WriteLine("ChatHub: SenderId is null or empty");
                    await Clients.Caller.SendAsync("Error", "Sender ID is required");
                    return;
                }

                // Notify the sender that their messages have been read
                await Clients.Group($"User_{senderId}").SendAsync("MessagesMarkedAsRead", new
                {
                    readByUserId = userId,
                    readAt = DateTime.UtcNow
                });

                // Confirm to the current user that messages were marked as read
                await Clients.Caller.SendAsync("MessagesReadConfirmation", new
                {
                    senderId = senderId,
                    readAt = DateTime.UtcNow
                });

                Console.WriteLine($"ChatHub: Messages marked as read for conversation between {userId} and {senderId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatHub: Error marking messages as read: {ex.Message}");
                await Clients.Caller.SendAsync("Error", "Failed to mark messages as read");
            }
        }

        // Test method to verify hub is working
        public async Task TestConnection()
        {
            try
            {
                var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var userName = Context.User?.FindFirst(ClaimTypes.Name)?.Value;

                await Clients.Caller.SendAsync("TestResponse", new
                {
                    message = "Hub is working!",
                    userId = userId,
                    userName = userName,
                    connectionId = Context.ConnectionId,
                    timestamp = DateTime.UtcNow
                });

                Console.WriteLine($"ChatHub: Test connection successful for user {userId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatHub: Test connection failed: {ex.Message}");
                await Clients.Caller.SendAsync("Error", "Test failed");
            }
        }
    }
}