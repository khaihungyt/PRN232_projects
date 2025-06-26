using System.ComponentModel.DataAnnotations;

namespace ArtStep.Data
{
    public class Cart
    {
        public string? CartId {  get; set; }
        [MaxLength(255)]
        public string? UserId { get; set; }
        public virtual User? Users { get; set; }

        public virtual ICollection<CartDetail>? CartDetails { get; set; }
    }
}
