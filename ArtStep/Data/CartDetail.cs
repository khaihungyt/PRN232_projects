namespace ArtStep.Data
{
    public class CartDetail
    {
        public string? CartDetailID {  get; set; }

        public int? QuantityBuy { get; set; }
        public string? ShoeCustomId { get; set; }
        public string? CartId { get; set; }
        public virtual Cart? Cart { get; set; }
        public virtual ShoeCustom? ShoeCustom { get; set; }
    }
}
