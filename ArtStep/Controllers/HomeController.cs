using ArtStep.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArtStep.Controllers
{
    [ApiController]
    [Route("api")]
    public class HomeController : ControllerBase
    {
        private readonly ArtStepDbContext _context;
        public HomeController(ArtStepDbContext context)
        {
            _context = context;
        }

        [HttpGet("products")]
        public async Task<IActionResult> GetProducts(
            [FromQuery] string? style,
            [FromQuery] string? designer,
            [FromQuery] string? search,
            [FromQuery] string? price,
            [FromQuery] int page = 1,
            [FromQuery] int limit = 6)
        {
            var query = _context.ShoeCustom
                .Include(sc => sc.Images)
                .Include(sc => sc.Category)
                .Include(sc => sc.Designer)
                .AsQueryable();

            if (!string.IsNullOrEmpty(style))
            {
                query = query.Where(sc => sc.Category != null && sc.Category.CategoryId == style);
            }

            if (!string.IsNullOrEmpty(designer))
            {
                query = query.Where(sc => sc.Designer != null && sc.Designer.UserId == designer);
            }

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(sc => sc.ShoeName.Contains(search));
            }

            if (!string.IsNullOrEmpty(price))
            {
                switch (price)
                {
                    case "0":
                        query = query.Where(sc => sc.PriceAShoe < 200000);
                        break;
                    case "1":
                        query = query.Where(sc => sc.PriceAShoe >= 200000 && sc.PriceAShoe <= 500000);
                        break;
                    case "2":
                        query = query.Where(sc => sc.PriceAShoe > 500000 && sc.PriceAShoe <= 1500000);
                        break;
                    case "3":
                        query = query.Where(sc => sc.PriceAShoe > 1500000 && sc.PriceAShoe <= 5000000);
                        break;
                    case "4":
                        query = query.Where(sc => sc.PriceAShoe > 5000000);
                        break;
                }
            }

            var total = await query.CountAsync();

            var products = await query
                .Skip((page - 1) * limit)
                .Take(limit)
                .Select(sc => new
                {
                    sc.ShoeId,
                    Name = sc.ShoeName,
                    Price = sc.PriceAShoe,
                    Style = sc.Category != null ? sc.Category.CategoryName : null,
                    Designer = sc.Designer != null ? sc.Designer.Name : null,
                    DesignerUserId = sc.Designer != null ? sc.Designer.UserId : null,
                    ImageUrl = sc.Images.Select(i => i.ImageLink).FirstOrDefault()
                })
                .ToListAsync();

            return Ok(new { total, products });
        }
        
        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories()
        {
            var categories = await _context.Categories
                .Select(c => new { c.CategoryId, c.CategoryName })
                .ToListAsync();

            return Ok(categories);
        }


        [HttpGet("designers")]
        public async Task<IActionResult> GetDesigners()
        {
            var designers = await _context.User
                .Where(u => u.Role == "Designer")
                .Select(d => new
                {
                    d.UserId,
                    d.Name
                })
                .ToListAsync();

            return Ok(designers);
        }

        // 200000 - 500000 - 1500000 - 5000000
        [HttpGet("prices")]
        public IActionResult GetPriceRanges()
        {
            var priceRanges = new List<int> { 200000, 500000, 1500000, 5000000 };
            return Ok(priceRanges);
        }

        [HttpGet("bestsellers")]
        public async Task<IActionResult> GetBestSellers()
        {
            try
            {
                var topSellingShoeIds = await _context.OrderDetail
                    .Where(od => od.ShoeCustomId != null)
                    .GroupBy(od => od.ShoeCustomId)
                    .Select(g => new
                    {
                        ShoeCustomId = g.Key,
                        TotalSold = g.Sum(od => od.QuantityBuy ?? 0)
                    })
                    .OrderByDescending(x => x.TotalSold)
                    .Take(5)
                    .ToListAsync();

                var shoeIds = topSellingShoeIds.Select(x => x.ShoeCustomId).ToList();
                
                var shoes = await _context.ShoeCustom
                    .Include(sc => sc.Images)
                    .Include(sc => sc.Category)
                    .Include(sc => sc.Designer)
                    .Where(sc => shoeIds.Contains(sc.ShoeId))
                    .ToListAsync();

                var bestSellers = topSellingShoeIds.Select(top => 
                {
                    var shoe = shoes.FirstOrDefault(s => s.ShoeId == top.ShoeCustomId);
                    return new
                    {
                        ShoeId = shoe?.ShoeId,
                        Name = shoe?.ShoeName,
                        Price = shoe?.PriceAShoe,
                        Style = shoe?.Category?.CategoryName,
                        Designer = shoe?.Designer?.Name,
                        DesignerUserId = shoe?.Designer?.UserId,
                        ImageUrl = shoe?.Images?.Select(i => i.ImageLink).FirstOrDefault(),
                        TotalSold = top.TotalSold
                    };
                }).Where(x => x.ShoeId != null).ToList();

                return Ok(bestSellers);
            }
            catch (Exception)
            {
                var fallbackShoes = await _context.ShoeCustom
                    .Include(sc => sc.Images)
                    .Include(sc => sc.Category)
                    .Include(sc => sc.Designer)
                    .Take(5)
                    .Select(sc => new
                    {
                        sc.ShoeId,
                        Name = sc.ShoeName,
                        Price = sc.PriceAShoe,
                        Style = sc.Category != null ? sc.Category.CategoryName : null,
                        Designer = sc.Designer != null ? sc.Designer.Name : null,
                        DesignerUserId = sc.Designer != null ? sc.Designer.UserId : null,
                        ImageUrl = sc.Images.Select(i => i.ImageLink).FirstOrDefault(),
                        TotalSold = 0 // Placeholder since no order data
                    })
                    .ToListAsync();

                return Ok(fallbackShoes);
            }
        }
    }
}
