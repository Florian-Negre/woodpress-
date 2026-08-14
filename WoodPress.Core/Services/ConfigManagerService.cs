using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using WoodPress.Core.Models;

namespace WoodPress.Core.Services
{
    public class AppConfig
    {
        [JsonPropertyName("workspaces")]
        public List<WorkspaceItem> Workspaces { get; set; } = new List<WorkspaceItem>();

        [JsonPropertyName("isConfigured")]
        public bool IsConfigured { get; set; }

        [JsonPropertyName("preferredIde")]
        public string PreferredIde { get; set; } = "code";

        [JsonPropertyName("customIdePath")]
        public string CustomIdePath { get; set; } = string.Empty;

        [JsonPropertyName("theme")]
        public string Theme { get; set; } = "dark";

        [JsonPropertyName("autoScanOnStartup")]
        public bool AutoScanOnStartup { get; set; } = true;

        [JsonIgnore]
        public string WorkspaceProPath => Workspaces.FirstOrDefault(w => w.Type == "workspace")?.Path ?? @"G:\Workspace";

        [JsonIgnore]
        public string LearningWorkspacePath => Workspaces.FirstOrDefault(w => w.Type == "learning")?.Path ?? @"E:\E-Dev\WordPress";
    }

    public class WorkspaceItem
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("path")]
        public string Path { get; set; } = string.Empty;

        [JsonPropertyName("type")]
        public string Type { get; set; } = "workspace"; // "workspace" ou "learning"

        [JsonPropertyName("isDefault")]
        public bool IsDefault { get; set; }
    }

    public class ConfigManagerService
    {
        private readonly string _dataDir;
        private readonly string _configFile;
        private readonly string _projectsFile;
        private static readonly JsonSerializerOptions JsonOpts = new JsonSerializerOptions { WriteIndented = true };

        public ConfigManagerService(string baseDir = "")
        {
            if (string.IsNullOrEmpty(baseDir))
            {
                baseDir = AppContext.BaseDirectory;
            }
            _dataDir = Path.Combine(baseDir, "data");
            _configFile = Path.Combine(_dataDir, "config.json");
            _projectsFile = Path.Combine(_dataDir, "projects.json");

            if (!Directory.Exists(_dataDir))
            {
                Directory.CreateDirectory(_dataDir);
            }
        }

        public AppConfig GetConfig() => LoadConfig();

        public AppConfig LoadConfig()
        {
            if (File.Exists(_configFile))
            {
                try
                {
                    string json = File.ReadAllText(_configFile);
                    var cfg = JsonSerializer.Deserialize<AppConfig>(json);
                    if (cfg != null) return cfg;
                }
                catch { }
            }

            // Détection automatique initiale
            var autoWs = new List<WorkspaceItem>();
            if (Directory.Exists(@"G:\Workspace"))
            {
                autoWs.Add(new WorkspaceItem { Id = "ws_workspace", Name = "Workspace Projets", Path = @"G:\Workspace", Type = "workspace", IsDefault = true });
            }
            if (Directory.Exists(@"E:\E-Dev\WordPress"))
            {
                autoWs.Add(new WorkspaceItem { Id = "ws_learning", Name = "Learnspace WordPress", Path = @"E:\E-Dev\WordPress", Type = "learning", IsDefault = autoWs.Count == 0 });
            }

            var initial = new AppConfig
            {
                Workspaces = autoWs,
                IsConfigured = autoWs.Count > 0
            };

            SaveConfig(initial);
            return initial;
        }

        public bool SaveConfig(AppConfig config)
        {
            try
            {
                string json = JsonSerializer.Serialize(config, JsonOpts);
                File.WriteAllText(_configFile, json);
                return true;
            }
            catch
            {
                return false;
            }
        }

        public List<ProjectInfo> LoadProjects()
        {
            if (File.Exists(_projectsFile))
            {
                try
                {
                    string json = File.ReadAllText(_projectsFile);
                    var list = JsonSerializer.Deserialize<List<ProjectInfo>>(json);
                    if (list != null) return list;
                }
                catch { }
            }
            return new List<ProjectInfo>();
        }

        public bool SaveProjects(List<ProjectInfo> projects)
        {
            try
            {
                string json = JsonSerializer.Serialize(projects, JsonOpts);
                File.WriteAllText(_projectsFile, json);
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
