using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using WoodPress.Core.Models;

namespace WoodPress.Core.Services
{
    public class ProjectScanner
    {
        private readonly ConfigManagerService _configService;

        public ProjectScanner(ConfigManagerService configService)
        {
            _configService = configService;
        }

        public async Task<List<ProjectInfo>> ScanAllWorkspacesAsync()
        {
            var config = _configService.GetConfig();
            var discovered = new List<ProjectInfo>();
            var existingProjects = _configService.LoadProjects();
            var existingMap = new Dictionary<string, ProjectInfo>(StringComparer.OrdinalIgnoreCase);

            foreach (var p in existingProjects)
            {
                if (!string.IsNullOrWhiteSpace(p.ProjectDir))
                {
                    existingMap[p.ProjectDir] = p;
                }
            }

            // 1. Scan Workspace Pro (G:\Workspace)
            if (Directory.Exists(config.WorkspaceProPath))
            {
                ScanDirectory(config.WorkspaceProPath, "workspace", existingMap, discovered);
            }

            // 2. Scan Learnspace (E:\E-Dev ou E:\E-Dev\WordPress)
            if (Directory.Exists(config.LearningWorkspacePath))
            {
                ScanDirectory(config.LearningWorkspacePath, "learning", existingMap, discovered);
            }

            // 3. Persister la liste des projets scannés
            _configService.SaveProjects(discovered);

            return discovered;
        }

        private void ScanDirectory(string rootPath, string type, Dictionary<string, ProjectInfo> existingMap, List<ProjectInfo> results)
        {
            try
            {
                foreach (var dir in Directory.GetDirectories(rootPath))
                {
                    string dirName = Path.GetFileName(dir);
                    if (dirName.StartsWith(".") || dirName.Equals("node_modules", StringComparison.OrdinalIgnoreCase))
                        continue;

                    // Si c'est un dossier client regroupant plusieurs projets (ex: 01-Client)
                    if (dirName.StartsWith("01-") || dirName.Contains("Client", StringComparison.OrdinalIgnoreCase))
                    {
                        try
                        {
                            foreach (var subDir in Directory.GetDirectories(dir))
                            {
                                if (IsWordPressProject(subDir))
                                {
                                    existingMap.TryGetValue(subDir, out var existing);
                                    results.Add(AnalyzeProject(subDir, type, $"{dirName}/{Path.GetFileName(subDir)}", existing));
                                }
                            }
                        }
                        catch { }
                        continue;
                    }

                    if (IsWordPressProject(dir))
                    {
                        existingMap.TryGetValue(dir, out var existing);
                        results.Add(AnalyzeProject(dir, type, dirName, existing));
                    }
                }
            }
            catch { }
        }

        private bool IsWordPressProject(string dirPath)
        {
            return File.Exists(Path.Combine(dirPath, "wp-config.php")) ||
                   File.Exists(Path.Combine(dirPath, "docker-compose.yml")) ||
                   Directory.Exists(Path.Combine(dirPath, "wp-content")) ||
                   Directory.Exists(Path.Combine(dirPath, "wp-includes")) ||
                   Directory.Exists(Path.Combine(dirPath, "wordpress")) ||
                   Directory.Exists(Path.Combine(dirPath, "wp-content-mirror"));
        }

