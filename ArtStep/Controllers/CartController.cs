using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ArtStep.Data;
using System.Security.Claims;

namespace ArtStep.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CartController : ControllerBase
    {
        private readonly ArtStepDbContext _context;

        public CartController(ArtStepDbContext context)
        {
            _context = context;
        }
            
        [HttpGet]
        public async Task<ActionResult> GetCart()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var cart = await _context.Carts
                .Include(c => c.CartDetails)
                .ThenInclude(cd => cd.ShoeCustom)
                .ThenInclude(sc => sc.Images)
                .FirstOrDefaultAsync(c => c.UserId == userId);

            if (cart == null)
                return NotFound();

            var response = new
            {
                cart = new
                {
                    cartId = cart.CartId,
                    userId = cart.UserId,
                    cartDetails = cart.CartDetails.Select(cd => new
                    {
                        cartDetailID = cd.CartDetailID,
                        shoeCustomId = cd.ShoeCustomId,
                        quantityBuy = cd.QuantityBuy,
                        shoeCustom = cd.ShoeCustom != null ? new
                        {
                            shoeId = cd.ShoeCustom.ShoeId,
                            name = cd.ShoeCustom.ShoeName,
                            description = cd.ShoeCustom.ShoeDescription,
                            price = cd.ShoeCustom.PriceAShoe,
                            images = cd.ShoeCustom.Images?.Select(img => new
                            {
                                imageUrl = img.ImageLink
                            }).ToList()
                        } : null
                    }).ToList()
                }
            };

            return Ok(response);
        }
        /// Add an item 
        [HttpPost]
        public async Task<ActionResult<Cart>> AddToCart([FromBody] CartItemDto cartItemDto)
        {
            try
            {
                if (cartItemDto == null)
                {
                    return BadRequest(new { message = "Invalid request data" });
                }

                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }
                var shoeExists = await _context.ShoeCustom.AnyAsync(s => s.ShoeId == cartItemDto.ShoeId);
                if (!shoeExists)
                {
                    return BadRequest(new { message = "Shoe not found" });
                }

                var cart = await _context.Carts
                    .Include(c => c.CartDetails)
                    .FirstOrDefaultAsync(c => c.UserId == userId);

                if (cart == null)
                {
                    cart = new Cart
                    {
                        CartId = Guid.NewGuid().ToString(),
                        UserId = userId,
                        CartDetails = new List<CartDetail>()
                    };
                    _context.Carts.Add(cart);
                }
                var existingItem = cart.CartDetails
                    .FirstOrDefault(cd => cd.ShoeCustomId == cartItemDto.ShoeId);

                if (existingItem != null)
                {
                    existingItem.QuantityBuy = (existingItem.QuantityBuy ?? 0) + cartItemDto.Quantity;
                }
                else
                {
                    cart.CartDetails.Add(new CartDetail
                    {
                        CartDetailID = Guid.NewGuid().ToString(),
                        ShoeCustomId = cartItemDto.ShoeId,
                        CartId = cart.CartId,
                        QuantityBuy = cartItemDto.Quantity
                    });
                }

                await _context.SaveChangesAsync();
                var response = new
                {
                    message = "Item added to cart successfully",
                    cart = new
                    {
                        cartId = cart.CartId,
                        userId = cart.UserId,
                        cartDetails = cart.CartDetails.Select(cd => new
                        {
                            cartDetailId = cd.CartDetailID,
                            shoeId = cd.ShoeCustomId,
                            quantity = cd.QuantityBuy
                        }).ToList()
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while adding to cart", error = ex.Message });
            }
        }

        [HttpPut("{cartDetailId}")]
        public async Task<IActionResult> UpdateCartItem(string cartDetailId, [FromBody] CartItemDto cartItemDto)
        {
            var cartDetail = await _context.CartsDetail.FindAsync(cartDetailId);
            if (cartDetail == null)
                return NotFound();

            cartDetail.QuantityBuy = cartItemDto.Quantity;
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpDelete("{cartDetailId}")]
        public async Task<IActionResult> RemoveFromCart(string cartDetailId)
        {
            var cartDetail = await _context.CartsDetail.FindAsync(cartDetailId);
            if (cartDetail == null)
                return NotFound();

            _context.CartsDetail.Remove(cartDetail);
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpDelete]
        public async Task<IActionResult> ClearCart()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var cart = await _context.Carts
                .Include(c => c.CartDetails)
                .FirstOrDefaultAsync(c => c.UserId == userId);

            if (cart != null)
            {
                _context.CartsDetail.RemoveRange(cart.CartDetails);
                _context.Carts.Remove(cart);
                await _context.SaveChangesAsync();
            }

            return Ok();
        }
    }

    public class CartItemDto
    {
        public string ShoeId { get; set; }
        public int Quantity { get; set; }
    }
}