using System;
using System.Diagnostics;
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
        /// Extrait l'intégralité d'un paquet .AZF dans le répertoire cible
        /// </summary>
        public static async Task<bool> ExtractAzfPackageAsync(string azfFilePath, string targetDirectory)
        {
            if (!File.Exists(azfFilePath)) return false;
            if (!Directory.Exists(targetDirectory)) Directory.CreateDirectory(targetDirectory);

            return await Task.Run(() =>
            {
                try
                {
                    ZipFile.ExtractToDirectory(azfFilePath, targetDirectory, true);
                    return true;
                }
                catch
                {
                    return false;
                }
            });
        }

        /// <summary>
        /// Crée un paquet .AZF tout-en-un à partir d'un projet WordPress (BDD SQL réelle + wp-content + config)
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
                SiteUrl = $"http://localhost:{project.HttpPort}",
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

                // 2. Dump SQL réel de la base MySQL
                string dbContainer = $"{project.ProjectName}-db";
                string tempSqlFile = Path.Combine(outputDirectory, $"temp_dump_{project.ProjectName}_{DateTime.Now.Ticks}.sql");
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"exec {dbContainer} mysqldump -u root -prootpassword wordpress",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psi))
                    {
                        if (proc != null)
                        {
                            string sql = await proc.StandardOutput.ReadToEndAsync();
                            await proc.WaitForExitAsync();
                            if (proc.ExitCode == 0 && !string.IsNullOrWhiteSpace(sql))
                            {
                                File.WriteAllText(tempSqlFile, sql);
                                zip.CreateEntryFromFile(tempSqlFile, "database.sql");
                            }
                        }
                    }
                }
                catch { }
                finally
                {
                    if (File.Exists(tempSqlFile)) File.Delete(tempSqlFile);
                }

                // 3. Inclure docker-compose.yml si présent
                string composePath = Path.Combine(project.ProjectDir, "docker-compose.yml");
                if (File.Exists(composePath))
                {
                    zip.CreateEntryFromFile(composePath, "docker-compose.yml");
                }

                // 4. Inclusion du dossier wp-content (sur disque ou extrait du conteneur Docker)
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
                        var psi = new ProcessStartInfo
                        {
                            FileName = "docker",
                            Arguments = $"cp {project.ProjectName}-wp:/var/www/html/wp-content \"{tempWpContent}\"",
                            UseShellExecute = false,
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            CreateNoWindow = true
                        };
                        using (var proc = Process.Start(psi))
                        {
                            if (proc != null)
                            {
                                await proc.WaitForExitAsync();
                            }
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

        private static void AddDirectoryToZip(ZipArchive zip, string sourceDir, string entryPrefix)
        {
            var files = Directory.GetFiles(sourceDir, "*.*", SearchOption.AllDirectories);
            foreach (var file in files)
            {
                // Exclure les dossiers temporaires ou exports
                if (file.Contains(Path.DirectorySeparatorChar + "exports" + Path.DirectorySeparatorChar)) continue;
                if (file.Contains(Path.DirectorySeparatorChar + "temp_" + Path.DirectorySeparatorChar)) continue;

                string relativePath = file.Substring(sourceDir.Length).TrimStart('\\', '/');
                string entryName = Path.Combine(entryPrefix, relativePath).Replace('\\', '/');
                zip.CreateEntryFromFile(file, entryName);
            }
        }
    }
}
