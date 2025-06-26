using ArtStep.Data;
using ArtStep.DTO;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace ArtStep.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProfileController : ControllerBase
    {
        private readonly ArtStepDbContext _context;
        private readonly Cloudinary _cloudinary;

        public ProfileController(ArtStepDbContext context, Cloudinary cloudinary)
        {
            _context = context;
            _cloudinary = cloudinary;
        }


        [Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new { message = "Token không hợp lệ hoặc đã hết hạn." });
            }

            var userId = userIdClaim.Value;

            var user = await _context.User
                .Where(u => u.UserId == userId)
                .Select(u => new
                {
                    u.UserId,
                    u.Name,
                    u.Email,
                    u.PhoneNo,
                    u.Role,
                    u.ImageProfile,
                    isActive = u.isActive == 1
                })
                .FirstOrDefaultAsync();

            if (user == null)
            {
                return NotFound(new { message = "Người dùng không tồn tại." });
            }

            return Ok(user);
        }

        [HttpPost("UpdateProfile")]
        public async Task<IActionResult> UpdateProfile([FromForm] UpdateProfileDTO request)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new { message = "Token không hợp lệ hoặc đã hết hạn." });
            }
            var userId = userIdClaim.Value;

            var user = await _context.User.FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null)
            {
                return NotFound(new { message = "Không tìm thấy người dùng." });
            }

            if (!string.IsNullOrWhiteSpace(request.Avatar))
            {
                try
                {
                    var base64Data = Regex.Match(request.Avatar, @"data:image/(?<type>.+?);base64,(?<data>.+)").Groups;
                    var imageType = base64Data["type"].Value;
                    var base64String = base64Data["data"].Value;

                    var allowedTypes = new[] { "jpeg", "jpg", "png", "gif" };
                    if (!allowedTypes.Contains(imageType.ToLower()))
                    {
                        return BadRequest(new { message = "Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, GIF, PNG." });
                    }

                    byte[] imageBytes = Convert.FromBase64String(base64String);
                    if (imageBytes.Length > 800 * 1024)
                    {
                        return BadRequest(new { message = "Kích thước ảnh quá lớn. Tối đa 800KB." });
                    }

                    user.ImageProfile = request.Avatar;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Error decoding base64 image: {ex.Message}");
                    return BadRequest(new { message = "Ảnh không hợp lệ hoặc bị lỗi khi xử lý." });
                }
            }

            user.Name = request.Name?.Trim() ?? user.Name;
            user.Email = request.Email?.Trim() ?? user.Email;
            user.PhoneNo = request.PhoneNo?.Trim() ?? user.PhoneNo;

            try
            {
                _context.User.Update(user);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Cập nhật thông tin thành công!" });
            }
            catch
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Lỗi khi cập nhật database." });
            }
        }


        [HttpPost("ChangePassword")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {

            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new { message = "Token không hợp lệ hoặc đã hết hạn." });
            }

            var userId = userIdClaim.Value;
            var account = await _context.Accounts
                .FirstOrDefaultAsync(a => a.User.UserId == userId);

            if (account == null)
            {
                return NotFound(new { message = "Không tìm thấy tài khoản." });
            }

            if (account.Password != request.CurrentPassword)
            {
                return BadRequest(new { message = "Mật khẩu cũ không đúng." });
            }

            account.Password = request.NewPassword;

            try
            {
                _context.Accounts.Update(account);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Đổi mật khẩu thành công!" });
            }
            catch
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "Lỗi khi cập nhật database." });
            }
        }

    }
}
