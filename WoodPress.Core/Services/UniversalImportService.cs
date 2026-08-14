using System;
using System.IO;
using System.IO.Compression;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using WoodPress.Core.Models;

namespace WoodPress.Core.Services
{
    public static class UniversalImportService
    {
        public static async Task<ProjectInfo> ImportProjectArchiveAsync(string archiveFilePath, string targetParentDir, string clientName = "")
        {
            if (!File.Exists(archiveFilePath))
                throw new FileNotFoundException("Le fichier d'archive est introuvable.", archiveFilePath);

            string ext = Path.GetExtension(archiveFilePath).ToLowerInvariant();
            string projectName = Path.GetFileNameWithoutExtension(archiveFilePath).ToLowerInvariant();
            projectName = Regex.Replace(projectName, @"[^a-z0-9\-]", "-").Trim('-');
            if (string.IsNullOrEmpty(clientName)) clientName = projectName.ToUpperInvariant();

            string destinationDir = Path.Combine(targetParentDir, projectName);
            if (Directory.Exists(destinationDir))
            {
                destinationDir = Path.Combine(targetParentDir, $"{projectName}_{DateTime.Now:HHmmss}");
            }
            Directory.CreateDirectory(destinationDir);

            // 1. Cas .AZF
            if (ext == ".azf")
            {
                var manifest = await AzfArchiveService.ReadManifestAsync(archiveFilePath);
                if (manifest != null && !string.IsNullOrWhiteSpace(manifest.ClientName))
                {
                    clientName = manifest.ClientName;
                }
                await AzfArchiveService.ExtractAzfPackageAsync(archiveFilePath, destinationDir);
            }
            // 2. Cas .ZIP
            else if (ext == ".zip")
            {
                await Task.Run(() => ZipFile.ExtractToDirectory(archiveFilePath, destinationDir, true));
            }
            // 3. Cas .WPRESS (All-in-One WP Migration)
            else if (ext == ".wpress")
            {
                await Task.Run(() =>
                {
                    // Copie de sécurité de l'archive .wpress dans un dossier backups pour restauration immédiate
                    string backupDir = Path.Combine(destinationDir, "wp-content", "ai1wm-backups");
                    Directory.CreateDirectory(backupDir);
                    File.Copy(archiveFilePath, Path.Combine(backupDir, Path.GetFileName(archiveFilePath)), true);
                });
            }

            // 4. Attribution de ports uniques et génération de docker-compose.yml si absent
            var (httpPort, dbPort, pmaPort, mailPort) = PortScannerService.SuggestProjectPorts();
            string composeFile = Path.Combine(destinationDir, "docker-compose.yml");
            if (!File.Exists(composeFile))
            {
                string composeYaml = $@"version: '3.8'

services:
  wordpress:
    image: wordpress:php8.4-apache
    container_name: {projectName}-wp
    restart: always
    ports:
      - ""{httpPort}:80""
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: wp_user
      WORDPRESS_DB_PASSWORD: wp_password
      WORDPRESS_DB_NAME: wordpress
    volumes:
      - ./:/var/www/html
    depends_on:
      - db

  db:
    image: mysql:8.0
    container_name: {projectName}-db
    restart: always
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wp_user
      MYSQL_PASSWORD: wp_password
      MYSQL_ROOT_PASSWORD: rootpassword
    volumes:
      - db_data:/var/lib/mysql

  phpmyadmin:
    image: phpmyadmin:latest
    container_name: {projectName}-pma
    restart: always
    ports:
      - ""{pmaPort}:80""
    environment:
      PMA_HOST: db
    depends_on:
      - db

  mailpit:
    image: axllent/mailpit:latest
    container_name: {projectName}-mail
    restart: always
    ports:
      - ""{mailPort}:8025""

volumes:
  db_data:
";
                await File.WriteAllTextAsync(composeFile, composeYaml);
            }

            return new ProjectInfo
            {
                Id = $"imported_{Convert.ToHexString(System.Text.Encoding.UTF8.GetBytes(destinationDir))[..12]}",
                ProjectName = projectName,
                ClientName = clientName,
                ProjectDir = destinationDir,
                ComposeDir = destinationDir,
                Type = targetParentDir.Contains("E-Dev", StringComparison.OrdinalIgnoreCase) ? "learning" : "workspace",
                HttpPort = httpPort,
                DbPort = dbPort,
                PmaPort = pmaPort,
                MailPort = mailPort,
                PhpVersion = "8.4",
                WpVersion = "6.7.2",
                HasWpConfig = File.Exists(Path.Combine(destinationDir, "wp-config.php")),
                HasWpContent = Directory.Exists(Path.Combine(destinationDir, "wp-content")),
                DockerStatus = "stopped"
            };
        }
    }
}
