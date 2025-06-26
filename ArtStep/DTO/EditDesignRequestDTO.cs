namespace ArtStep.DTO
{
    public class EditDesignRequestDTO
    {
        public string? ShoeId { get; set; }
        public string? ShoeName { get; set; }
        public string? ShoeDescription { get; set; }

        public double? PriceAShoe { get; set; }
        public int? Quantity { get; set; }
        public string? CategoryId { get; set; }
        public List<ShoeImageDTO> ShoeImages { get; set; } = new();
    }
}
