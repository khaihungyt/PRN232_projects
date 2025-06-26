namespace ArtStep.Data
{
    public class ShoeCustom
    {
        public string? ShoeId {  get; set; }
        public string? ShoeName { get; set; }

        public string? ShoeDescription { get; set; }

        public int? Quantity { get; set; }
        public double? PriceAShoe { get; set; }
        public string? CategoryId { get; set; }
        public short? IsHidden { get; set; }

        public virtual ICollection<ShoeImage>? Images { get; set; }
        public virtual User? Designer { get; set; }
        public virtual Category? Category { get; set; }

        public virtual ICollection<CartDetail>? CartDetails { get; set; }
        public virtual ICollection <OrderDetail>? OrderDetails { get; set; }
    }
}
