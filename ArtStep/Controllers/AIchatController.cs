using ALLimage_API.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace ALLimage_API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AIchatController : Controller
    {
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient; // Khuyến nghị sử dụng HttpClientFactory trong ứng dụng thực tế

        public AIchatController(IConfiguration configuration, ILogger<AIchatController> logger, HttpClient httpClient)
        {
            _configuration = configuration;
            _httpClient = httpClient; // HttpClient được inject
        }
        [HttpPost("generate")]
        [Authorize]
        public async Task<IActionResult> GenerateText([FromBody] TextGenerateRequest request)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new { message = "Token không hợp lệ hoặc đã hết hạn." });
            }
            if (string.IsNullOrEmpty(request.Prompt))
            {
                return BadRequest(new TextGenerateResponse
                {
                    Success = false,
                    ErrorMessage = "Prompt cannot be empty."
                });
            }

            var geminiApiKey = _configuration["OpenAI:ApiKey2"];

            if (string.IsNullOrEmpty(geminiApiKey))
            {
                return StatusCode(500, new TextGenerateResponse
                {
                    Success = false,
                    ErrorMessage = "Server configuration error: Gemini API Key is missing."
                });
            }

            try
            {
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={geminiApiKey}";

                var requestBody = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new[]
                            {
                                new { text = request.Prompt }
                            }
                        }
                    }
                };

                var jsonContent = JsonSerializer.Serialize(requestBody);
                var httpContent = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");
                var httpResponse = await _httpClient.PostAsync(url, httpContent);
                httpResponse.EnsureSuccessStatusCode();

                var responseString = await httpResponse.Content.ReadAsStringAsync();

                using (var jsonDoc = JsonDocument.Parse(responseString))
                {
                    var candidates = jsonDoc.RootElement.GetProperty("candidates");
                    if (candidates.GetArrayLength() > 0)
                    {
                        var firstCandidate = candidates[0];
                        var content = firstCandidate.GetProperty("content");
                        var parts = content.GetProperty("parts");
                        if (parts.GetArrayLength() > 0)
                        {
                            var firstPart = parts[0];
                            if (firstPart.TryGetProperty("text", out var textElement))
                            {
                                return Ok(new TextGenerateResponse
                                {
                                    Success = true,
                                    GeneratedText = textElement.GetString()
                                });
                            }
                        }
                    }
                }

                return StatusCode(500, new TextGenerateResponse
                {
                    Success = false,
                    ErrorMessage = "Failed to parse Gemini API response or no content generated."
                });
            }
            catch (HttpRequestException httpEx)
            {
                string errorMessage = $"Error from Gemini API: {httpEx.StatusCode} - {httpEx.Message}";
                if (httpEx.StatusCode == System.Net.HttpStatusCode.Unauthorized || httpEx.StatusCode == System.Net.HttpStatusCode.Forbidden)
                {
                    errorMessage = "Invalid API Key or insufficient permissions. Please check your Gemini API Key.";
                }
                else if (httpEx.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    errorMessage = "Rate limit exceeded. Please try again later.";
                }
                return StatusCode(500, new TextGenerateResponse
                {
                    Success = false,
                    ErrorMessage = errorMessage
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new TextGenerateResponse
                {
                    Success = false,
                    ErrorMessage = $"An unexpected error occurred: {ex.Message}"
                });
            }
        }
    }
}
