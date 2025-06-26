using ArtStep.Data;
using ArtStep.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Validations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;
// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace ArtStep.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DesignerController : ControllerBase
    {
        private readonly ArtStepDbContext _context;

        public DesignerController(ArtStepDbContext context)
        {
            _context = context;
        }

        // GET: api/<DesignerController>
        [HttpGet]
        [Authorize]
        public async Task<ActionResult<ShoeCustomDTO>> GetAllDesignAsync()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new { message = "Token không hợp lệ hoặc đã hết hạn." });
            }

            var userId = userIdClaim.Value;
            var listShoe = await _context.ShoeCustom
            .AsNoTracking() // Improve performance for read-only operations
            .Include(sc => sc.Designer)
            .Include(sc => sc.Category)
            .Include(sc => sc.Images)
            .Where(sc => sc.Designer.UserId == userId)
            .Select(sc => new ShoeCustomDTO
            {
                ShoeId = sc.ShoeId,
                ShoeName = sc.ShoeName,
                ShoeDescription = sc.ShoeDescription,
                Quantity = sc.Quantity,
                PriceAShoe = sc.PriceAShoe,
                IsHidden = sc.IsHidden,
                Category = new CategoryDTO
                {
                    CategoryId = sc.Category.CategoryId,
                    CategoryName = sc.Category.CategoryName
                },
                ShoeImages = sc.Images.Select(i => new ShoeImageDTO
                {
                    ImageId = i.ImageId,
                    ImageLink = i.ImageLink
                }).ToList() // Sort thumbnails first
            }).ToListAsync();

            if (listShoe == null)
            {
                return NotFound();
            }
            return Ok(listShoe);
        }

        [HttpGet("view_revenue")]
        [Authorize]
        public async Task<ActionResult<OrderRevenueResponseDTO>> GetAllSalesData([FromQuery] DateTime? startDate = null,
    [FromQuery] DateTime? endDate = null)
        {
            try
            {
                var designerIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
                if (designerIdClaim == null || string.IsNullOrEmpty(designerIdClaim.Value))
                {
                    return Unauthorized(new { message = "Invalid or expired token" });
                }

                var designerId = designerIdClaim.Value;

                // Set default date range if not provided
                endDate ??= DateTime.UtcNow;
                startDate ??= endDate.Value.AddMonths(-1); // Default to last 30 days

                // Validate date range
                if (startDate > endDate)
                {
                    return BadRequest("Start date cannot be after end date");
                }




                var revenueData = await _context.OrderDetail
                    .Include(od => od.ShoeCustom)
                        .ThenInclude(s => s.Designer)
                    .Include(od => od.Order)
                    .Where(od =>od.ShoeCustom.Designer.UserId == designerId &&
                od.Order.Status == "Completed" &&
                od.Order.CreateAt >= startDate &&
                od.Order.CreateAt <= endDate)
                    .Select(od => new OrderRevenueResponseDTO
                    {
                        ShoeName = od.ShoeCustom.ShoeName,
                        Quantity = od.QuantityBuy,
                        PriceAShoe = od.CostaShoe,
                        dateTime=od.Order.CreateAt
                    }).OrderByDescending(x => x.dateTime)
                    .ToListAsync();

                return Ok(revenueData);
            }
            catch (Exception ex)
            {
                // Consider logging the exception (ex) here for debugging
                return StatusCode(500, new { Message = "An error occurred while retrieving sales data" });
            }
        }

        [HttpPut("update")]
        [Authorize]
        public async Task<IActionResult> UpdateDesign([FromBody] EditDesignRequestDTO updateDto)
        {
            try
            {
                var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
                if (userIdClaim == null)
                {
                    return Unauthorized(new { message = "Token không hợp lệ hoặc đã hết hạn." });
                }

                var userId = userIdClaim.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { Message = "Invalid token" });
                }

                // 2. Tìm kiếm thiết kế
                var design = await _context.ShoeCustom
                     .Include(sc => sc.Designer)
                     .Include(sc => sc.Category)
                    .Include(sc => sc.Images).FirstOrDefaultAsync(s => s.ShoeId == updateDto.ShoeId && s.Designer.UserId == userId);

                if (design == null)
                {
                    return NotFound(new { Message = "Design not found or you don't have permission" });
                }

                // 3. Cập nhật thông tin cơ bản
                design.ShoeName = updateDto.ShoeName;
                design.ShoeDescription = updateDto.ShoeDescription;
                design.PriceAShoe = updateDto.PriceAShoe;
                design.Quantity = updateDto.Quantity;
                // 4. Cập nhật category
                var category = await _context.Categories.FindAsync(updateDto.CategoryId);

                if (category == null)
                {
                    return BadRequest(new { Message = "Invalid category" });
                }
                design.Category = category;

                // 5. Xử lý hình ảnh (đã bỏ IsMain)
                await ProcessShoeImages(design, updateDto.ShoeImages);

                // 6. Lưu thay đổi
                await _context.SaveChangesAsync();

                // 7. Trả về kết quả
                var result = new
                {
                    design.ShoeId,
                    design.ShoeName,
                    design.ShoeDescription,
                    design.PriceAShoe,
                    design.Quantity,
                    Category = new { design.Category.CategoryId, design.Category.CategoryName },
                    ShoeImages = design.Images.Select(i => new { i.ImageId, i.ImageLink })
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "An error occurred while updating the design" });
            }
        }

        // DELETE api/<DesignerController>/5
        [HttpPatch("{ShoeId}")]
        [Authorize]
        public async Task<IActionResult> HideDesign(string ShoeId)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new { message = "Token không hợp lệ hoặc đã hết hạn." });
            }

            var userId = userIdClaim.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { Message = "Invalid token" });
            }

            // 2. Tìm kiếm thiết kế của người dùng
            var design = await _context.ShoeCustom
                .Include(s => s.Designer)
                .FirstOrDefaultAsync(s => s.ShoeId == ShoeId && s.Designer.UserId == userId);

            if (design == null)
            {
                return NotFound(new { Message = "Design not found or you don't have permission" });
            }

            // 3. Ẩn thiết kế
            design.IsHidden = 1;

            // 4. Lưu thay đổi
            await _context.SaveChangesAsync();

            // 5. Trả về kết quả
            return Ok(new { Message = "Design has been hidden successfully" });
        }


        [HttpPost("Create_Design")]
        [Authorize]
        public async Task<IActionResult> CreateDesign([FromBody] CreateDesignRequestDTO model)
        {



            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new { message = "Token không hợp lệ hoặc đã hết hạn." });
            }

            var userId = userIdClaim.Value;

            // 1. Xác thực người dùng (giả lập userId)
            // var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            // userId = "user002";
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { Message = "Invalid token" });
            }

            // 2. Tìm designer trong database (giả sử Designer có UserId)
            var designer = await _context.User.FirstOrDefaultAsync(d => d.UserId == userId);
            if (designer == null)
            {
                return BadRequest(new { Message = "Designer not found" });
            }

            // 3. Tạo design mới
            var newDesign = new ShoeCustom
            {
                ShoeId = Guid.NewGuid().ToString(), // hoặc tuỳ thuộc key của bạn
                ShoeName = model.ShoeName,
                ShoeDescription = model.ShoeDescription,
                CategoryId = model.CategoryId,
                PriceAShoe = model.PriceAShoe,
                Quantity = model.Quantity,
                IsHidden = 0,
                Designer = designer,
                // Nếu bạn có ảnh base64 thì lưu vào trường tương ứng ở đây
                Images = model.Images.Select(base64 => new ShoeImage
                {
                    ImageId = Guid.NewGuid().ToString(),
                    ImageLink = base64,
                }).ToList(),
            };

            // 4. Thêm vào db context và lưu
            _context.ShoeCustom.Add(newDesign);
            await _context.SaveChangesAsync();
            var response = new ShoeCustomDTO
            {
                ShoeName = newDesign.ShoeName,
                ShoeDescription = newDesign.ShoeDescription,
                CategoryId = newDesign.CategoryId,
                PriceAShoe = newDesign.PriceAShoe,
                Quantity = newDesign.Quantity,
            };
            // 5. Trả về kết quả
            return Ok(response);
        }

        private async Task ProcessShoeImages(ShoeCustom design, List<ShoeImageDTO> updateImages)
        {
            //// 1. Xóa ảnh không còn tồn tại
            //var existingImages = design.Images.ToList();
            //foreach (var existingImg in existingImages)
            //{
            //    var updateImg = updateImages.FirstOrDefault(i => i.ImageId == existingImg.ImageId);
            //    Console.WriteLine(updateImg.ImageId);
            //    if (updateImg != null && existingImg.ImageLink != updateImg.ImageLink)
            //    {
            //        existingImg.ImageLink = updateImg.ImageLink;
            //    }
            //}
            design.Images.Clear();

            var image = _context.ShoeImages.Where(s => s.ShoeCustomId == null).ToList();
            image.Clear();
            // 2. Thêm ảnh mới
            foreach (var imgDto in updateImages)
            {
                // Lưu trực tiếp base64 vào database
                design.Images.Add(new ShoeImage
                {

                    ImageId = Guid.NewGuid().ToString(),
                    ImageLink = imgDto.ImageLink, // Lưu base64
                    ShoeCustomId = design.ShoeId,
                });
            }
        }
        // GET api/<DesignerController>/5
        [HttpGet("{DesignerId}")]
        [Authorize]
        public async Task<ActionResult<ShoeCustomDTO>> GetDesignById(string DesignerId)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new { message = "Token không hợp lệ hoặc đã hết hạn." });
            }
            var userId = userIdClaim.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { Message = "Invalid token" });
            }
            var design = await _context.ShoeCustom
                .AsNoTracking()
                .Include(sc => sc.Designer)
                .Include(sc => sc.Category)
                .Include(sc => sc.Images)
                .FirstOrDefaultAsync(s => s.ShoeId == DesignerId && s.Designer.UserId == userId);
            if (design == null)
            {
                return NotFound();
            }
            var designDto = new ShoeCustomDTO
            {
                ShoeId = design.ShoeId,
                ShoeName = design.ShoeName,
                ShoeDescription = design.ShoeDescription,
                Quantity = design.Quantity,
                PriceAShoe = design.PriceAShoe,
                IsHidden = design.IsHidden,
                Category = new CategoryDTO
                {
                    CategoryId = design.Category.CategoryId,
                    CategoryName = design.Category.CategoryName
                },
                ShoeImages = design.Images.Select(i => new ShoeImageDTO
                {
                    ImageId = i.ImageId,
                    ImageLink = i.ImageLink
                }).ToList()
            };
            return Ok(designDto);
        }


        //GET api/DesignerController
        [HttpGet("get_all_designs")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<DesignerDTO>>> GetAllDesigners()
        {
            try
            {
                var designers = await _context.User
                                .Where(u => u.Role == "Designer")
                                .Select(u => new
                                {
                                    UserId = u.UserId,
                                    Name = u.Name,
                                    isActive = u.isActive,
                                    AverageFeedbackStars = _context.Feedbacks
                                        .Where(f => f.DesignerReceiveFeedbackId == u.UserId)
                                        .Average(f => (double?)f.FeedbackStars) ?? 0
                                })
                                .ToListAsync();
                return Ok(designers);

            }
            catch (Exception)
            {
                return StatusCode(500, new { Message = "An error occurred while retrieving designers" });
            }
        }

        // Put api/DesignerController/update_designer_status
        [HttpPut("update_designer_status")]
        [Authorize]
        public async Task<IActionResult> UpdateDesignerStatus([FromBody] DesignerDTO request)
        {
            try
            {
                var designer = await _context.User.FindAsync(request.UserId);
                if (designer == null)
                {
                    return NotFound(new { Message = "Designer not found" });
                }
                designer.isActive = request.isActive;
                _context.User.Update(designer);
                await _context.SaveChangesAsync();
                return Ok(new { Message = "Designer status updated successfully" });
            }
            catch (Exception)
            {
                return StatusCode(500, new { Message = "An error occurred while updating designer status" });
            }
        }



        [HttpGet("designer_detail/{designerId}")]
        public async Task<ActionResult<DesignerResponseDTO>> GetDesignerAndFeedbackById(string designerId)
        {
            try
            {
                var designer = await _context.User
                    .AsNoTracking()
                    .Include(u => u.ShoeCustoms)
                        .ThenInclude(sc => sc.Images)
                    .Include(u => u.ReceivedFeedbacks)
                        .ThenInclude(fb => fb.UserSend)
                    .FirstOrDefaultAsync(u => u.UserId == designerId);

                if (designer == null)
                {
                    return NotFound(new { Message = "Designer not found" });
                }

                // Calculate average rating
                double averageRating = (double)(designer.ReceivedFeedbacks.Any()
                        ? designer.ReceivedFeedbacks.Average(f => f.FeedbackStars)
                            : 0);

                var feedbackList = designer.ReceivedFeedbacks?
                   .Select(fb => new FeedbackDTO
                   {
                       FeedbackId = fb.FeedbackId,
                       FeedbackDescription = fb.FeedbackDescription ?? string.Empty,
                       FeedbackStars = (int)fb.FeedbackStars,
                       User = fb.UserSend != null ? new UserDTO
                       {
                           UserId = fb.UserSend.UserId ?? string.Empty,
                           UserName = fb.UserSend.Name ?? "Không xác định",
                           Avatar = fb.UserSend.ImageProfile ?? string.Empty
                       } : new UserDTO()
                   }).ToList();

                var shoeCustomList = designer.ShoeCustoms?
                    .Select(shoe => new ShoeCustomDTO
                    {
                        ShoeId = shoe.ShoeId,
                        ShoeName = shoe.ShoeName,
                        PriceAShoe = shoe.PriceAShoe,
                        ShoeImages = shoe.Images?
                            .Select(img => new ShoeImageDTO
                            {
                                ImageId = img.ImageId,
                                ImageLink = img.ImageLink
                            }).ToList() ?? new List<ShoeImageDTO>()
                    }).ToList() ?? new List<ShoeCustomDTO>();

                var response = new DesignerResponseDTO
                {
                    DesignerId = designer.UserId,
                    DesignerName = designer.Name,
                    Email = designer.Email,
                    Phone = designer.PhoneNo,
                    AvatarImage = designer.ImageProfile,
                    AverageRating = Math.Round(averageRating, 1),
                    FeedBackList = feedbackList,
                    ShoeCustomList = shoeCustomList
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    Message = "An error occurred while processing your request.",
                    Error = ex.Message
                });
            }
        }

        // GET: api/Designer/public
        [HttpGet("public")]
        public async Task<ActionResult<List<DesignerPublicDTO>>> GetAllDesignersPublic()
        {
            try
            {
                var designers = await _context.User
                    .AsNoTracking()
                    .Where(u => u.Role == "designer" && u.isActive != 0)
                    .Select(d => new DesignerPublicDTO
                    {
                        UserId = d.UserId,
                        Name = d.Name,
                        ImageProfile = d.ImageProfile,
                        TotalDesigns = d.ShoeCustoms != null ? d.ShoeCustoms.Count(sc => sc.IsHidden == 0) : 0
                    })
                    .ToListAsync();

                return Ok(designers);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "An error occurred while retrieving designers" });
            }
        }


        [HttpGet("designer_feedback")]
        [Authorize]
        public async Task<ActionResult<List<FeedbackDTO>>> GetAllFeedBackForADesigner([FromQuery] int? rating)
        {
            var designerIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (designerIdClaim == null)
            {
                return Unauthorized(new { message = "Token không hợp lệ hoặc đã hết hạn." });
            }

            var designerId = designerIdClaim.Value;

            var query = _context.Feedbacks
             .Include(fb => fb.UserSend)
             .Where(fb => fb.DesignerReceiveFeedbackId == designerId);


            if (rating.HasValue)
            {
                query = query.Where(fb => fb.FeedbackStars == rating.Value);
            }

            var feedbackList = await query.ToListAsync();



            var feedbackDTOs = feedbackList.Select(fb => new FeedbackDTO
            {
                FeedbackId = fb.FeedbackId,
                FeedbackDescription = fb.FeedbackDescription,
                FeedbackStars = (int)fb.FeedbackStars,
                User = new UserDTO
                {
                    UserName = fb.UserSend.Name,
                    Avatar = fb.UserSend.ImageProfile
                }
            }).ToList();

            return Ok(feedbackDTOs);
        }
    }
}