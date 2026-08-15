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

        private string _wpVersion = "calcul...";
        private string _wpVersionStatus = "v... (calcul)";
        private string _wpVersionColor = "#94a3b8";
        private bool _hasWpUpdate;
        private string _wpUpdateTooltip = string.Empty;

        [JsonPropertyName("wpVersion")]
        public string WpVersion
        {
            get => _wpVersion;
            set
            {
                if (_wpVersion != value)
                {
                    _wpVersion = value;
                    OnPropertyChanged();
                }
            }
        }

        [JsonIgnore]
        public string WpVersionStatus
        {
            get => _wpVersionStatus;
            set
            {
                if (_wpVersionStatus != value)
                {
                    _wpVersionStatus = value;
                    OnPropertyChanged();
                }
            }
        }

        [JsonIgnore]
        public string WpVersionColor
        {
            get => _wpVersionColor;
            set
            {
                if (_wpVersionColor != value)
                {
                    _wpVersionColor = value;
                    OnPropertyChanged();
                }
            }
        }

        [JsonIgnore]
        public bool HasWpUpdate
        {
            get => _hasWpUpdate;
            set
            {
                if (_hasWpUpdate != value)
                {
                    _hasWpUpdate = value;
                    OnPropertyChanged();
                }
            }
        }

        [JsonIgnore]
        public string WpUpdateTooltip
        {
            get => _wpUpdateTooltip;
            set
            {
                if (_wpUpdateTooltip != value)
                {
                    _wpUpdateTooltip = value;
                    OnPropertyChanged();
                }
            }
        }

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
