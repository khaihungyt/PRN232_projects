using ArtStep.Data;
using ArtStep.DTO;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static System.Net.Mime.MediaTypeNames;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace ArtStep.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DetailShoeController : ControllerBase
    {
        private readonly ArtStepDbContext _context;
        public DetailShoeController(ArtStepDbContext context)
        {
            _context = context;
        }
        // GET: api/<DetailShoeController>
        [HttpGet]
        public IEnumerable<string> Get()
        {
            return new string[] { "value1", "value2" };
        }

        // GET api/<DetailShoeController>/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ShoeCustomDTO>> GetAsync(string id)
        {
            var shoeDetail = await _context.ShoeCustom
           .AsNoTracking() // Improve performance for read-only operations
           .Include(sc => sc.Category)
           .Include(sc => sc.Designer)
           .Include(sc => sc.Images)
           .Where(sc => sc.ShoeId == id)
           .Select(sc => new ShoeCustomDTO
           {
               ShoeId = sc.ShoeId,
               ShoeName = sc.ShoeName,
               ShoeDescription = sc.ShoeDescription,
               Quantity = sc.Quantity,
               PriceAShoe = sc.PriceAShoe,
               IsHidden = sc.IsHidden,
               Category = new CategoryDTO
               {
                   CategoryId = sc.Category.CategoryId,
                   CategoryName = sc.Category.CategoryName
               },
               Designer = new DesignerDTO
               {
                   UserId = sc.Designer.UserId,
                   Name = sc.Designer.Name
               },
               ShoeImages = sc.Images.Select(i => new ShoeImageDTO
               {
                   ImageId = i.ImageId,
                   ImageLink = i.ImageLink
               }).ToList() // Sort thumbnails first
           }).FirstOrDefaultAsync();

            if (shoeDetail == null)
            {
                return NotFound();
            }
            return Ok(shoeDetail);
        }
        //// POST api/<DetailShoeController>
        //[HttpPost]
        //public void Post([FromBody] string value)
        //{
        //}

        // PUT api/<DetailShoeController>/5
        //[HttpPost("addtoCart")]


        //[HttpPut("{id}")]
        //public void Put(int id, [FromBody] string value)
        //{
        //}

        //// DELETE api/<DetailShoeController>/5
        //[HttpDelete("{id}")]
        //public void Delete(int id)
        //{
        //}
    }
}
