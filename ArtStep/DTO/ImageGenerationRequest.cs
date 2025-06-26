namespace ALLimage_API.DTO
{
    public class ImageGenerationRequest
    {
        public string Prompt { get; set; } = string.Empty;
        public int NumImages { get; set; } = 1;
        public string Size { get; set; } = "1024x1024";
    }
}
