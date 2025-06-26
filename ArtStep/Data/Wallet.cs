namespace ArtStep.Data
{
    public class Wallet
    {
        public string? WalletId { get; set; }
        public string? UserId { get; set; }
        public double Balance { get; set; } = 0;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
        public short IsActive { get; set; } = 1;

        // Navigation property
        public virtual User? User { get; set; }
        public virtual ICollection<WalletTransaction>? WalletTransactions { get; set; }
    }
} 