using System;
using System.Collections.Generic;
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
            var config = _configService.LoadConfig();
            var registered = _configService.LoadProjects();
            var discovered = new List<ProjectInfo>();
            var processedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var ws in config.Workspaces)
            {
                if (string.IsNullOrWhiteSpace(ws.Path) || !Directory.Exists(ws.Path))
                {
                    continue;
                }

                try
                {
                    var subDirs = Directory.GetDirectories(ws.Path);
                    foreach (var dirPath in subDirs)
                    {
                        string dirName = Path.GetFileName(dirPath);
                        if (dirName.StartsWith(".") || dirName.StartsWith("0-Codinflo_InterneDocs") || dirName == "node_modules")
                        {
                            continue;
                        }

                        if (processedPaths.Contains(dirPath)) continue;

                        if (IsWordPressDir(dirPath))
                        {
                            processedPaths.Add(dirPath);
                            discovered.Add(BuildDiscoveredProject(dirPath, dirName, ws.Type, registered));
                            continue;
                        }

                        // Scan des sous-dossiers (ex: 01-Client/...)
                        try
                        {
                            var deepDirs = Directory.GetDirectories(dirPath);
                            foreach (var deepPath in deepDirs)
                            {
                                string deepName = Path.GetFileName(deepPath);
                                if (deepName.StartsWith(".")) continue;

                                if (processedPaths.Contains(deepPath)) continue;

                                if (IsWordPressDir(deepPath))
                                {
                                    processedPaths.Add(deepPath);
                                    discovered.Add(BuildDiscoveredProject(deepPath, $"{dirName} / {deepName}", ws.Type, registered));
                                }
                            }
                        }
                        catch { }
                    }
                }
                catch { }
            }

            return discovered;
        }

        private static bool IsWordPressDir(string dirPath)
        {
            if (!Directory.Exists(dirPath)) return false;

            bool hasWpConfig = File.Exists(Path.Combine(dirPath, "wp-config.php")) ||
                               File.Exists(Path.Combine(dirPath, "wp-config-sample.php")) ||
                               File.Exists(Path.Combine(dirPath, "wordpress", "wp-config.php"));

            bool hasWpContent = Directory.Exists(Path.Combine(dirPath, "wp-content")) ||
                                Directory.Exists(Path.Combine(dirPath, "wordpress", "wp-content"));

            bool hasDockerCompose = File.Exists(Path.Combine(dirPath, "docker-compose.yml")) ||
                                    File.Exists(Path.Combine(dirPath, "docker", "docker-compose.yml"));

            if (hasDockerCompose)
            {
                string composePath = File.Exists(Path.Combine(dirPath, "docker-compose.yml"))
                    ? Path.Combine(dirPath, "docker-compose.yml")
                    : Path.Combine(dirPath, "docker", "docker-compose.yml");
                try
                {
                    string content = File.ReadAllText(composePath);
                    if (content.Contains("wordpress") || content.Contains("WORDPRESS_") || content.Contains("mysql"))
                    {
                        return true;
                    }
                }
                catch { }
            }

            return hasWpConfig || hasWpContent;
        }

        private static ProjectInfo BuildDiscoveredProject(string dirPath, string displayName, string type, List<ProjectInfo> registered)
        {
            string normPath = Path.GetFullPath(dirPath);
            var existing = registered.Find(p => string.Equals(Path.GetFullPath(p.ProjectDir), normPath, StringComparison.OrdinalIgnoreCase));

            string composeDir = dirPath;
            if (!File.Exists(Path.Combine(dirPath, "docker-compose.yml")) && File.Exists(Path.Combine(dirPath, "docker", "docker-compose.yml")))
            {
                composeDir = Path.Combine(dirPath, "docker");
            }

            bool hasDocker = File.Exists(Path.Combine(composeDir, "docker-compose.yml"));
            int httpPort = existing?.HttpPort ?? 0;
            int dbPort = existing?.DbPort ?? 0;
            int pmaPort = existing?.PmaPort ?? 0;

            if (hasDocker && httpPort == 0)
            {
                try
                {
                    string composeText = File.ReadAllText(Path.Combine(composeDir, "docker-compose.yml"));
                    var portMatch = Regex.Match(composeText, @"""(\d+):80""");
                    if (portMatch.Success && int.TryParse(portMatch.Groups[1].Value, out int pHttp)) httpPort = pHttp;

                    var dbMatch = Regex.Match(composeText, @"""(\d+):3306""");
                    if (dbMatch.Success && int.TryParse(dbMatch.Groups[1].Value, out int pDb)) dbPort = pDb;

                    var pmaMatch = Regex.Match(composeText, @"""(\d+):8081""");
                    if (pmaMatch.Success && int.TryParse(pmaMatch.Groups[1].Value, out int pPma)) pmaPort = pPma;
                }
                catch { }
            }

            string wpVersion = "6.7.2";
            string[] possibleVersionFiles = new[]
            {
                Path.Combine(dirPath, "wp-includes", "version.php"),
                Path.Combine(dirPath, "wordpress", "wp-includes", "version.php"),
                Path.Combine(dirPath, "wp-content-mirror", "..", "wp-includes", "version.php")
            };

            foreach (var vFile in possibleVersionFiles)
            {
                if (File.Exists(vFile))
                {
                    try
                    {
                        string vText = File.ReadAllText(vFile);
                        var vMatch = Regex.Match(vText, @"\$wp_version\s*=\s*'([^']+)'");
                        if (vMatch.Success)
                        {
                            wpVersion = vMatch.Groups[1].Value;
                            break;
                        }
                    }
                    catch { }
                }
            }

            return new ProjectInfo
            {
                Id = existing?.Id ?? $"discovered_{Convert.ToHexString(System.Text.Encoding.UTF8.GetBytes(dirPath))[..12]}",
                ProjectName = existing?.ProjectName ?? Path.GetFileName(dirPath),
                ClientName = existing?.ClientName ?? displayName,
                ProjectDir = dirPath,
                ComposeDir = composeDir,
                Type = existing?.Type ?? type,
                HttpPort = httpPort > 0 ? httpPort : 8081,
                DbPort = dbPort > 0 ? dbPort : 3307,
                PmaPort = pmaPort > 0 ? pmaPort : 8086,
                PhpVersion = existing?.PhpVersion ?? "8.4",
                WpVersion = !string.IsNullOrEmpty(wpVersion) ? wpVersion : (existing?.WpVersion ?? "6.7.2"),
                HasWpConfig = File.Exists(Path.Combine(dirPath, "wp-config.php")),
                HasWpContent = Directory.Exists(Path.Combine(dirPath, "wp-content")),
                DockerStatus = hasDocker ? "stopped" : "not_linked"
            };
        }
    }
}
