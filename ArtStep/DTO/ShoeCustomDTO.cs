namespace ArtStep.DTO
{
    public class ShoeCustomDTO
    {
        public string? ShoeId { get; set; }
        public string? ShoeName { get; set; }
        public string? ShoeDescription { get; set; }
        public int? Quantity { get; set; }
        public double? PriceAShoe { get; set; }
        public string? CategoryId { get; set; }
        public short? IsHidden { get; set; }

        public CategoryDTO Category { get; set; }

        public DesignerDTO Designer { get; set; }

        public List<ShoeImageDTO> ShoeImages { get; set; } = new ();
    }
}
