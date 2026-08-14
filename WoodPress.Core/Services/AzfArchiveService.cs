using System;
using System.IO;
using System.IO.Compression;
using System.Text.Json;
using System.Threading.Tasks;
using WoodPress.Core.Models;

namespace WoodPress.Core.Services
{
    /// <summary>
    /// Service de création, lecture et extraction des paquets propriétaires .AZF (Atelier Zip Format)
    /// </summary>
    public class AzfArchiveService
    {
        private static readonly JsonSerializerOptions JsonOpts = new JsonSerializerOptions { WriteIndented = true };

        /// <summary>
        /// Lit le manifeste d'un fichier .AZF sans tout décompresser
        /// </summary>
        public static async Task<AzfManifest?> ReadManifestAsync(string azfFilePath)
        {
            if (!File.Exists(azfFilePath)) return null;

            using (var zip = ZipFile.OpenRead(azfFilePath))
            {
                var entry = zip.GetEntry("manifest.azf.json");
                if (entry == null) return null;

                using (var stream = entry.Open())
                using (var reader = new StreamReader(stream))
                {
                    var json = await reader.ReadToEndAsync();
                    return JsonSerializer.Deserialize<AzfManifest>(json);
                }
            }
        }

        /// <summary>
        /// Crée un paquet .AZF tout-en-un à partir d'un projet WordPress (BDD + wp-content + config)
        /// </summary>
        public static async Task<string> CreateAzfPackageAsync(ProjectInfo project, string outputDirectory, string notes = "")
        {
            if (!Directory.Exists(outputDirectory))
            {
                Directory.CreateDirectory(outputDirectory);
            }

            string azfFileName = $"{project.ProjectName}_{DateTime.Now:yyyyMMdd_HHmmss}.azf";
            string azfFilePath = Path.Combine(outputDirectory, azfFileName);

            var manifest = new AzfManifest
            {
                ProjectName = project.ProjectName,
                ClientName = project.ClientName,
                WpVersion = project.WpVersion,
                PhpVersion = project.PhpVersion,
                OriginalHttpPort = project.HttpPort,
                OriginalDbPort = project.DbPort,
                CustomNotes = notes,
                CreatedAt = DateTime.UtcNow
            };

            using (var zip = ZipFile.Open(azfFilePath, ZipArchiveMode.Create))
            {
                // 1. Écrire le manifeste manifest.azf.json
                var manifestEntry = zip.CreateEntry("manifest.azf.json");
                using (var writer = new StreamWriter(manifestEntry.Open()))
                {
                    var json = JsonSerializer.Serialize(manifest, JsonOpts);
                    await writer.WriteAsync(json);
                }

                // 2. Inclure docker-compose.yml si présent
                string composePath = Path.Combine(project.ProjectDir, "docker-compose.yml");
                if (File.Exists(composePath))
                {
                    zip.CreateEntryFromFile(composePath, "docker-compose.yml");
                }

                // 2. Inclusion du dossier wp-content (sur disque ou extrait du conteneur Docker)
                string localWpContent = Path.Combine(project.ProjectDir, "wp-content");
                string mirrorWpContent = Path.Combine(project.ProjectDir, "wp-content-mirror");

                if (Directory.Exists(localWpContent))
                {
                    AddDirectoryToZip(zip, localWpContent, "wp-content");
                }
                else if (Directory.Exists(mirrorWpContent))
                {
                    AddDirectoryToZip(zip, mirrorWpContent, "wp-content");
                }
                else
                {
                    // Extraction directe à chaud depuis le conteneur Docker (Cas des volumes nommés comme vk-wp)
                    string tempWpContent = Path.Combine(outputDirectory, $"temp_wp_{project.ProjectName}");
                    try
                    {
                        var psi = new System.Diagnostics.ProcessStartInfo
                        {
                            FileName = "docker",
                            Arguments = $"cp {project.ProjectName}-wp:/var/www/html/wp-content \"{tempWpContent}\"",
                            UseShellExecute = false,
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            CreateNoWindow = true
                        };
                        using (var proc = System.Diagnostics.Process.Start(psi))
                        {
                            proc?.WaitForExit(15000);
                        }
                        if (Directory.Exists(tempWpContent))
                        {
                            AddDirectoryToZip(zip, tempWpContent, "wp-content");
                            Directory.Delete(tempWpContent, true);
                        }
                    }
                    catch { }
                }
            }

            return azfFilePath;
        }

        /// <summary>
        /// Extrait un paquet .AZF dans un dossier de destination
        /// </summary>
        public static async Task ExtractAzfPackageAsync(string azfFilePath, string destinationDir)
        {
            if (!File.Exists(azfFilePath))
                throw new FileNotFoundException("Fichier .AZF introuvable.", azfFilePath);

            if (!Directory.Exists(destinationDir))
                Directory.CreateDirectory(destinationDir);

            await Task.Run(() => ZipFile.ExtractToDirectory(azfFilePath, destinationDir, true));
        }

        private static void AddDirectoryToZip(ZipArchive zip, string sourceDir, string entryPrefix)
        {
            var files = Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories);
            foreach (var file in files)
            {
                string relativePath = Path.GetRelativePath(sourceDir, file);
                string entryName = Path.Combine(entryPrefix, relativePath).Replace('\\', '/');
                zip.CreateEntryFromFile(file, entryName);
            }
        }
    }
}
