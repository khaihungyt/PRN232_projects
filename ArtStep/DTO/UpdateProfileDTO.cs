using Microsoft.AspNetCore.Mvc;

namespace ArtStep.DTO
{
    public class UpdateProfileDTO
    {
        public string? Avatar { get; set; }

        [FromForm(Name = "name")]
        public string Name { get; set; }

        [FromForm(Name = "email")]
        public string Email { get; set; }

        [FromForm(Name = "phoneNo")]
        public string PhoneNo { get; set; }
    }
}
