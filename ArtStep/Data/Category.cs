namespace ArtStep.Data
{
    public class Category
    {
        public string? CategoryId { get; set; }
        public string? CategoryName { get; set; }

        public virtual ICollection<ShoeCustom>? ShoeCustoms { get; set; }
    }
}
