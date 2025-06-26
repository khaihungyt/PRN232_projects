using ArtStep.Data;

namespace ArtStep.DTO
{
    public class DesignerResponseDTO
    {
        public string DesignerId { get; set; }
        public string DesignerName { get; set; }
        public string Email { get; set; }
        public string Phone { get; set; }
        public double AverageRating { get; set; }
        public string AvatarImage { get; set; }

        public List<FeedbackDTO> FeedBackList { get; set; } = new();

        public List<ShoeCustomDTO> ShoeCustomList { get; set; } = new();

    }
}
