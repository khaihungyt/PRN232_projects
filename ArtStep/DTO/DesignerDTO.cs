namespace ArtStep.DTO
{
    public class DesignerDTO
    {
        public string? UserId { get; set; }
        public string? Name { get; set; }
        public short? isActive { get; set; }
    }

    public class DesignerPublicDTO
    {
        public string? UserId { get; set; }
        public string? Name { get; set; }
        public string? ImageProfile { get; set; }
        public int TotalDesigns { get; set; }
    }
}
