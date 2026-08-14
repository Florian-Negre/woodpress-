using System;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows;
using WoodPress.Core.Models;
using WoodPress.Core.Services;

namespace WoodPress.Desktop
{
    public partial class CreateProjectWindow : Window
    {
        public ProjectInfo? CreatedProject { get; private set; }

        public CreateProjectWindow()
        {
            InitializeComponent();
            InitSuggestedPorts();
        }

        private void InitSuggestedPorts()
        {
            var ports = PortScannerService.SuggestProjectPorts();
            TxtPortHttp.Text = ports.httpPort.ToString();
            TxtPortDb.Text = ports.dbPort.ToString();
            TxtPortPma.Text = ports.pmaPort.ToString();
            TxtPortMail.Text = ports.mailPort.ToString();
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnCreate_Click(object sender, RoutedEventArgs e)
        {
            string clientName = TxtClientName.Text.Trim();
            string slug = TxtProjectSlug.Text.Trim().ToLowerInvariant();

            if (string.IsNullOrEmpty(clientName))
            {
                MessageBox.Show("Veuillez saisir un nom de client.", "Champ requis", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (string.IsNullOrEmpty(slug))
            {
                slug = Regex.Replace(clientName.ToLowerInvariant(), @"[^a-z0-9\-]", "-").Trim('-');
            }

            string selectedPhp = "8.5";
            if (CboPhpVersion.SelectedIndex == 1) selectedPhp = "8.4";
            else if (CboPhpVersion.SelectedIndex == 2) selectedPhp = "8.3";
            else if (CboPhpVersion.SelectedIndex == 3) selectedPhp = "8.2";

            string baseWorkspace = CboWorkspace.SelectedIndex == 0 ? @"G:\Workspace" : @"E:\E-Dev\WordPress";
            string projectDir = Path.Combine(baseWorkspace, slug);

            if (Directory.Exists(projectDir))
            {
                MessageBox.Show($"Le dossier {projectDir} existe déjà !", "Dossier existant", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                Directory.CreateDirectory(projectDir);
                Directory.CreateDirectory(Path.Combine(projectDir, "wp-content"));

                int.TryParse(TxtPortHttp.Text, out int httpPort);
                int.TryParse(TxtPortDb.Text, out int dbPort);
                int.TryParse(TxtPortPma.Text, out int pmaPort);
                int.TryParse(TxtPortMail.Text, out int mailPort);

                if (httpPort == 0) httpPort = 8081;
                if (dbPort == 0) dbPort = 3307;
                if (pmaPort == 0) pmaPort = 8086;
                if (mailPort == 0) mailPort = 8025;

                // Génération de docker-compose.yml
                string composeYaml = $@"version: '3.8'

services:
  wordpress:
    image: wordpress:php{selectedPhp}-apache
    container_name: {slug}-wp
    restart: always
    ports:
      - ""{httpPort}:80""
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_DB_USER: root
      WORDPRESS_DB_PASSWORD: rootpassword
    volumes:
      - wp_data:/var/www/html

  db:
    image: mysql:8.0
    container_name: {slug}-db
    restart: always
    ports:
      - ""{dbPort}:3306""
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: wordpress
    volumes:
      - db_data:/var/lib/mysql

volumes:
  wp_data:
  db_data:
";

                File.WriteAllText(Path.Combine(projectDir, "docker-compose.yml"), composeYaml);

                CreatedProject = new ProjectInfo
                {
                    ProjectName = slug,
                    ClientName = clientName,
                    ProjectDir = projectDir,
                    ComposeDir = projectDir,
                    Type = CboWorkspace.SelectedIndex == 0 ? "workspace" : "learning",
                    HttpPort = httpPort,
                    DbPort = dbPort,
                    PmaPort = pmaPort,
                    MailPort = mailPort,
                    PhpVersion = selectedPhp,
                    WpVersion = TxtWpVersion.Text.Trim(),
                    HasWpConfig = true,
                    HasWpContent = true
                };

                DialogResult = true;
                Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erreur lors de la création du projet : {ex.Message}", "Erreur", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
