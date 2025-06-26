using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ArtStep.Data;
using System.Security.Claims;
using VNPAY.NET.Utilities;
using VNPAY.NET;
using VNPAY.NET.Enums;
using VNPAY.NET.Models;

namespace ArtStep.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class WalletController : ControllerBase
    {
        private readonly ArtStepDbContext _context;
        private readonly IVnpay _vnpay;
        private readonly IConfiguration _configuration;

        public WalletController(ArtStepDbContext context, IVnpay vnpay, IConfiguration configuration)
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

        [HttpGet("balance")]
        public async Task<ActionResult> GetWalletBalance()
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                // Get or create wallet for user
                var wallet = await GetOrCreateWallet(userId);

                return Ok(new
                {
                    walletId = wallet.WalletId,
                    balance = wallet.Balance,
                    isActive = wallet.IsActive == 1,
                    createdAt = wallet.CreatedAt,
                    updatedAt = wallet.UpdatedAt
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving wallet balance", error = ex.Message });
            }
        }

        [HttpPost("recharge")]
        public async Task<ActionResult> CreateWalletRecharge([FromBody] RechargeRequest request)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                if (request.Amount <= 0)
                    return BadRequest(new { message = "Recharge amount must be greater than 0" });

                if (request.Amount < 10000) // Minimum 10,000 VND
                    return BadRequest(new { message = "Minimum recharge amount is 10,000 VND" });

                if (request.Amount > 50000000) // Maximum 50,000,000 VND
                    return BadRequest(new { message = "Maximum recharge amount is 50,000,000 VND" });

                var wallet = await GetOrCreateWallet(userId);

                var transactionId = Guid.NewGuid().ToString();
                var vnpayPaymentId = DateTime.Now.Ticks;
                
                var walletTransaction = new WalletTransaction
                {
                    TransactionId = transactionId,
                    WalletId = wallet.WalletId,
                    TransactionType = "CHARGE",
                    Amount = request.Amount,
                    BalanceBefore = wallet.Balance,
                    BalanceAfter = wallet.Balance,
                    Description = request.Description ?? "Wallet recharge",
                    Status = "PENDING",
                    PaymentMethod = "BANKING",
                    ExternalTransactionId = vnpayPaymentId.ToString(),
                    CreatedAt = DateTime.Now
                };

                _context.WalletTransactions.Add(walletTransaction);
                await _context.SaveChangesAsync();

                //walletTransaction.Status = "COMPLETED";
                //walletTransaction.CompletedAt = DateTime.Now;
                
                //// Update wallet balance
                //wallet.Balance += request.Amount;
                //wallet.UpdatedAt = DateTime.Now;
                //walletTransaction.BalanceAfter = wallet.Balance;

                //_context.WalletTransactions.Update(walletTransaction);
                //_context.Wallets.Update(wallet);
                //await _context.SaveChangesAsync();

                return Ok(new { 
                    success = true,
                    message = "Recharge completed successfully",
                    transactionId = transactionId,
                    amount = request.Amount,
                    newBalance = wallet.Balance,
                    redirectUrl = $"/wallet?recharge_status=success&amount={request.Amount:N0}&balance={wallet.Balance:N0}"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred during wallet recharge", error = ex.Message });
            }
        }

        [HttpGet("vnpay-callback")]
        [AllowAnonymous]
        public async Task<ActionResult> VNPayWalletCallback()
        {
            try
            {
                IQueryCollection query = Request.Query;
                if (!query.Any())
                {
                    return Redirect("/wallet?recharge_status=error");
                }

                var paymentResult = _vnpay.GetPaymentResult(query);
                var transaction = await _context.WalletTransactions
                    .Include(wt => wt.Wallet)
                    .FirstOrDefaultAsync(wt => wt.ExternalTransactionId == paymentResult.PaymentId.ToString());

                if (transaction == null)
                {
                    return Redirect("/wallet?recharge_status=transaction_not_found");
                }

                if (paymentResult.IsSuccess)
                {
                    // Update transaction status
                    transaction.Status = "COMPLETED";
                    transaction.CompletedAt = DateTime.Now;
                    
                    // Update wallet balance
                    if (transaction.Wallet != null)
                    {
                        transaction.Wallet.Balance += transaction.Amount;
                        transaction.Wallet.UpdatedAt = DateTime.Now;
                        transaction.BalanceAfter = transaction.Wallet.Balance;
                    }

                    _context.WalletTransactions.Update(transaction);
                    await _context.SaveChangesAsync();

                    return Redirect($"/wallet?recharge_status=success&amount={transaction.Amount:N0}&balance={transaction.BalanceAfter:N0}");
                }
                else
                {
                    // Update transaction status to failed
                    transaction.Status = "FAILED";
                    transaction.CompletedAt = DateTime.Now;
                    _context.WalletTransactions.Update(transaction);
                    await _context.SaveChangesAsync();

                    return Redirect("/wallet?recharge_status=failed");
                }
            }
            catch (Exception ex)
            {
                return Redirect("/wallet?recharge_status=error");
            }
        }

        [HttpGet("transactions")]
        public async Task<ActionResult> GetTransactionHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                if (page < 1) page = 1;
                if (pageSize < 1 || pageSize > 100) pageSize = 20;

                // Get user's wallet
                var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
                if (wallet == null)
                {
                    return Ok(new { transactions = new List<object>(), totalCount = 0, currentPage = page, pageSize = pageSize });
                }

                // Get paginated transactions
                var query = _context.WalletTransactions
                    .Where(wt => wt.WalletId == wallet.WalletId)
                    .OrderByDescending(wt => wt.CreatedAt);

                var totalCount = await query.CountAsync();
                var transactions = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(wt => new
                    {
                        transactionId = wt.TransactionId,
                        transactionType = wt.TransactionType,
                        amount = wt.Amount,
                        balanceBefore = wt.BalanceBefore,
                        balanceAfter = wt.BalanceAfter,
                        description = wt.Description,
                        status = wt.Status,
                        paymentMethod = wt.PaymentMethod,
                        createdAt = wt.CreatedAt,
                        completedAt = wt.CompletedAt,
                        orderId = wt.OrderId
                    })
                    .ToListAsync();

                return Ok(new
                {
                    transactions = transactions,
                    totalCount = totalCount,
                    currentPage = page,
                    pageSize = pageSize,
                    totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving transaction history", error = ex.Message });
            }
        }

        [HttpPost("pay-order")]
        public async Task<ActionResult> PayOrderWithWallet([FromBody] PayOrderRequest request)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                // Get user's wallet
                var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
                if (wallet == null)
                    return BadRequest(new { message = "Wallet not found" });

                // Get order details
                var order = await _context.Order
                    .Include(o => o.OrderDetails)
                    .FirstOrDefaultAsync(o => o.OrderId == request.OrderId && o.UserId == userId);

                if (order == null)
                    return NotFound(new { message = "Order not found" });

                if (order.Status != "Pending")
                    return BadRequest(new { message = "Order is not in pending status" });

                var totalAmount = order.OrderDetails?.Sum(od => od.CostaShoe ?? 0) ?? 0;

                if (wallet.Balance < totalAmount)
                    return BadRequest(new { message = "Insufficient wallet balance", currentBalance = wallet.Balance, requiredAmount = totalAmount });

                // Create wallet transaction for payment
                var transactionId = Guid.NewGuid().ToString();
                var walletTransaction = new WalletTransaction
                {
                    TransactionId = transactionId,
                    WalletId = wallet.WalletId,
                    TransactionType = "PAYMENT",
                    Amount = -totalAmount, // Negative for deduction
                    BalanceBefore = wallet.Balance,
                    BalanceAfter = wallet.Balance - totalAmount,
                    Description = $"Payment for order {order.OrderId}",
                    Status = "COMPLETED",
                    PaymentMethod = "WALLET",
                    OrderId = order.OrderId,
                    CreatedAt = DateTime.Now,
                    CompletedAt = DateTime.Now
                };

                // Update wallet balance
                wallet.Balance -= totalAmount;
                wallet.UpdatedAt = DateTime.Now;

                // Update order status
                order.Status = "Paid";

                _context.WalletTransactions.Add(walletTransaction);
                _context.Wallets.Update(wallet);
                _context.Order.Update(order);

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Order paid successfully with wallet",
                    transactionId = transactionId,
                    orderId = order.OrderId,
                    amountPaid = totalAmount,
                    remainingBalance = wallet.Balance
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred during wallet payment", error = ex.Message });
            }
        }

        private async Task<Wallet> GetOrCreateWallet(string userId)
        {
            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
            
            if (wallet == null)
            {
                wallet = new Wallet
                {
                    WalletId = Guid.NewGuid().ToString(),
                    UserId = userId,
                    Balance = 0,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now,
                    IsActive = 1
                };

                _context.Wallets.Add(wallet);
                await _context.SaveChangesAsync();
            }

            return wallet;
        }

        [HttpGet("payment-info")]
        public IActionResult GetPaymentInfo()
        {
            try
            {
                var bankAccount = _configuration.GetSection("AdminBankAccount").Get<AdminBankAccount>();

                return Ok(bankAccount);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred during wallet payment", error = ex.Message });
            }
        }

        // Admin endpoints for managing wallet charges
        [HttpGet("admin/charges")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> GetWalletCharges([FromQuery] string? status = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null)
        {
            try
            {
                var query = _context.WalletTransactions
                    .Include(wt => wt.Wallet)
                    .ThenInclude(w => w.User)
                    .Where(wt => wt.TransactionType == "CHARGE")
                    .AsQueryable();

                // Apply filters
                if (!string.IsNullOrEmpty(status))
                {
                    query = query.Where(wt => wt.Status.ToLower() == status.ToLower());
                }

                if (dateFrom.HasValue)
                {
                    query = query.Where(wt => wt.CreatedAt >= dateFrom.Value);
                }

                if (dateTo.HasValue)
                {
                    query = query.Where(wt => wt.CreatedAt <= dateTo.Value.AddDays(1));
                }

                var charges = await query
                    .OrderByDescending(wt => wt.CreatedAt)
                    .Select(wt => new
                    {
                        transactionId = wt.TransactionId,
                        userName = wt.Wallet.User.Name ?? "Unknown User",
                        userEmail = wt.Wallet.User.Email ?? "Unknown Email",
                        amount = wt.Amount,
                        paymentMethod = wt.PaymentMethod ?? "Banking",
                        createdAt = wt.CreatedAt,
                        status = wt.Status,
                        description = wt.Description,
                        externalTransactionId = wt.ExternalTransactionId,
                        completedAt = wt.CompletedAt
                    })
                    .ToListAsync();

                return Ok(new { charges = charges });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving wallet charges", error = ex.Message });
            }
        }

        [HttpGet("admin/statistics")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> GetWalletStatistics()
        {
            try
            {
                var today = DateTime.Today;
                var tomorrow = today.AddDays(1);

                var pendingCount = await _context.WalletTransactions
                    .Where(wt => wt.TransactionType == "CHARGE" && wt.Status == "PENDING")
                    .CountAsync();

                var approvedTodayCount = await _context.WalletTransactions
                    .Where(wt => wt.TransactionType == "CHARGE" && wt.Status == "COMPLETED" && 
                                wt.CompletedAt >= today && wt.CompletedAt < tomorrow)
                    .CountAsync();

                var rejectedTodayCount = await _context.WalletTransactions
                    .Where(wt => wt.TransactionType == "CHARGE" && wt.Status == "FAILED" && 
                                wt.CompletedAt >= today && wt.CompletedAt < tomorrow)
                    .CountAsync();

                var totalAmountToday = await _context.WalletTransactions
                    .Where(wt => wt.TransactionType == "CHARGE" && wt.Status == "COMPLETED" && 
                                wt.CompletedAt >= today && wt.CompletedAt < tomorrow)
                    .SumAsync(wt => wt.Amount);

                return Ok(new
                {
                    pendingCount = pendingCount,
                    approvedTodayCount = approvedTodayCount,
                    rejectedTodayCount = rejectedTodayCount,
                    totalAmountToday = totalAmountToday
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving statistics", error = ex.Message });
            }
        }

        [HttpPost("admin/approve/{transactionId}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> ApproveWalletCharge(string transactionId, [FromBody] ApproveChargeRequest request)
        {
            try
            {
                var transaction = await _context.WalletTransactions
                    .Include(wt => wt.Wallet)
                    .FirstOrDefaultAsync(wt => wt.TransactionId == transactionId && wt.TransactionType == "CHARGE");

                if (transaction == null)
                    return NotFound(new { message = "Transaction not found" });

                if (transaction.Status != "PENDING")
                    return BadRequest(new { message = "Transaction is not in pending status" });

                // Update transaction status
                transaction.Status = "COMPLETED";
                transaction.CompletedAt = DateTime.Now;
                if (!string.IsNullOrEmpty(request.Note))
                {
                    transaction.Description = $"{transaction.Description} | Admin Note: {request.Note}";
                }

                // Update wallet balance
                if (transaction.Wallet != null)
                {
                    transaction.Wallet.Balance += transaction.Amount;
                    transaction.Wallet.UpdatedAt = DateTime.Now;
                    transaction.BalanceAfter = transaction.Wallet.Balance;
                }

                _context.WalletTransactions.Update(transaction);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Wallet charge approved successfully",
                    transactionId = transactionId,
                    newBalance = transaction.BalanceAfter
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while approving wallet charge", error = ex.Message });
            }
        }

        [HttpPost("admin/reject/{transactionId}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> RejectWalletCharge(string transactionId, [FromBody] RejectChargeRequest request)
        {
            try
            {
                var transaction = await _context.WalletTransactions
                    .FirstOrDefaultAsync(wt => wt.TransactionId == transactionId && wt.TransactionType == "CHARGE");

                if (transaction == null)
                    return NotFound(new { message = "Transaction not found" });

                if (transaction.Status != "PENDING")
                    return BadRequest(new { message = "Transaction is not in pending status" });

                if (string.IsNullOrEmpty(request.Reason))
                    return BadRequest(new { message = "Rejection reason is required" });

                // Update transaction status
                transaction.Status = "FAILED";
                transaction.CompletedAt = DateTime.Now;
                transaction.Description = $"{transaction.Description} | Rejected: {request.Reason}";
                if (!string.IsNullOrEmpty(request.Note))
                {
                    transaction.Description += $" | Note: {request.Note}";
                }

                _context.WalletTransactions.Update(transaction);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Wallet charge rejected successfully",
                    transactionId = transactionId,
                    reason = request.Reason
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while rejecting wallet charge", error = ex.Message });
            }
        }

    }

    // Request models
    public class RechargeRequest
    {
        public double Amount { get; set; }
        public string? Description { get; set; }
    }

    public class PayOrderRequest
    {
        public string OrderId { get; set; } = string.Empty;
    }
    public class AdminBankAccount
    {
        public string BankName { get; set; }
        public string AccountNumber { get; set; }
        public string AccountHolderName { get; set; }
        public string? VietQrClientId { get; set; }
        public string? VietQrApiKey { get; set; }
    }

    public class ApproveChargeRequest
    {
        public string? Note { get; set; }
    }

    public class RejectChargeRequest
    {
        public string Reason { get; set; } = string.Empty;
        public string? Note { get; set; }
    }
} 