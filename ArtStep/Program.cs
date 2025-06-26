using ArtStep.Data;
using ArtStep.Hubs;
using CloudinaryDotNet;
using dotenv.net;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Rewrite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Text;
using System.Text.Json.Serialization;
using VNPAY.NET;
using Microsoft.Extensions.Azure;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHttpClient();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.MaxDepth = 32;
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
    });

// Enhanced SignalR configuration
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    options.HandshakeTimeout = TimeSpan.FromSeconds(15);
    options.StreamBufferCapacity = 10;
});

// Set Cloudinary credentials
var cloudinaryUrl = "cloudinary://197416554857625:K45aVL5lAnF2Tz0MbWc-X0jw5Wo@dx4ghr0fn";
var cloudinary = new Cloudinary(cloudinaryUrl)
{
    Api = { Secure = true }
};

builder.Services.AddSingleton(cloudinary);

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<IVnpay, Vnpay>();
builder.Services.AddMemoryCache();
var connectionString = builder.Configuration.GetConnectionString("MyDatabase");
builder.Services.AddDbContext<ArtStepDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString))
);

// Enhanced JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            Convert.FromBase64String(builder.Configuration["Jwt:Key"])
        ),
        ClockSkew = TimeSpan.Zero
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) &&
                (path.StartsWithSegments("/chatHub") || path.StartsWithSegments("/hubs")))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        },
        OnAuthenticationFailed = context =>
        {
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(
                "https://localhost:7216",
                "http://localhost:5155",
                "https://localhost:5155",
                "http://www.artstep.somee.com"
              )
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()
              .SetIsOriginAllowed(origin => true); 
    });
});
builder.Services.AddAzureClients(clientBuilder =>
{
    clientBuilder.AddBlobServiceClient(builder.Configuration["StorageConnection:blobServiceUri"]!).WithName("StorageConnection");
    clientBuilder.AddQueueServiceClient(builder.Configuration["StorageConnection:queueServiceUri"]!).WithName("StorageConnection");
    clientBuilder.AddTableServiceClient(builder.Configuration["StorageConnection:tableServiceUri"]!).WithName("StorageConnection");
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseDeveloperExceptionPage();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

var rewriteOptions = new RewriteOptions()
     .Add(context =>
     {
         var path = context.HttpContext.Request.Path.Value;
         if (!string.IsNullOrEmpty(path) && !path.StartsWith("/chatHub") && !path.StartsWith("/api"))
         {
             var cleanPath = path.TrimStart('/');
             if (!cleanPath.Contains('.') && !string.IsNullOrEmpty(cleanPath))
             {
                 context.HttpContext.Request.Path = $"/{cleanPath}.html";
             }
             else if (cleanPath.EndsWith(".html"))
             {
                 context.HttpContext.Request.Path = $"/{cleanPath}";
             }
         }
     });
app.UseRewriter(rewriteOptions);

app.UseDefaultFiles(new DefaultFilesOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "html")
    ),
    RequestPath = "",
    DefaultFileNames = new List<string> { "home.html" }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "html")
    ),
    RequestPath = ""
});

app.UseStaticFiles();
app.UseWebSockets(new Microsoft.AspNetCore.Builder.WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(15)
});
app.UseStatusCodePages(async context =>
{
    var response = context.HttpContext.Response;

    if (response.StatusCode == 404)
    {
        response.ContentType = "text/html";
        await response.SendFileAsync("wwwroot/html/page/404error.html");
    }
});

app.UseStatusCodePages(async context =>
{
    var request = context.HttpContext.Request;
    var response = context.HttpContext.Response;

    if (response.StatusCode == 404 &&
        request.Headers["Accept"].ToString().Contains("text/html"))
    {
        response.ContentType = "text/html";
        await response.SendFileAsync("wwwroot/html/page/404error.html");
    }
});

app.UseExceptionHandler(errorApp =>
{
errorApp.Run(async context =>
{
    var response = context.Response;
    var request = context.Request;

    response.StatusCode = 500;

    // Trả HTML nếu browser (Accept: text/html)
    if (request.Headers["Accept"].ToString().Contains("text/html"))
    {
        response.ContentType = "text/html";
        await context.Response.SendFileAsync("wwwroot/html/page/500error.html");
    }
    else
    {
        // Trả JSON nếu là API
        response.ContentType = "application/json";
        await context.Response.WriteAsync("{\"status\":500,\"message\":\"Internal Server Error\"}");
    }
 });
});
app.UseRouting();
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/chatHub");

app.Run();