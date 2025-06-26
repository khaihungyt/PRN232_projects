namespace ArtStep.Data
{
    public class Message
    {
        public string? MessageId {  get; set; }
        public string? MessageDescription { get; set; }

        public bool? MessageType { get; set; }

        public string? SenderId { get; set; }
        public string? ReceivedId {  get; set; }
        public DateTime? SendAt { get; set; }
        
        public bool IsRead { get; set; } = false;
        public DateTime? ReadTime { get; set; }

        public virtual User? UserSend { get; set; }

        public virtual User? UserReceived { get; set; }
    }
}
