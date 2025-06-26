namespace ArtStep.DTO
{
    public class FeedbackDTO
    {
        public string FeedbackId {  get; set; }
        public string FeedbackDescription { get; set; }

        public int FeedbackStars { get; set; }

        public UserDTO User { get; set; }

    }
}
