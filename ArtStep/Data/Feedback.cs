namespace ArtStep.Data
{
    public class Feedback
    {
        public string? FeedbackId { get; set; }
        public string? FeedbackDescription {  get; set; }
        public int? FeedbackStars { get; set; }
        public string? DesignerReceiveFeedbackId { get; set; }
        public virtual User? DesignersReceived { get; set; }
        public string? UserSendFeedbackId { get; set; }
        public virtual User? UserSend {  get; set; }

        public string? OrderId { get; set; }
        public virtual Order? Order { get; set; }
    }
}
