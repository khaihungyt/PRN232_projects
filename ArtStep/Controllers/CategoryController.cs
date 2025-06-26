using ArtStep.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArtStep.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CategoryController : ControllerBase
    {
        private readonly ArtStepDbContext _context;
        public CategoryController(ArtStepDbContext context)
        {
            _context = context;
        }

        [HttpGet("get_all_categories")]
        [Authorize]
        public async Task<IActionResult> GetCategories()
        {
            var categories = await _context.Categories.ToListAsync();
            if (categories == null || !categories.Any())
            {
                return NotFound("No categories found.");
            }
            return Ok(categories);
        }

        [HttpPost("add_category")]
        [Authorize]
        public async Task<IActionResult> AddCategory()
        {
            var categoryName = Request.Form["categoryName"].ToString();
            if (string.IsNullOrEmpty(categoryName))
            {
                return BadRequest("Category name is required.");
            }

            var existingCategory = await _context.Categories
                .FirstOrDefaultAsync(c => c.CategoryName == categoryName);
            if (existingCategory != null)
            {
                return BadRequest("Category name already exists.");
            }

            var newCategory = new Category
            {
                CategoryId = Guid.NewGuid().ToString(),
                CategoryName = categoryName
            };
            _context.Categories.Add(newCategory);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetCategories), new { id = newCategory.CategoryId }, newCategory);
        }

        [HttpDelete("delete_category/{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteCategory(string id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
            {
                return NotFound("Không tìm thấy loại giày.");
            }

            var hasShoes = await _context.ShoeCustom.AnyAsync(s => s.CategoryId == id);
            if (hasShoes)
            {
                return BadRequest("Không thể xóa danh mục vì nó có các sản phẩm liên quan.");
            }

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();
            return Ok(category);
        }

        [HttpPut("update_category/{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateCategory(string id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
            {
                return NotFound("Không tìm thấy loại giày.");
            }
            var newCategoryName = Request.Form["categoryName"].ToString();
            if (string.IsNullOrEmpty(newCategoryName))
            {
                return BadRequest("Tên loại giày không được để trống.");
            }
            var existingCategory = await _context.Categories
                .FirstOrDefaultAsync(c => c.CategoryName == newCategoryName && c.CategoryId != id);
            if (existingCategory != null)
            {
                return BadRequest("Tên loại giày đã tồn tại.");
            }
            category.CategoryName = newCategoryName;
            _context.Categories.Update(category);
            await _context.SaveChangesAsync();
            return Ok(category);
        }

    }
}
