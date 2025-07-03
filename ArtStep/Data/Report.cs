using ArtStep.Data;

public class Report
{
    public int ReportId { get; set; }

    public string ReporterId { get; set; }
    public string ReporterRole { get; set; }

    public string Subject { get; set; }
    public string Description { get; set; }

    public string ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; }

    public string Status { get; set; }

    public User Reporter { get; set; }
}
