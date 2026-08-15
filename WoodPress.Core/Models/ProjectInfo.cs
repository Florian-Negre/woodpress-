using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Text.Json.Serialization;

namespace WoodPress.Core.Models
{
    public class ProjectInfo : INotifyPropertyChanged
    {
        private string _dockerStatus = "🔴 Arrêté";
        private string _dockerStatusColor = "#ef4444";
        private bool _isRunning;

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
        public string DockerStatus
        {
            get => _dockerStatus;
            set
            {
                if (_dockerStatus != value)
                {
                    _dockerStatus = value;
                    OnPropertyChanged();
                }
            }
        }

        [JsonPropertyName("dockerStatusColor")]
        public string DockerStatusColor
        {
            get => _dockerStatusColor;
            set
            {
                if (_dockerStatusColor != value)
                {
                    _dockerStatusColor = value;
                    OnPropertyChanged();
                }
            }
        }

        [JsonPropertyName("isRunning")]
        public bool IsRunning
        {
            get => _isRunning;
            set
            {
                if (_isRunning != value)
                {
                    _isRunning = value;
                    OnPropertyChanged();
                    OnPropertyChanged(nameof(IsNotRunning));
                }
            }
        }

        [JsonIgnore]
        public bool IsNotRunning => !IsRunning;

        [JsonPropertyName("hasWpConfig")]
        public bool HasWpConfig { get; set; }

        [JsonPropertyName("hasWpContent")]
        public bool HasWpContent { get; set; }

        [JsonPropertyName("enablePma")]
        public bool EnablePma { get; set; } = true;

        [JsonPropertyName("enableMailpit")]
        public bool EnableMailpit { get; set; } = true;

        public event PropertyChangedEventHandler? PropertyChanged;

        protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
