using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WoodPress.Core.Models
{
    /// <summary>
    /// Métadonnées officielles du format propriétaire .AZF (Atelier Zip Format)
    /// </summary>
    public class AzfManifest
    {
        [JsonPropertyName("formatVersion")]
        public string FormatVersion { get; set; } = "1.0.0";

        [JsonPropertyName("signature")]
        public string Signature { get; set; } = "CODINFLO_AZF_PROPRIETARY";

        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [JsonPropertyName("author")]
        public string Author { get; set; } = "Codinflo WoodPress";

        [JsonPropertyName("projectName")]
        public string ProjectName { get; set; } = string.Empty;

        [JsonPropertyName("clientName")]
        public string ClientName { get; set; } = string.Empty;

        [JsonPropertyName("wpVersion")]
        public string WpVersion { get; set; } = "7.0.4";

        [JsonPropertyName("phpVersion")]
        public string PhpVersion { get; set; } = "8.4";

        [JsonPropertyName("dbType")]
        public string DbType { get; set; } = "mysql";

        [JsonPropertyName("originalHttpPort")]
        public int OriginalHttpPort { get; set; } = 8081;

        [JsonPropertyName("originalDbPort")]
        public int OriginalDbPort { get; set; } = 3307;

        [JsonPropertyName("hasDatabaseDump")]
        public bool HasDatabaseDump { get; set; } = true;

        [JsonPropertyName("hasWpContent")]
        public bool HasWpContent { get; set; } = true;

        [JsonPropertyName("customNotes")]
        public string CustomNotes { get; set; } = string.Empty;
    }
}
