using ArtStep.Data;
using ArtStep.DTO;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Mail;
using System.Net;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using CloudinaryDotNet.Actions;
using CloudinaryDotNet;
using System.Text.RegularExpressions;
using Google.Apis.Auth;
using Azure.Core;
using System.Text.Json;
using System.Net.Http;

namespace ArtStep.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly IMemoryCache _memoryCache;
        private readonly ArtStepDbContext _context;
        private readonly Cloudinary _cloudinary;
        public AuthController(IConfiguration configuration, ArtStepDbContext context, IMemoryCache memoryCache, Cloudinary cloudinary)
        {
            _memoryCache = memoryCache;
            _configuration = configuration;
            _context = context;
            _cloudinary = cloudinary;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestCustom request)
        {
            var userAccount = _context.Accounts
                                    .Include(a => a.User)
                                    .FirstOrDefault(a => a.UserName == request.UserName && a.Password == request.Password);

            if (userAccount == null || userAccount.User == null)
            {
                return Unauthorized(new { message = "Tài khoản hoặc mật khẩu không đúng. Xin vui lòng thử lại !" });
            }

            var token = GenerateJwtToken(userAccount.User!);

            var userInfo = new
            {
                userAccount.User.UserId,
                userAccount.User.Name,
                userAccount.User.Email,
                userAccount.User.Role,
                userAccount.User.ImageProfile,
            };

            return Ok(new
            {
                token = token,
                user = userInfo
            });
        }

        [HttpGet("login-google")]
        public async Task<IActionResult> LoginGoogleCallback([FromQuery] string code)
        {
            if (string.IsNullOrEmpty(code))
                return BadRequest(new { message = "Thiếu mã xác thực (code)" });

            var clientId = _configuration["GoogleAuth:ClientId"];
            var clientSecret = _configuration["GoogleAuth:ClientSecret"];
            // Sửa cái này khi deploy
            var redirectUri = "http://localhost:5155/login-callback.html";
            var httpClient = new HttpClient();

            var tokenRequest = new HttpRequestMessage(System.Net.Http.HttpMethod.Post, "https://oauth2.googleapis.com/token");
            tokenRequest.Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "code", code },
                { "client_id", clientId },
                { "client_secret", clientSecret },
                { "redirect_uri", redirectUri },
                { "grant_type", "authorization_code" }
            });

            var tokenResponse = await httpClient.SendAsync(tokenRequest);
            if (!tokenResponse.IsSuccessStatusCode)
                return StatusCode((int)tokenResponse.StatusCode, "Không lấy được token từ Google");

            var tokenContent = await tokenResponse.Content.ReadAsStringAsync();

            JsonElement tokenData;
            try
            {
                tokenData = JsonSerializer.Deserialize<JsonElement>(tokenContent);
            }
            catch
            {
                return BadRequest(new { message = "Lỗi khi phân tích token từ Google" });
            }

            if (!tokenData.TryGetProperty("id_token", out JsonElement idTokenElement))
                return BadRequest(new { message = "Không có id_token trong phản hồi từ Google" });

            var idToken = idTokenElement.GetString();

            GoogleJsonWebSignature.Payload validPayload;
            try
            {
                validPayload = await GoogleJsonWebSignature.ValidateAsync(idToken);
            }
            catch
            {
                return Unauthorized(new { message = "idToken không hợp lệ hoặc đã hết hạn." });
            }

            var user = _context.User.FirstOrDefault(u => u.Email == validPayload.Email);
            if (user == null)
            {
                user = new User
                {
                    UserId = Guid.NewGuid().ToString(),
                    Name = validPayload.Name,
                    Email = validPayload.Email,
                    ImageProfile = validPayload.Picture,
                    Role = "user",
                    isActive = 1,
                };

                _context.User.Add(user);
                await _context.SaveChangesAsync();
            }

            var jwtToken = GenerateJwtToken(user);

            var userInfo = new
            {
                user.UserId,
                user.Name,
                user.Email,
                user.Role,
                user.ImageProfile,
                LoginProvider = "Google"
            };

            return Ok(new
            {
                token = jwtToken,
                user = userInfo
            });
        }


        [HttpPost("register")]
        public async Task<IActionResult> RegisterFromUser([FromForm] RegisterRequestCustom request)
        {
            try
            {
                if (_context.Accounts.Any(a => a.UserName == request.UserName))
                    return BadRequest(new { message = "Tên đăng nhập đã tồn tại" });

                string? imageUrl = null;

                if (!string.IsNullOrWhiteSpace(request.Avatar))
                {
                    try
                    {
                        var base64Data = Regex.Match(request.Avatar, @"data:image/(?<type>.+?);base64,(?<data>.+)").Groups;
                        var imageType = base64Data["type"].Value;
                        var base64String = base64Data["data"].Value;

                        var allowedTypes = new[] { "jpeg", "jpg", "png", "gif" };
                        if (!allowedTypes.Contains(imageType.ToLower()))
                            return BadRequest(new { message = "Định dạng ảnh không hợp lệ. Chỉ JPG, PNG, GIF." });

                        byte[] imageBytes = Convert.FromBase64String(base64String);
                        if (imageBytes.Length > 800 * 1024)
                            return BadRequest(new { message = "Kích thước ảnh quá lớn. Tối đa 800KB." });

                        imageUrl = request.Avatar;
                    }
                    catch
                    {
                        return BadRequest(new { message = "Ảnh không hợp lệ hoặc bị lỗi khi xử lý." });
                    }
                }

                var newUserId = Guid.NewGuid().ToString();

                var user = new User
                {
                    UserId = newUserId,
                    Name = request.Name,
                    Email = request.Email,
                    PhoneNo = request.PhoneNo,
                    Role = request.Role.ToLower(),
                    isActive = 1,
                    ImageProfile = imageUrl
                };
                _context.User.Add(user);

                // Tạo Account
                var account = new Data.Account
                {
                    AccountId = Guid.NewGuid().ToString(),
                    UserName = request.UserName,
                    Password = request.Password,
                    UserId = newUserId,
                    isStatus = 1
                };
                _context.Accounts.Add(account);

                await _context.SaveChangesAsync();

                return Ok(new { message = "Đăng ký thành công!" });
            }
            catch (Exception e)
            {
                return BadRequest(new { message = "Lỗi: " + e.Message });
            }
        }

        private string GenerateJwtToken(User user)
        {
            var securityKey = new SymmetricSecurityKey(Convert.FromBase64String(_configuration["Jwt:Key"]));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.Name, user.Name ?? user.Email ?? "Unknown"),
                new Claim(ClaimTypes.NameIdentifier, user.UserId ?? ""),
                new Claim(ClaimTypes.Role, user.Role ?? "User")
            };
            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(0.5),
                signingCredentials: credentials
            );
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        [HttpGet("forgot")]
        public async Task<IActionResult> ForgotPassword(string email)
        {
            var user = await _context.User.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
                return NotFound(new { message = "Email không tồn tại" });

            string code = new Random().Next(100000, 999999).ToString();

            bool sent = await SendVerificationCodeAsync(email, code);
            if (!sent)
                return StatusCode(500, new { message = "Không thể gửi mã xác nhận" });

            _memoryCache.Set($"reset_{email}", code, TimeSpan.FromMinutes(10));

            return Ok(new { message = "Đã gửi mã xác nhận đến email" });
        }

        [HttpPost("reset")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            var user = await _context.User.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null)
                return NotFound(new { message = "Email không tồn tại" });

            if (!_memoryCache.TryGetValue($"reset_{request.Email}", out string? cachedCode) || cachedCode != request.ResetCode)
            {
                return BadRequest(new { message = "Mã xác nhận không đúng hoặc đã hết hạn" });
            }

            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.UserId == user.UserId);
            if (account == null)
                return NotFound(new { message = "Tài khoản không tồn tại" });

            account.Password = request.NewPassword;
            _context.Accounts.Update(account);
            await _context.SaveChangesAsync();

            _memoryCache.Remove($"reset_{request.Email}");

            return Ok(new { message = "Mật khẩu đã được đặt lại thành công" });
        }

        // Send verification code to email
        private async Task<bool> SendVerificationCodeAsync(string toEmail, string code)
        {
            var fromEmail = "duyv63718@gmail.com";
            var fromAddress = new MailAddress(fromEmail, "ArtStep Support");
            var fromPassword = "ixcd mvvb usrn upqj";
            var subject = "Mã xác nhận đặt lại mật khẩu ArtStep";
            var body = $"Mã xác nhận của bạn là: {code}";

            var smtpClient = new SmtpClient("smtp.gmail.com")
            {
                Port = 587,
                Credentials = new NetworkCredential(fromEmail, fromPassword),
                EnableSsl = true,
            };
            var mail = new MailMessage
            {
                From = fromAddress,
                Subject = subject,
                Body = body,
                IsBodyHtml = false
            };
            mail.To.Add(toEmail);
            try
            {
                await smtpClient.SendMailAsync(mail);
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);
                return false;
            }
        }

    }
}

