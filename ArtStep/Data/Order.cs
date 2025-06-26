namespace ArtStep.Data
{
    public class Order
    {
        public string? OrderId { get; set; }

        public string? Status { get; set; }

        public string? UserId { get; set; }
        public DateTime CreateAt { get; set; } = DateTime.Now;
        public virtual User? User { get; set; }        
        public long? VNPayPaymentId { get; set; }
        public virtual ICollection<OrderDetail>? OrderDetails { get; set; }
        public virtual ICollection<WalletTransaction>? WalletTransactions { get; set; }
        public virtual ICollection<Feedback>? Feedbacks { get; set; }

    }
}
