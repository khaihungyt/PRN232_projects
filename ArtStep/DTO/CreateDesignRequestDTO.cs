namespace ArtStep.DTO
{
    public class CreateDesignRequestDTO
    {
        public string? ShoeName { get; set; }
        public string? ShoeDescription { get; set; }
        public string? CategoryId { get; set; }

        public double? PriceAShoe { get; set; }
        public int? Quantity { get; set; }

        public List<string>? Images { get; set; } = new();
    }
}
