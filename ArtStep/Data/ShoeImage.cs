namespace ArtStep.Data
{
    public class ShoeImage
    {
        public string? ImageId {  get; set; }

        public string? ImageLink {  get; set; }
        public string? ShoeCustomId { get; set; }
        public virtual ShoeCustom? ShoeCustom { get; set; }
    }
}
