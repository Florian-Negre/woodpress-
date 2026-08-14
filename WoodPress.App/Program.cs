using System;
using System.Diagnostics;
using System.IO;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using WoodPress.Core.Models;
using WoodPress.Core.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});
builder.Services.AddSingleton<ConfigManagerService>();
builder.Services.AddSingleton<ProjectScanner>();

var app = builder.Build();

app.UseCors();

// Utilisation du ManifestEmbeddedFileProvider pour lire les fichiers statiques UI embarqués dans l'assembly C#
var assembly = typeof(Program).Assembly;
var embeddedProvider = new ManifestEmbeddedFileProvider(assembly, "wwwroot");

app.UseDefaultFiles(new DefaultFilesOptions
{
    FileProvider = embeddedProvider
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = embeddedProvider
});

var configService = app.Services.GetRequiredService<ConfigManagerService>();
var scannerService = app.Services.GetRequiredService<ProjectScanner>();

// ==========================================
// ROUTES API REST NATIVES C# (.NET 8)
// ==========================================

// 0. Configuration
app.MapGet("/api/config", () => Results.Ok(configService.LoadConfig()));

app.MapPost("/api/config/settings", (AppConfig newSettings) =>
{
    var config = configService.LoadConfig();
    config.PreferredIde = newSettings.PreferredIde ?? config.PreferredIde;
    config.CustomIdePath = newSettings.CustomIdePath ?? config.CustomIdePath;
    config.Theme = newSettings.Theme ?? config.Theme;
    configService.SaveConfig(config);
    return Results.Ok(new { success = true, config });
});

// 1. Scan et projets découverts
app.MapGet("/api/projects/scan", async () =>
{
    var discovered = await scannerService.ScanAllWorkspacesAsync();
    return Results.Ok(discovered);
});

// 2. Ouvrir dans l'IDE
app.MapPost("/api/projects/{id}/open-ide", async (string id, HttpContext context) =>
{
    var body = await context.Request.ReadFromJsonAsync<ProjectInfo>();
    string? projectDir = body?.ProjectDir;

    if (string.IsNullOrEmpty(projectDir))
    {
        var discovered = await scannerService.ScanAllWorkspacesAsync();
        var match = discovered.Find(p => p.Id == id);
        projectDir = match?.ProjectDir;
    }

    if (string.IsNullOrEmpty(projectDir) || !Directory.Exists(projectDir))
    {
        return Results.NotFound(new { error = "Dossier projet introuvable." });
    }

    var config = configService.LoadConfig();
    bool launched = IdeLauncherService.OpenProjectInIde(projectDir, config.PreferredIde, config.CustomIdePath);

    return Results.Ok(new { success = launched, ide = config.PreferredIde, openedPath = projectDir });
});

// 3. Ouvrir le dossier dans l'explorateur Windows
app.MapPost("/api/projects/{id}/open-folder", async (string id, HttpContext context) =>
{
    var body = await context.Request.ReadFromJsonAsync<ProjectInfo>();
    string? projectDir = body?.ProjectDir;

    if (string.IsNullOrEmpty(projectDir))
    {
        var discovered = await scannerService.ScanAllWorkspacesAsync();
        var match = discovered.Find(p => p.Id == id);
        projectDir = match?.ProjectDir;
    }

    if (string.IsNullOrEmpty(projectDir) || !Directory.Exists(projectDir))
    {
        return Results.NotFound(new { error = "Dossier projet introuvable." });
    }

    Process.Start("explorer.exe", $"\"{projectDir}\"");
    return Results.Ok(new { success = true, openedPath = projectDir });
});

// 4. Exportation au format propriétaire .AZF
app.MapPost("/api/projects/{id}/export-azf", async (string id, HttpContext context) =>
{
    var body = await context.Request.ReadFromJsonAsync<ProjectInfo>();
    if (body == null || string.IsNullOrEmpty(body.ProjectDir))
    {
        return Results.BadRequest(new { error = "Données projet requises." });
    }

    string exportDir = Path.Combine(body.ProjectDir, "exports");
    string azfFile = await AzfArchiveService.CreateAzfPackageAsync(body, exportDir);

    Process.Start("explorer.exe", $"\"{exportDir}\"");
    return Results.Ok(new { success = true, azfFile });
});

int httpPort = 3741;
while (!PortScannerService.IsPortAvailable(httpPort) && httpPort < 3750)
{
    httpPort++;
}

// Lancement automatique du navigateur sur l'interface
_ = Task.Run(async () =>
{
    await Task.Delay(800);
    try
    {
        Process.Start(new ProcessStartInfo { FileName = $"http://localhost:{httpPort}", UseShellExecute = true });
    }
    catch { }
});

app.Run($"http://localhost:{httpPort}");
