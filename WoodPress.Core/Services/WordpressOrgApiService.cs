using System;
using System.Collections.Concurrent;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace WoodPress.Core.Services
{
    public static class WordpressOrgApiService
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
        private static string? _cachedLatestWpVersion;
        private static readonly ConcurrentDictionary<string, string> PluginCache = new(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, string> ThemeCache = new(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Obtient la dernière version stable officielle de WordPress depuis l'API wordpress.org
        /// </summary>
        public static async Task<string> GetLatestWordPressVersionAsync()
        {
            if (!string.IsNullOrEmpty(_cachedLatestWpVersion)) return _cachedLatestWpVersion;

            try
            {
                string json = await Http.GetStringAsync("https://api.wordpress.org/core/version-check/1.7/");
                using (var doc = JsonDocument.Parse(json))
                {
                    if (doc.RootElement.TryGetProperty("offers", out var offers) && offers.GetArrayLength() > 0)
                    {
                        var first = offers[0];
                        if (first.TryGetProperty("current", out var cur))
                        {
                            _cachedLatestWpVersion = cur.GetString() ?? "7.0.4";
                            return _cachedLatestWpVersion;
                        }
                    }
                }
            }
            catch
            {
                _cachedLatestWpVersion = "7.0.4";
            }

            return _cachedLatestWpVersion ?? "7.0.4";
        }

        /// <summary>
        /// Obtient la dernière version publiée d'une extension depuis l'API officielle
        /// </summary>
        public static async Task<string?> GetLatestPluginVersionAsync(string slug)
        {
            if (string.IsNullOrWhiteSpace(slug)) return null;
            if (PluginCache.TryGetValue(slug, out var cached)) return cached;

            try
            {
                string url = $"https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]={Uri.EscapeDataString(slug.ToLowerInvariant())}";
                string json = await Http.GetStringAsync(url);
                using (var doc = JsonDocument.Parse(json))
                {
                    if (doc.RootElement.TryGetProperty("version", out var verProp))
                    {
                        string ver = verProp.GetString() ?? "";
                        if (!string.IsNullOrEmpty(ver))
                        {
                            PluginCache[slug] = ver;
                            return ver;
                        }
                    }
                }
            }
            catch { }

            return null;
        }

        /// <summary>
        /// Obtient la dernière version publiée d'un thème depuis l'API officielle
        /// </summary>
        public static async Task<string?> GetLatestThemeVersionAsync(string slug)
        {
            if (string.IsNullOrWhiteSpace(slug)) return null;
            if (ThemeCache.TryGetValue(slug, out var cached)) return cached;

            try
            {
                string url = $"https://api.wordpress.org/themes/info/1.2/?action=theme_information&request[slug]={Uri.EscapeDataString(slug.ToLowerInvariant())}";
                string json = await Http.GetStringAsync(url);
                using (var doc = JsonDocument.Parse(json))
                {
                    if (doc.RootElement.TryGetProperty("version", out var verProp))
                    {
                        string ver = verProp.GetString() ?? "";
                        if (!string.IsNullOrEmpty(ver))
                        {
                            ThemeCache[slug] = ver;
                            return ver;
                        }
                    }
                }
            }
            catch { }

            return null;
        }
    }
}
