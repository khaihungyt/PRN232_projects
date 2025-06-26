namespace ArtStep.Data
{
    public class OrderDetail
    {
        public string? OrderDetailId { get; set; }
        public double? CostaShoe { get; set; }
        public int? QuantityBuy {  get; set; }
        public string? OrderId { get; set; }

        public string? ShoeCustomId {  get; set; }
        public virtual ShoeCustom? ShoeCustom { get; set; }
        public virtual Order? Order { get; set; }
    }
}
