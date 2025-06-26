
namespace ArtStep.Data
{
    public class Account
    {
        public string? AccountId { get; set; }
        public string? UserName { get; set; }
        public string? Password { get; set; }

        public string? UserId { get; set; }

        public short? isStatus { get; set; }

        public virtual User? User { get; set; }
    }
}
