using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using WoodPress.Core.Models;

namespace WoodPress.Core.Services
{
    public class PluginItemInfo
    {
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string LocalVersion { get; set; } = "1.0.0";
        public string RemoteVersion { get; set; } = "—";
        public string Status { get; set; } = "🟢 À jour";
        public string StatusColor { get; set; } = "#22c55e";
        public string RiskLevel { get; set; } = "Aucun";
        public string RiskColor { get; set; } = "#22c55e";
        public string Author { get; set; } = "Inconnu";
    }

    public class ProjectAuditReport
    {
        public int HealthScore { get; set; } = 100;
        public string HealthSummary { get; set; } = "Site 100% Sain";
        public string CurrentWpVersion { get; set; } = "7.0.4";
        public string LatestWpVersion { get; set; } = "7.0.4";
        public bool NeedsCoreUpdate { get; set; } = false;
        public List<PluginItemInfo> Plugins { get; set; } = new();
        public List<PluginItemInfo> Themes { get; set; } = new();
    }

    public static class PluginAuditService
    {
        public static async Task<ProjectAuditReport> AuditProjectAsync(ProjectInfo project)
        {
            var report = new ProjectAuditReport();
            if (project == null) return report;

            report.CurrentWpVersion = project.WpVersion;
            report.LatestWpVersion = await WordpressOrgApiService.GetLatestWordPressVersionAsync();
            report.NeedsCoreUpdate = CompareVersions(report.CurrentWpVersion, report.LatestWpVersion) < 0;

            string projectDir = project.ProjectDir ?? string.Empty;
            string containerName = $"{project.ProjectName}-wp";

            var plugins = new List<PluginItemInfo>();
            var themes = new List<PluginItemInfo>();

            // 1. Audit via WP-CLI si conteneur en ligne
            if (project.IsRunning)
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
                            string json = await proc.StandardOutput.ReadToEndAsync();
                            await proc.WaitForExitAsync();
                            if (proc.ExitCode == 0 && !string.IsNullOrWhiteSpace(json))
                            {
                                using (var doc = JsonDocument.Parse(json))
                                {
                                    foreach (var elem in doc.RootElement.EnumerateArray())
                                    {
                                        string slug = elem.GetProperty("name").GetString() ?? "plugin";
                                        string title = elem.TryGetProperty("title", out var t) ? t.GetString() ?? slug : slug;
                                        string ver = elem.GetProperty("version").GetString() ?? "1.0.0";
                                        string updateVer = elem.TryGetProperty("update_version", out var uv) ? uv.GetString() ?? "" : "";
                                        string status = elem.GetProperty("status").GetString() ?? "active";

                                        var item = new PluginItemInfo
                                        {
                                            Name = title,
                                            Slug = slug,
                                            LocalVersion = ver,
                                            Author = "WordPress.org"
                                        };

                                        if (!string.IsNullOrEmpty(updateVer) && updateVer != ver)
                                        {
                                            item.RemoteVersion = updateVer;
                                            item.Status = $"⚠️ MAJ dispo ({updateVer})";
                                            item.StatusColor = "#f59e0b";
                                            EvaluateRisk(item, ver, updateVer);
                                        }
                                        else
                                        {
                                            item.RemoteVersion = ver;
                                            item.Status = status == "active" ? "🟢 Actif & À jour" : "⚪ Inactif & À jour";
                                            item.StatusColor = "#22c55e";
                                            item.RiskLevel = "Aucun";
                                            item.RiskColor = "#22c55e";
                                        }

                                        plugins.Add(item);
                                    }
                                }
                            }
                        }
                    }
                }
                catch { }
            }

            // 2. Scan des disques avec déduplication et vérification API wordpress.org
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
                            string author = "Inconnu";

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

                                        var matchAuth = Regex.Match(content, @"Author:\s*([^\r\n]+)");
                                        if (matchAuth.Success) author = matchAuth.Groups[1].Value.Trim();

                                        break;
                                    }
                                }
                                catch { }
                            }

                            seenPlugins.Add(folderName);

                            var item = new PluginItemInfo
                            {
                                Name = pName,
                                Slug = folderName,
                                LocalVersion = version,
                                Author = author
                            };

                            // Comparaison en direct avec wordpress.org
                            string? remoteVer = await WordpressOrgApiService.GetLatestPluginVersionAsync(folderName);
                            if (!string.IsNullOrEmpty(remoteVer))
                            {
                                item.RemoteVersion = remoteVer;
                                if (CompareVersions(version, remoteVer) < 0)
                                {
                                    item.Status = $"⚠️ MAJ dispo ({remoteVer})";
                                    item.StatusColor = "#f59e0b";
                                    EvaluateRisk(item, version, remoteVer);
                                }
                                else
                                {
                                    item.Status = "🟢 À jour";
                                    item.StatusColor = "#22c55e";
                                    item.RiskLevel = "Aucun";
                                    item.RiskColor = "#22c55e";
                                }
                            }
                            else
                            {
                                item.Status = "⚪ Extension Personnalisée";
                                item.StatusColor = "#94a3b8";
                                item.RemoteVersion = "Interne";
                                item.RiskLevel = "Non audité";
                                item.RiskColor = "#94a3b8";
                            }

                            plugins.Add(item);
                        }
                        break;
                    }
                }
            }

            // 3. Scan des thèmes
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

                            var item = new PluginItemInfo
                            {
                                Name = tName,
                                Slug = folderName,
                                LocalVersion = version,
                                Author = author
                            };

                            string? remoteVer = await WordpressOrgApiService.GetLatestThemeVersionAsync(folderName);
                            if (!string.IsNullOrEmpty(remoteVer))
                            {
                                item.RemoteVersion = remoteVer;
                                if (CompareVersions(version, remoteVer) < 0)
                                {
                                    item.Status = $"⚠️ MAJ dispo ({remoteVer})";
                                    item.StatusColor = "#f59e0b";
                                    EvaluateRisk(item, version, remoteVer);
                                }
                                else
                                {
                                    item.Status = "🟢 À jour";
                                    item.StatusColor = "#22c55e";
                                    item.RiskLevel = "Aucun";
                                    item.RiskColor = "#22c55e";
                                }
                            }
                            else
                            {
                                item.Status = "⚪ Thème Personnalisé";
                                item.StatusColor = "#94a3b8";
                                item.RemoteVersion = "Interne";
                                item.RiskLevel = "Non audité";
                                item.RiskColor = "#94a3b8";
                            }

                            themes.Add(item);
                        }
                        break;
                    }
                }
            }

            report.Plugins = plugins;
            report.Themes = themes;

            // Calcul du Score de Santé
            int totalItems = plugins.Count + themes.Count + (report.NeedsCoreUpdate ? 1 : 0);
            int outdatedItems = 0;

            foreach (var p in plugins) if (p.Status.Contains("MAJ dispo")) outdatedItems++;
            foreach (var t in themes) if (t.Status.Contains("MAJ dispo")) outdatedItems++;
            if (report.NeedsCoreUpdate) outdatedItems++;

            if (totalItems > 0)
            {
                report.HealthScore = Math.Max(0, 100 - (int)((double)outdatedItems / totalItems * 100));
            }
            else
            {
                report.HealthScore = 100;
            }

            if (outdatedItems == 0)
            {
                report.HealthSummary = $"Site 100% Sain & À jour 🛡️";
            }
            else
            {
                report.HealthSummary = $"{outdatedItems} mise(s) à jour recommandée(s) ⚠️";
            }

            return report;
        }

        private static void EvaluateRisk(PluginItemInfo item, string localVer, string remoteVer)
        {
            var lParts = localVer.Split('.');
            var rParts = remoteVer.Split('.');

            if (lParts.Length > 0 && rParts.Length > 0 && lParts[0] != rParts[0])
            {
                item.RiskLevel = "🔴 Risque Majeur (Saut de version)";
                item.RiskColor = "#ef4444";
            }
            else
            {
                item.RiskLevel = "🟡 Mineur / Sécurité";
                item.RiskColor = "#f59e0b";
            }
        }

        private static int CompareVersions(string v1, string v2)
        {
            try
            {
                var clean1 = Regex.Replace(v1, @"[^\d\.]", "");
                var clean2 = Regex.Replace(v2, @"[^\d\.]", "");
                var ver1 = new Version(clean1.Contains('.') ? clean1 : clean1 + ".0");
                var ver2 = new Version(clean2.Contains('.') ? clean2 : clean2 + ".0");
                return ver1.CompareTo(ver2);
            }
            catch
            {
                return string.Compare(v1, v2, StringComparison.OrdinalIgnoreCase);
            }
        }
    }
}
