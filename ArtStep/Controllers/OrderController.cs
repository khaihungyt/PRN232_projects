using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ArtStep.Data;
using System.Security.Claims;
using VNPAY.NET.Utilities;
using VNPAY.NET;
using VNPAY.NET.Enums;
using VNPAY.NET.Models;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;

namespace ArtStep.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class OrderController : ControllerBase
    {
        private readonly ArtStepDbContext _context;
        private readonly IVnpay _vnpay;
        private readonly IConfiguration _configuration;
        public OrderController(ArtStepDbContext context, IVnpay vnpay, IConfiguration configuration)
        {
            _context = context;
            _vnpay = vnpay;
            _configuration = configuration;
            var tmnCode = _configuration["Vnpay:TmnCode"];
            var hashSecret = _configuration["Vnpay:HashSecret"];
            var baseUrl = _configuration["Vnpay:BaseUrl"];
            var callbackUrl = _configuration["Vnpay:CallbackUrl"];

            if (!string.IsNullOrEmpty(tmnCode) && !string.IsNullOrEmpty(hashSecret) &&
                !string.IsNullOrEmpty(baseUrl) && !string.IsNullOrEmpty(callbackUrl))
            {
                _vnpay.Initialize(tmnCode, hashSecret, baseUrl, callbackUrl);
            }
        }

        [HttpPost("checkout")]
        public async Task<ActionResult> Checkout()
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                // Get user's cart with items
                var cart = await _context.Carts
                    .Include(c => c.CartDetails)
                    .ThenInclude(cd => cd.ShoeCustom)
                    .FirstOrDefaultAsync(c => c.UserId == userId);

                if (cart == null || cart.CartDetails == null || !cart.CartDetails.Any())
                {
                    return BadRequest(new { message = "Cart is empty" });
                }

                // Create new order
                var orderId = Guid.NewGuid().ToString();
                var order = new Order
                {
                    OrderId = orderId,
                    UserId = userId,
                    Status = "Pending",
                    CreateAt = DateTime.Now
                };

                _context.Order.Add(order);

                // Create order details from cart items
                var orderDetails = new List<OrderDetail>();
                foreach (var cartItem in cart.CartDetails)
                {
                    if (cartItem.ShoeCustom != null)
                    {
                        var orderDetail = new OrderDetail
                        {
                            OrderDetailId = Guid.NewGuid().ToString(),
                            OrderId = orderId,
                            ShoeCustomId = cartItem.ShoeCustomId,
                            QuantityBuy = cartItem.QuantityBuy,
                            CostaShoe = cartItem.ShoeCustom.PriceAShoe * cartItem.QuantityBuy
                        };
                        orderDetails.Add(orderDetail);
                    }
                }

                _context.OrderDetail.AddRange(orderDetails);

                // Clear the cart after successful order creation
                _context.CartsDetail.RemoveRange(cart.CartDetails);
                _context.Carts.Remove(cart);

                // Save all changes
                await _context.SaveChangesAsync();

                // Calculate total for response
                var totalAmount = orderDetails.Sum(od => od.CostaShoe ?? 0);

                return Ok(new
                {
                    message = "Order placed successfully!",
                    orderId = orderId,
                    totalAmount = totalAmount,
                    itemCount = orderDetails.Count,
                    status = "Pending"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred during checkout", error = ex.Message });
            }
        }

        [HttpGet]
        public async Task<ActionResult> GetOrders()
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                var orders = await _context.Order
                    .Include(o => o.OrderDetails)
                    .ThenInclude(od => od.ShoeCustom)
                    .ThenInclude(sc => sc.Images)
                    .Where(o => o.UserId == userId)
                    .OrderByDescending(o => o.CreateAt)
                    .Select(o => new
                    {
                        orderId = o.OrderId,
                        status = o.Status,
                        createAt = o.CreateAt,
                        totalAmount = o.OrderDetails.Sum(od => od.CostaShoe ?? 0),
                        itemCount = o.OrderDetails.Count(),
                        orderDetails = o.OrderDetails.Select(od => new
                        {
                            orderDetailId = od.OrderDetailId,
                            shoeCustomId = od.ShoeCustomId,
                            quantityBuy = od.QuantityBuy,
                            costaShoe = od.CostaShoe,
                            shoeCustom = od.ShoeCustom != null ? new
                            {
                                shoeId = od.ShoeCustom.ShoeId,
                                shoeName = od.ShoeCustom.ShoeName,
                                shoeDescription = od.ShoeCustom.ShoeDescription,
                                priceAShoe = od.ShoeCustom.PriceAShoe,
                                images = od.ShoeCustom.Images != null ? od.ShoeCustom.Images.Select(img => new
                                {
                                    imageLink = img.ImageLink
                                }).ToArray() : new object[0]
                            } : null
                        }).ToList()
                    })
                    .ToListAsync();

                return Ok(new { orders });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving orders", error = ex.Message });
            }
        }

        [HttpPost("create-vnpay")]
        public async Task<ActionResult> CreateVNpay([FromBody]double amount)
        {
            var ipAddress = NetworkHelper.GetIpAddress(HttpContext);
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "User not authenticated" });

            // Get user's cart with items
            var cart = await _context.Carts
                .Include(c => c.CartDetails)
                .ThenInclude(cd => cd.ShoeCustom)
                .FirstOrDefaultAsync(c => c.UserId == userId);

            if (cart == null || cart.CartDetails == null || !cart.CartDetails.Any())
            {
                return BadRequest(new { message = "Cart is empty" });
            }

            // Create new order
            var orderId = Guid.NewGuid().ToString();
            var order = new Order
            {
                OrderId = orderId,
                UserId = userId,
                Status = "Pending",
                CreateAt = DateTime.Now,
                VNPayPaymentId = DateTime.Now.Ticks
            };

            _context.Order.Add(order);

            var orderDetails = new List<OrderDetail>();
            foreach (var cartItem in cart.CartDetails)
            {
                if (cartItem.ShoeCustom != null)
                {
                    var orderDetail = new OrderDetail
                    {
                        OrderDetailId = Guid.NewGuid().ToString(),
                        OrderId = orderId,
                        ShoeCustomId = cartItem.ShoeCustomId,
                        QuantityBuy = cartItem.QuantityBuy,
                        CostaShoe = cartItem.ShoeCustom.PriceAShoe * cartItem.QuantityBuy
                    };
                    orderDetails.Add(orderDetail);
                }
            }

            _context.OrderDetail.AddRange(orderDetails);

            // Clear the cart after successful order creation
            _context.CartsDetail.RemoveRange(cart.CartDetails);
            _context.Carts.Remove(cart);

            // Save all changes
            await _context.SaveChangesAsync();

            var totalAmount = orderDetails.Sum(od => od.CostaShoe ?? 0);
            var request = new PaymentRequest
            {
                PaymentId= order.VNPayPaymentId.Value,
                Money = amount,
                Description = "Order payment",
                IpAddress = ipAddress,
                BankCode = BankCode.ANY,
                CreatedDate = DateTime.Now,
                Currency = Currency.VND,
                Language = DisplayLanguage.Vietnamese
            };

            var paymentUrl = _vnpay.GetPaymentUrl(request);
            return Ok(paymentUrl);
        }

        [HttpGet("vnpay-callback")]
        [AllowAnonymous]
        public async Task<ActionResult> VNPayCallback()
        {
            IQueryCollection query = Request.Query;
            if (!query.Any())
            {
                return Redirect("/cart?payment_info=error");
            }
            var paymentResult = _vnpay.GetPaymentResult(query);
            if (paymentResult.IsSuccess)
            {
                var order = _context.Order.Include(o => o.OrderDetails).FirstOrDefault(o => o.VNPayPaymentId == paymentResult.PaymentId);
                if(order == null) return Redirect("/cart?payment_info=order_not_found");
                order.Status = "Paid";
                _context.Order.Update(order);
                var totalAmount = order.OrderDetails.Sum(od => od.CostaShoe ?? 0);
                return Redirect($"/cart?payment_info=order_success&orderId={order.OrderId}&totalAmount={totalAmount}&itemCount={order.OrderDetails.Count}");
            }
            return Redirect($"/cart?payment_info=payment_fail");
        }

        [HttpGet("top-selling-shoes")]
        [AllowAnonymous]
        public async Task<ActionResult> GetTopSellingShoes()
        {
            try
            {
                // Query to get the top 5 best-selling shoes based on total quantity sold
                var topSellingShoes = await _context.OrderDetail
                    .Include(od => od.ShoeCustom)
                    .Where(od => od.ShoeCustom != null)
                    .GroupBy(od => od.ShoeCustom)
                    .Select(g => new
                    {
                        ShoeId = g.Key.ShoeId,
                        ShoeName = g.Key.ShoeName,
                        TotalQuantitySold = g.Sum(od => od.QuantityBuy)
                    })
                    .OrderByDescending(s => s.TotalQuantitySold)
                    .Take(5)
                    .ToListAsync();

                if (topSellingShoes == null || topSellingShoes.Count == 0)
                {
                    return NotFound(new { message = "No shoes found" });
                }

                return Ok(new { topSellingShoes });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving top-selling shoes", error = ex.Message });
            }
        }


    }
}