        private ProjectInfo AnalyzeProject(string dirPath, string type, string displayName, ProjectInfo? existing)
        {
            string composeDir = dirPath;
            if (!File.Exists(Path.Combine(dirPath, "docker-compose.yml")) && Directory.Exists(Path.Combine(dirPath, "docker")))
            {
                composeDir = Path.Combine(dirPath, "docker");
            }

            bool hasDocker = File.Exists(Path.Combine(composeDir, "docker-compose.yml"));
            int httpPort = 0;
            int dbPort = 0;
            int pmaPort = 0;
            int mailPort = 0;
            string phpVersion = "8.4";

            // 1. Analyse approfondie de docker-compose.yml
            if (hasDocker)
            {
                try
                {
                    string composeText = File.ReadAllText(Path.Combine(composeDir, "docker-compose.yml"));

                    // Ports HTTP
                    var portMatch = Regex.Match(composeText, @"[""']?(\d+):80[""']?");
                    if (portMatch.Success && int.TryParse(portMatch.Groups[1].Value, out int pHttp)) httpPort = pHttp;

                    // Ports MySQL
                    var dbMatch = Regex.Match(composeText, @"[""']?(\d+):3306[""']?");
                    if (dbMatch.Success && int.TryParse(dbMatch.Groups[1].Value, out int pDb)) dbPort = pDb;

                    // Ports PhpMyAdmin
                    var pmaMatch = Regex.Match(composeText, @"[""']?(\d+):(80|8080|8081)[""']?");
                    if (pmaMatch.Success && int.TryParse(pmaMatch.Groups[1].Value, out int pPma) && pPma != httpPort) pmaPort = pPma;

                    // Ports Mailpit
                    var mailMatch = Regex.Match(composeText, @"[""']?(\d+):8025[""']?");
                    if (mailMatch.Success && int.TryParse(mailMatch.Groups[1].Value, out int pMail)) mailPort = pMail;

                    // Version PHP depuis l'image docker
                    var phpMatch = Regex.Match(composeText, @"wordpress:(?:php)?([0-9\.]+)(?:-apache)?");
                    if (phpMatch.Success) phpVersion = phpMatch.Groups[1].Value;
                }
                catch { }
            }

            // 2. Détection de la VRAIE version WordPress sur Disque (wp-includes/version.php)
            string? foundWpVersion = null;
            string[] searchPaths = new[]
            {
                Path.Combine(dirPath, "wp-includes", "version.php"),
                Path.Combine(dirPath, "wordpress", "wp-includes", "version.php"),
                Path.Combine(dirPath, "public", "wp-includes", "version.php"),
                Path.Combine(dirPath, "src", "wp-includes", "version.php"),
                Path.Combine(dirPath, "app", "wp-includes", "version.php")
            };

            foreach (var vFile in searchPaths)
            {
                if (File.Exists(vFile))
                {
                    try
                    {
                        string content = File.ReadAllText(vFile);
                        var match = Regex.Match(content, @"\$wp_version\s*=\s*['""]([^'""]+)['""]");
                        if (match.Success)
                        {
                            foundWpVersion = match.Groups[1].Value.Trim();
                            break;
                        }
                    }
                    catch { }
                }
            }

            // 3. Si non trouvé sur disque, vérifier via WP-CLI Docker si disponible
            string projectName = existing?.ProjectName ?? Path.GetFileName(dirPath);
            if (string.IsNullOrEmpty(foundWpVersion) && hasDocker)
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"exec {projectName}-wp wp core version",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psi))
                    {
                        if (proc != null)
                        {
                            string output = proc.StandardOutput.ReadToEnd().Trim();
                            proc.WaitForExit(2000);
                            if (proc.ExitCode == 0 && !string.IsNullOrWhiteSpace(output) && Regex.IsMatch(output, @"^[0-9\.]+"))
                            {
                                foundWpVersion = output;
                            }
                        }
                    }
                }
                catch { }
            }

            string finalWpVersion = foundWpVersion ?? "6.7.2";

            return new ProjectInfo
            {
                Id = existing?.Id ?? $"discovered_{Convert.ToHexString(System.Text.Encoding.UTF8.GetBytes(dirPath))[..12]}",
                ProjectName = projectName,
                ClientName = existing?.ClientName ?? displayName,
                ProjectDir = dirPath,
                ComposeDir = composeDir,
                Type = existing?.Type ?? type,
                HttpPort = httpPort > 0 ? httpPort : (existing?.HttpPort > 0 ? existing.HttpPort : 8081),
                DbPort = dbPort > 0 ? dbPort : (existing?.DbPort > 0 ? existing.DbPort : 3307),
                PmaPort = pmaPort > 0 ? pmaPort : (existing?.PmaPort > 0 ? existing.PmaPort : 8086),
                MailPort = mailPort > 0 ? mailPort : (existing?.MailPort > 0 ? existing.MailPort : 8025),
                PhpVersion = phpVersion,
                WpVersion = finalWpVersion,
                HasWpConfig = File.Exists(Path.Combine(dirPath, "wp-config.php")),
                HasWpContent = Directory.Exists(Path.Combine(dirPath, "wp-content")),
                DockerStatus = hasDocker ? "stopped" : "not_linked"
            };
        }
    }
}
