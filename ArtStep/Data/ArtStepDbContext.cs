using Microsoft.EntityFrameworkCore;
using System;

namespace ArtStep.Data
{
    public class ArtStepDbContext : DbContext
    {
        public ArtStepDbContext(DbContextOptions<ArtStepDbContext> options) : base(options) { }

        public DbSet<Account> Accounts { get; set; }
        public DbSet<Cart> Carts { get; set; }
        public DbSet<CartDetail> CartsDetail { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Message> Message { get; set; }
        public DbSet<Order> Order { get; set; }

        public DbSet<OrderDetail> OrderDetail { get; set; }
        public DbSet<ShoeImage> ShoeImages { get; set; }
        public DbSet<ShoeCustom> ShoeCustom { get; set; }
        public DbSet<User> User { get; set; }

        public DbSet<Feedback> Feedbacks { get; set; }
        public DbSet<Wallet> Wallets { get; set; }
        public DbSet<WalletTransaction> WalletTransactions { get; set; }
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Account
            modelBuilder.Entity<Account>(entity =>
            {
                entity.HasKey(a => a.AccountId);
            });

            // User
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(u => u.UserId);
                entity.HasOne(u => u.Account)
                .WithOne(a => a.User)
                .HasForeignKey<Account>(a => a.UserId);

            });

            // Cart
            modelBuilder.Entity<Cart>(entity =>
            {
                entity.HasKey(c => c.CartId);

                entity.Property(c => c.UserId)
                      .HasMaxLength(255);

                entity.HasOne(c => c.Users)
                      .WithOne(u => u.Cart)
                      .HasForeignKey<Cart>(c => c.UserId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            //modelBuilder.Entity<User>()
            //    .HasOne(u => u.Cart)
            //    .WithOne(c => c.Users)
            //    .HasForeignKey<Cart>(c => c.UserId)
            //    .OnDelete(DeleteBehavior.Cascade);

            // CartDetail
            modelBuilder.Entity<CartDetail>(entity =>
            {
                entity.HasKey(cd => cd.CartDetailID);

                entity.HasOne(cd => cd.Cart)
                      .WithMany(c => c.CartDetails)
                      .HasForeignKey(cd => cd.CartId);

                entity.HasOne(cd => cd.ShoeCustom)
                      .WithMany(cd => cd.CartDetails)
                      .HasForeignKey(cd => cd.ShoeCustomId);
            });

            // Category
            modelBuilder.Entity<Category>(entity =>
            {
                entity.HasKey(c => c.CategoryId);
            });

            // Message
            modelBuilder.Entity<Message>(entity =>
            {
                entity.HasKey(m => m.MessageId);

                entity.HasOne(m => m.UserSend)
                      .WithMany()
                      .HasForeignKey(m => m.SenderId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(m => m.UserReceived)
                      .WithMany()
                      .HasForeignKey(m => m.ReceivedId)
                      .OnDelete(DeleteBehavior.Restrict); ;
                entity.Property(m => m.SendAt).HasColumnType("timestamp")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");
            });

            // Order
            modelBuilder.Entity<Order>(entity =>
            {
                entity.HasKey(o => o.OrderId);
                entity.HasOne(o => o.User)
                      .WithMany(u => u.Orders)
                      .HasForeignKey(o => o.UserId);
                entity.Property(m => m.CreateAt)
                      .HasColumnType("timestamp")
                      .HasDefaultValueSql("CURRENT_TIMESTAMP");
                entity.Property(m => m.VNPayPaymentId)
                      .HasColumnType("bigint");
            });

            // OrderDetail
            modelBuilder.Entity<OrderDetail>(entity =>
            {
                entity.HasKey(od => od.OrderDetailId);
                entity.HasOne(od => od.Order)
                      .WithMany(o => o.OrderDetails)
                      .HasForeignKey(od => od.OrderId);

                entity.HasOne(od => od.ShoeCustom)
                      .WithMany(sc => sc.OrderDetails)
                      .HasForeignKey(od => od.ShoeCustomId);
            });

            // ShoeImage
            modelBuilder.Entity<ShoeImage>(entity =>
            {
                entity.HasKey(si => si.ImageId);
                entity.HasOne(si => si.ShoeCustom)
                      .WithMany(sc => sc.Images)
                      .HasForeignKey(si => si.ShoeCustomId);
            });

            // ShoeCustom
            modelBuilder.Entity<ShoeCustom>(entity =>
            {
                entity.HasKey(sc => sc.ShoeId);
                entity.HasOne(sc => sc.Category)
                      .WithMany(c => c.ShoeCustoms)
                      .HasForeignKey(sc => sc.CategoryId);
            });


            modelBuilder.Entity<Feedback>(entity =>
            {
                entity.HasKey(fb => fb.FeedbackId);
                
                entity.ToTable("feedback");
                entity.HasOne(fb => fb.UserSend)
                     .WithMany(u => u.SentFeedbacks)
                     .HasForeignKey(f => f.UserSendFeedbackId);

                entity.HasOne(fb => fb.DesignersReceived)
                      .WithMany(u => u.ReceivedFeedbacks)
                      .HasForeignKey(fb => fb.DesignerReceiveFeedbackId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(fb => fb.Order)
                      .WithMany(o => o.Feedbacks)
                      .HasForeignKey(fb => fb.OrderId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // Wallet
            modelBuilder.Entity<Wallet>(entity =>
            {
                entity.HasKey(w => w.WalletId);
                entity.HasOne(w => w.User)
                      .WithOne(u => u.Wallet)
                      .HasForeignKey<Wallet>(w => w.UserId)
                      .OnDelete(DeleteBehavior.Restrict);
                
                entity.Property(w => w.Balance)
                      .HasColumnType("double")
                      .HasDefaultValue(0);
                
                entity.Property(w => w.CreatedAt)
                      .HasColumnType("timestamp")
                      .HasDefaultValueSql("CURRENT_TIMESTAMP");
                
                entity.Property(w => w.UpdatedAt)
                      .HasColumnType("timestamp")
                      .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            });

            // WalletTransaction
            modelBuilder.Entity<WalletTransaction>(entity =>
            {
                entity.HasKey(wt => wt.TransactionId);
                entity.HasOne(wt => wt.Wallet)
                      .WithMany(w => w.WalletTransactions)
                      .HasForeignKey(wt => wt.WalletId)
                      .OnDelete(DeleteBehavior.Restrict);
                
                entity.HasOne(wt => wt.Order)
                      .WithMany(o => o.WalletTransactions)
                      .HasForeignKey(wt => wt.OrderId)
                      .OnDelete(DeleteBehavior.SetNull);
                
                entity.Property(wt => wt.Amount)
                      .HasColumnType("double");
                
                entity.Property(wt => wt.BalanceBefore)
                      .HasColumnType("double");
                
                entity.Property(wt => wt.BalanceAfter)
                      .HasColumnType("double");
                
                entity.Property(wt => wt.CreatedAt)
                      .HasColumnType("timestamp")
                      .HasDefaultValueSql("CURRENT_TIMESTAMP");
                
                entity.Property(wt => wt.CompletedAt)
                      .HasColumnType("timestamp");
            });
        }
    }
}

