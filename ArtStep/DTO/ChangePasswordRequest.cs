using System.ComponentModel.DataAnnotations;

namespace ArtStep.DTO
{
    public class ChangePasswordRequest
    {
        [Required]
        public string CurrentPassword { get; set; }
        [Required]
        public string NewPassword { get; set; }
    }
}
