using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ArtStep.Data;
using System.Security.Claims;

namespace ArtStep.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FeedbackController : ControllerBase
    {
        private readonly ArtStepDbContext _context;

        public FeedbackController(ArtStepDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<ActionResult> CreateFeedback([FromBody] CreateFeedbackRequest request)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                // Validate input
                if (string.IsNullOrEmpty(request.DesignerReceiveFeedbackId))
                    return BadRequest(new { message = "Designer ID is required" });

                if (string.IsNullOrEmpty(request.OrderId))
                    return BadRequest(new { message = "Order ID is required" });

                if (request.FeedbackStars < 1 || request.FeedbackStars > 5)
                    return BadRequest(new { message = "Rating must be between 1 and 5 stars" });

                if (string.IsNullOrEmpty(request.FeedbackDescription?.Trim()))
                    return BadRequest(new { message = "Feedback description is required" });

                // Check if designer exists
                var designer = await _context.User.FirstOrDefaultAsync(u => u.UserId == request.DesignerReceiveFeedbackId && u.Role == "Designer");
                if (designer == null)
                    return NotFound(new { message = "Designer not found" });

                // Check if order exists and belongs to user
                var order = await _context.Order.FirstOrDefaultAsync(o => o.OrderId == request.OrderId && o.UserId == userId);
                if (order == null)
                    return NotFound(new { message = "Order not found or does not belong to you" });

                // Check if user already gave feedback to this designer for this specific order
                var existingFeedback = await _context.Feedbacks
                    .FirstOrDefaultAsync(f => f.UserSendFeedbackId == userId && 
                                            f.DesignerReceiveFeedbackId == request.DesignerReceiveFeedbackId && 
                                            f.OrderId == request.OrderId);

                if (existingFeedback != null)
                    return BadRequest(new { message = "You have already given feedback to this designer for this order" });

                // Create feedback
                var feedback = new Feedback
                {
                    FeedbackId = Guid.NewGuid().ToString(),
                    FeedbackDescription = request.FeedbackDescription.Trim(),
                    FeedbackStars = request.FeedbackStars,
                    DesignerReceiveFeedbackId = request.DesignerReceiveFeedbackId,
                    UserSendFeedbackId = userId,
                    OrderId = request.OrderId
                };

                _context.Feedbacks.Add(feedback);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Feedback submitted successfully",
                    feedbackId = feedback.FeedbackId
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while submitting feedback", error = ex.Message });
            }
        }

        [HttpGet("designer/{designerId}")]
        [AllowAnonymous]
        public async Task<ActionResult> GetDesignerFeedbacks(string designerId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                if (page < 1) page = 1;
                if (pageSize < 1 || pageSize > 50) pageSize = 10;

                var query = _context.Feedbacks
                    .Include(f => f.UserSend)
                    .Where(f => f.DesignerReceiveFeedbackId == designerId)
                    .OrderByDescending(f => f.FeedbackId);

                var totalCount = await query.CountAsync();
                var feedbacks = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(f => new
                    {
                        feedbackId = f.FeedbackId,
                        feedbackDescription = f.FeedbackDescription,
                        feedbackStars = f.FeedbackStars,
                        userSendName = f.UserSend != null ? f.UserSend.Name : "Anonymous",
                        userSendId = f.UserSendFeedbackId
                    })
                    .ToListAsync();

                // Calculate average rating
                var averageRating = await _context.Feedbacks
                    .Where(f => f.DesignerReceiveFeedbackId == designerId)
                    .AverageAsync(f => (double?)f.FeedbackStars) ?? 0;

                return Ok(new
                {
                    feedbacks = feedbacks,
                    totalCount = totalCount,
                    currentPage = page,
                    pageSize = pageSize,
                    totalPages = (int)Math.Ceiling((double)totalCount / pageSize),
                    averageRating = Math.Round(averageRating, 1)
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving feedbacks", error = ex.Message });
            }
        }

        [HttpGet("my-feedbacks")]
        public async Task<ActionResult> GetMyFeedbacks([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                if (page < 1) page = 1;
                if (pageSize < 1 || pageSize > 50) pageSize = 10;

                var query = _context.Feedbacks
                    .Include(f => f.DesignersReceived)
                    .Where(f => f.UserSendFeedbackId == userId)
                    .OrderByDescending(f => f.FeedbackId);

                var totalCount = await query.CountAsync();
                var feedbacks = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(f => new
                    {
                        feedbackId = f.FeedbackId,
                        feedbackDescription = f.FeedbackDescription,
                        feedbackStars = f.FeedbackStars,
                        designerName = f.DesignersReceived != null ? f.DesignersReceived.Name : "Unknown Designer",
                        designerId = f.DesignerReceiveFeedbackId
                    })
                    .ToListAsync();

                return Ok(new
                {
                    feedbacks = feedbacks,
                    totalCount = totalCount,
                    currentPage = page,
                    pageSize = pageSize,
                    totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving your feedbacks", error = ex.Message });
            }
        }

        [HttpGet("order/{orderId}/designers")]
        public async Task<ActionResult> GetOrderDesigners(string orderId)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                // Get designers from the order
                var designers = await _context.OrderDetail
                    .Include(od => od.Order)
                    .Include(od => od.ShoeCustom)
                    .ThenInclude(sc => sc.Designer)
                    .Where(od => od.OrderId == orderId && od.Order.UserId == userId)
                    .Where(od => od.ShoeCustom != null && od.ShoeCustom.Designer != null)
                    .Select(od => new
                    {
                        designerId = od.ShoeCustom.Designer.UserId,
                        designerName = od.ShoeCustom.Designer.Name,
                        shoeName = od.ShoeCustom.ShoeName
                    })
                    .Distinct()
                    .ToListAsync();

                return Ok(new { designers = designers });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving order designers", error = ex.Message });
            }
        }
    }

    // Request models
    public class CreateFeedbackRequest
    {
        public string? FeedbackDescription { get; set; }
        public int FeedbackStars { get; set; }
        public string? DesignerReceiveFeedbackId { get; set; }
        public string? OrderId { get; set; }
    }
} 