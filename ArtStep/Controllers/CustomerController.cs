using ArtStep.Data;
using ArtStep.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArtStep.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CustomerController : ControllerBase
    {
        private readonly ILogger<CustomerController> _logger;
        private readonly ArtStepDbContext _context;

        public CustomerController(ILogger<CustomerController> logger, ArtStepDbContext context)
        {
            _logger = logger;
            _context = context;
        }

        [HttpGet("get_all_customers")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<DesignerDTO>>> GetAllCustomers()
        {

            try
            {
                var customers = await _context.User
                    .Where(u => u.Role == "User")
                    .Select(u => new DesignerDTO
                    {
                        UserId = u.UserId,
                        Name = u.Name,
                        isActive = u.isActive,
                    })
                    .ToListAsync();

                return Ok(customers);
            }
            catch (Exception)
            {
                return StatusCode(500, new { Message = "An error occurred while retrieving designers" });
            }
        }

        // Put api/CustomerController/update_customer_status
        [HttpPut("update_customer_status")]
        [Authorize]
        public async Task<IActionResult> UpdateCustomerStatus([FromBody] DesignerDTO request)
        {
            try
            {
                var designer = await _context.User.FindAsync(request.UserId);
                if (designer == null)
                {
                    return NotFound(new { Message = "Customer not found" });
                }
                designer.isActive = request.isActive;
                _context.User.Update(designer);
                await _context.SaveChangesAsync();
                return Ok(new { Message = "Customer status updated successfully" });
            }
            catch (Exception)
            {
                return StatusCode(500, new { Message = "An error occurred while updating designer status" });
            }
        }
    }
}
