using System.ComponentModel.DataAnnotations.Schema;

namespace ArtStep.Data
{
    public class User
    {
        public string? UserId { get; set; }
        public string? Name { get; set; }
        public string? Email { get; set; }

        public string? PhoneNo { get; set; }
        public string? Role { get; set; }
        
        public string? ImageProfile { get; set; }
        
        public short? isActive { get; set; }
        public virtual Account? Account { get; set; }
        public virtual Cart? Cart { get; set; }
        public virtual Wallet? Wallet { get; set; }
        public virtual ICollection<ShoeCustom>? ShoeCustoms { get; set; }

        public virtual ICollection<Order>? Orders { get; set; }
        public ICollection<Feedback> SentFeedbacks { get; set; }
        public virtual ICollection<Feedback>? ReceivedFeedbacks { get; set; }
        public ICollection<Report> Reports { get; set; }



    }

}
