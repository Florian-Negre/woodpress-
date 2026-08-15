using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using WoodPress.Core.Models;

namespace WoodPress.Core.Services
{
    public class PluginItemInfo
    {
        public string Name { get; set; } = string.Empty;
        public string Version { get; set; } = "1.0.0";
        public string Status { get; set; } = "Non vérifié";
        public string Author { get; set; } = "Inconnu";
    }

    public static class PluginAuditService
    {
        public static (List<PluginItemInfo> plugins, List<PluginItemInfo> themes) AuditProject(ProjectInfo project)
        {
            var plugins = new List<PluginItemInfo>();
            var themes = new List<PluginItemInfo>();

            if (project == null) return (plugins, themes);

            string projectDir = project.ProjectDir ?? string.Empty;
            string containerName = $"{project.ProjectName}-wp";

            // 1. Essayer via Docker Exec (WP-CLI dans le conteneur si allumé)
            if (project.IsRunning && !string.IsNullOrEmpty(containerName))
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"exec {containerName} wp plugin list --format=json --allow-root",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psi))
                    {
                        if (proc != null)
                        {
                            string json = proc.StandardOutput.ReadToEnd();
                            string err = proc.StandardError.ReadToEnd();
                            proc.WaitForExit(4000);
                            if (proc.ExitCode == 0 && !string.IsNullOrWhiteSpace(json))
                            {
                                using (var doc = JsonDocument.Parse(json))
                                {
                                    foreach (var elem in doc.RootElement.EnumerateArray())
                                    {
                                        string name = elem.GetProperty("name").GetString() ?? "Plugin";
                                        string status = elem.GetProperty("status").GetString() ?? "active";
                                        string ver = elem.GetProperty("version").GetString() ?? "1.0.0";
                                        string update = elem.TryGetProperty("update", out var u) ? u.GetString() ?? "none" : "none";

                                        string statusLabel = status == "active" ? "🟢 Actif" : "⚪ Inactif";
                                        if (update == "available") statusLabel += " (⚠️ MAJ dispo)";

                                        plugins.Add(new PluginItemInfo { Name = name, Version = ver, Status = statusLabel, Author = "WP-CLI" });
                                    }
                                }
                            }
                        }
                    }
                }
                catch { }

                // Scan Thèmes via WP-CLI
                try
                {
                    var psiTheme = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"exec {containerName} wp theme list --format=json --allow-root",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psiTheme))
                    {
                        if (proc != null)
                        {
                            string json = proc.StandardOutput.ReadToEnd();
                            proc.WaitForExit(4000);
                            if (proc.ExitCode == 0 && !string.IsNullOrWhiteSpace(json))
                            {
                                using (var doc = JsonDocument.Parse(json))
                                {
                                    foreach (var elem in doc.RootElement.EnumerateArray())
                                    {
                                        string name = elem.GetProperty("name").GetString() ?? "Theme";
                                        string status = elem.GetProperty("status").GetString() ?? "inactive";
                                        string ver = elem.GetProperty("version").GetString() ?? "1.0.0";
                                        string update = elem.TryGetProperty("update", out var u) ? u.GetString() ?? "none" : "none";

                                        string statusLabel = status == "active" ? "🟢 Thème Actif" : "⚪ Thème Inactif";
                                        if (update == "available") statusLabel += " (⚠️ MAJ dispo)";

                                        themes.Add(new PluginItemInfo { Name = name, Version = ver, Author = "WP-CLI", Status = statusLabel });
                                    }
                                }
                            }
                        }
                    }
                }
                catch { }
            }

            // 2. Si WP-CLI n'a rien renvoyé (conteneur éteint ou sans wp-cli), scanner les disques avec DÉDUPLICATION
            if (plugins.Count == 0 && !string.IsNullOrEmpty(projectDir) && Directory.Exists(projectDir))
            {
                var seenPlugins = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                var possiblePluginDirs = new[]
                {
                    Path.Combine(projectDir, "wp-content", "plugins"),
                    Path.Combine(projectDir, "wp-content-mirror", "plugins"),
                    Path.Combine(projectDir, "wordpress", "wp-content", "plugins")
                };

                foreach (var pDir in possiblePluginDirs)
                {
                    if (Directory.Exists(pDir))
                    {
                        foreach (var dir in Directory.GetDirectories(pDir))
                        {
                            string folderName = Path.GetFileName(dir);
                            if (seenPlugins.Contains(folderName)) continue;

                            string pName = folderName;
                            string version = "1.0.0";

                            var phpFiles = Directory.GetFiles(dir, "*.php", SearchOption.TopDirectoryOnly);
                            foreach (var file in phpFiles)
                            {
                                try
                                {
                                    string content = File.ReadAllText(file);
                                    if (content.Contains("Plugin Name:"))
                                    {
                                        var matchVer = Regex.Match(content, @"Version:\s*([0-9\.]+)");
                                        if (matchVer.Success) version = matchVer.Groups[1].Value;

                                        var matchName = Regex.Match(content, @"Plugin Name:\s*([^\r\n]+)");
                                        if (matchName.Success) pName = matchName.Groups[1].Value.Trim();

                                        break;
                                    }
                                }
                                catch { }
                            }

                            seenPlugins.Add(folderName);
                            plugins.Add(new PluginItemInfo { Name = pName, Version = version, Status = "Présent sur disque", Author = "Fichier local" });
                        }
                        break; // S'arrêter au premier dossier de plugins trouvé pour éviter les doublons
                    }
                }
            }

            // 3. Scan des thèmes sur disque si non trouvés via WP-CLI
            if (themes.Count == 0 && !string.IsNullOrEmpty(projectDir) && Directory.Exists(projectDir))
            {
                var seenThemes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                var possibleThemeDirs = new[]
                {
                    Path.Combine(projectDir, "wp-content", "themes"),
                    Path.Combine(projectDir, "wp-content-mirror", "themes"),
                    Path.Combine(projectDir, "wordpress", "wp-content", "themes")
                };

                foreach (var tDir in possibleThemeDirs)
                {
                    if (Directory.Exists(tDir))
                    {
                        foreach (var dir in Directory.GetDirectories(tDir))
                        {
                            string folderName = Path.GetFileName(dir);
                            if (seenThemes.Contains(folderName)) continue;

                            string tName = folderName;
                            string version = "1.0.0";
                            string author = "Inconnu";

                            string styleCss = Path.Combine(dir, "style.css");
                            if (File.Exists(styleCss))
                            {
                                try
                                {
                                    string content = File.ReadAllText(styleCss);
                                    var matchName = Regex.Match(content, @"Theme Name:\s*([^\r\n]+)");
                                    if (matchName.Success) tName = matchName.Groups[1].Value.Trim();

                                    var matchVer = Regex.Match(content, @"Version:\s*([0-9\.]+)");
                                    if (matchVer.Success) version = matchVer.Groups[1].Value;

                                    var matchAuth = Regex.Match(content, @"Author:\s*([^\r\n]+)");
                                    if (matchAuth.Success) author = matchAuth.Groups[1].Value.Trim();
                                }
                                catch { }
                            }

                            seenThemes.Add(folderName);
                            themes.Add(new PluginItemInfo { Name = tName, Version = version, Author = author, Status = "Présent sur disque" });
                        }
                        break; // S'arrêter au premier dossier de thèmes trouvé pour éviter les doublons
                    }
                }
            }

            // AUCUNE FAUSSE EXTENSION N'EST INJECTÉE ICI.

            return (plugins, themes);
        }
    }
}
