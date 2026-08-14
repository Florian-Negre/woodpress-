using System;
using System.Text.Json.Serialization;

namespace WoodPress.Core.Models
{
    public class ProjectInfo
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");

        [JsonPropertyName("projectName")]
        public string ProjectName { get; set; } = string.Empty;

        [JsonPropertyName("clientName")]
        public string ClientName { get; set; } = string.Empty;

        [JsonPropertyName("projectDir")]
        public string ProjectDir { get; set; } = string.Empty;

        [JsonPropertyName("composeDir")]
        public string ComposeDir { get; set; } = string.Empty;

        [JsonPropertyName("type")]
        public string Type { get; set; } = "workspace"; // "workspace" ou "learning"

        [JsonPropertyName("httpPort")]
        public int HttpPort { get; set; } = 8081;

        [JsonPropertyName("dbPort")]
        public int DbPort { get; set; } = 3307;

        [JsonPropertyName("pmaPort")]
        public int PmaPort { get; set; } = 8086;

        [JsonPropertyName("mailPort")]
        public int MailPort { get; set; } = 8025;

        [JsonPropertyName("phpVersion")]
        public string PhpVersion { get; set; } = "8.4";

        [JsonPropertyName("wpVersion")]
        public string WpVersion { get; set; } = "7.0.4";

        [JsonPropertyName("dockerStatus")]
        public string DockerStatus { get; set; } = "stopped"; // "running", "stopped", "not_linked"

        [JsonPropertyName("dockerStatusColor")]
        public string DockerStatusColor { get; set; } = "#ef4444"; // "#22c55e" (vert), "#ef4444" (rouge), "#f59e0b" (jaune)

        [JsonPropertyName("isRunning")]
        public bool IsRunning { get; set; }

        [JsonPropertyName("hasWpConfig")]
        public bool HasWpConfig { get; set; }

        [JsonPropertyName("hasWpContent")]
        public bool HasWpContent { get; set; }

        [JsonPropertyName("enablePma")]
        public bool EnablePma { get; set; } = true;

        [JsonPropertyName("enableMailpit")]
        public bool EnableMailpit { get; set; } = true;
    }
}
