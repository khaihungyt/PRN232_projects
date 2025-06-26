namespace ArtStep.Data
{
    public class WalletTransaction
    {
        public string? TransactionId { get; set; }
        public string? WalletId { get; set; }
        public string? TransactionType { get; set; } // "CHARGE", "PAYMENT", "REFUND", "WITHDRAWAL"
        public double Amount { get; set; }
        public double BalanceBefore { get; set; }
        public double BalanceAfter { get; set; }
        public string? Description { get; set; }
        public string? Status { get; set; } // "PENDING", "COMPLETED", "FAILED", "CANCELLED"
        public string? PaymentMethod { get; set; } // "VNPAY", "BANK_TRANSFER", "CREDIT_CARD", etc.
        public string? ExternalTransactionId { get; set; } // VNPay transaction ID or other external payment IDs
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? CompletedAt { get; set; }

        // Navigation property
        public virtual Wallet? Wallet { get; set; }
        
        // Optional: Link to order if this transaction is for an order payment
        public string? OrderId { get; set; }
        public virtual Order? Order { get; set; }
    }
} 