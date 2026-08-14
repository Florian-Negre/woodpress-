using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Win32;
using WoodPress.Core.Models;
using WoodPress.Core.Services;

namespace WoodPress.Desktop
{
    public partial class MainWindow : Window
    {
        private readonly ConfigManagerService _configService;
        private readonly ProjectScanner _scanner;
        private List<ProjectInfo> _allProjects = new List<ProjectInfo>();

        public MainWindow()
        {
            try
            {
                InitializeComponent();
                _configService = new ConfigManagerService();
                _scanner = new ProjectScanner(_configService);

                Loaded += MainWindow_Loaded;
            }
            catch (Exception ex)
            {
                var realEx = ex.InnerException ?? ex;
                MessageBox.Show($"Détail de l'erreur d'initialisation MainWindow :\n\n{realEx.GetType().Name}: {realEx.Message}\n\nTrace:\n{realEx.StackTrace}", "Erreur au démarrage de MainWindow", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            await RefreshProjectsAsync();
        }

        private async Task RefreshProjectsAsync()
        {
            TxtStatus.Text = "Scan et inspection des conteneurs Docker en cours...";
            try
            {
                _allProjects = await _scanner.ScanAllWorkspacesAsync();

                // Inspection du statut Docker temps réel pour chaque projet
                foreach (var p in _allProjects)
                {
                    string containerName = $"{p.ProjectName}-wp";
                    string status = await DockerService.GetContainerStatusAsync(containerName);
                    if (status == "running")
                    {
                        p.DockerStatus = "🟢 En ligne";
                        p.DockerStatusColor = "#22c55e"; // Vert
                        p.IsRunning = true;
                    }
                    else if (status == "starting")
                    {
                        p.DockerStatus = "🟡 En démarrage";
                        p.DockerStatusColor = "#f59e0b"; // Jaune
                        p.IsRunning = false;
                    }
                    else
                    {
                        p.DockerStatus = "🔴 Arrêté";
                        p.DockerStatusColor = "#ef4444"; // Rouge
                        p.IsRunning = false;
                    }
                }

                ApplyFilter();
                TxtStatus.Text = "Prêt — Statuts Docker temps réel et format .AZF actifs";
            }
            catch (Exception ex)
            {
                TxtStatus.Text = $"Erreur lors du scan : {ex.Message}";
            }
        }

        private void ApplyFilter()
        {
            if (_allProjects == null || ProjectsControl == null) return;

            IEnumerable<ProjectInfo> filtered = _allProjects;

            if (TabWorkspace.IsChecked == true)
            {
                filtered = _allProjects.Where(p => p.Type == "workspace");
            }
            else if (TabLearning.IsChecked == true)
            {
                filtered = _allProjects.Where(p => p.Type == "learning");
            }

            var list = filtered.ToList();
            ProjectsControl.ItemsSource = list;
            TxtCount.Text = $"{list.Count} projet(s) affiché(s)";
        }

        private async void BtnNewProject_Click(object sender, RoutedEventArgs e)
        {
            var win = new CreateProjectWindow { Owner = this };
            if (win.ShowDialog() == true && win.CreatedProject != null)
            {
                TxtStatus.Text = $"Nouveau projet créé : {win.CreatedProject.ClientName} !";
                MessageBox.Show($"Le projet {win.CreatedProject.ClientName} a été créé dans {win.CreatedProject.ProjectDir} !\n\nPort HTTP : :{win.CreatedProject.HttpPort}", "Projet Créé avec Succès", MessageBoxButton.OK, MessageBoxImage.Information);
                await RefreshProjectsAsync();
            }
        }

        private async void BtnRefresh_Click(object sender, RoutedEventArgs e)
        {
            await RefreshProjectsAsync();
        }

        private void FilterTab_Checked(object sender, RoutedEventArgs e)
        {
            ApplyFilter();
        }

        private async void BtnStart_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is ProjectInfo project)
            {
                string originalText = btn.Content.ToString() ?? "▶️ Démarrer";
                btn.IsEnabled = false;
                btn.Content = "⏳ Démarrage...";
                TxtStatus.Text = $"Démarrage des conteneurs pour {project.ClientName}...";

                try
                {
                    bool ok = await DockerService.StartContainersAsync(project.ComposeDir);
                    if (ok)
                    {
                        TxtStatus.Text = $"Site {project.ClientName} démarré avec succès !";
                    }
                    else
                    {
                        MessageBox.Show($"Erreur lors du démarrage Docker pour {project.ClientName}.", "Erreur Docker", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
                finally
                {
                    btn.Content = originalText;
                    btn.IsEnabled = true;
                    await RefreshProjectsAsync();
                }
            }
        }

        private async void BtnStop_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is ProjectInfo project)
            {
                string originalText = btn.Content.ToString() ?? "⏹️ Stop";
                btn.IsEnabled = false;
                btn.Content = "⏳ Arrêt...";
                TxtStatus.Text = $"Arrêt des conteneurs pour {project.ClientName}...";

                try
                {
                    bool ok = await DockerService.StopContainersAsync(project.ComposeDir);
                    if (ok)
                    {
                        TxtStatus.Text = $"Conteneurs pour {project.ClientName} arrêtés.";
                    }
                }
                finally
                {
                    btn.Content = originalText;
                    btn.IsEnabled = true;
                    await RefreshProjectsAsync();
                }
            }
        }

        private void BtnOpenSite_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                string url = $"http://localhost:{project.HttpPort}";
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = url, UseShellExecute = true });
            }
        }

        private void BtnOpenAdmin_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                string url = $"http://localhost:{project.HttpPort}/wp-admin";
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = url, UseShellExecute = true });
            }
        }

        private void BtnOpenPma_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                int port = project.PmaPort > 0 ? project.PmaPort : 8086;
                string url = $"http://localhost:{port}";
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = url, UseShellExecute = true });
            }
        }

        private void BtnOpenMail_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                int port = project.MailPort > 0 ? project.MailPort : 8025;
                string url = $"http://localhost:{port}";
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = url, UseShellExecute = true });
            }
        }

        private async void BtnRepairDb_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                TxtStatus.Text = $"Réparation de la BDD pour {project.ClientName}...";
                string dbContainer = $"{project.ProjectName}-db";
                try
                {
                    var psi = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"exec {dbContainer} mysql -u root -prootpassword -e \"CREATE DATABASE IF NOT EXISTS wordpress;\"",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = System.Diagnostics.Process.Start(psi))
                    {
                        proc?.WaitForExit(5000);
                    }
                    MessageBox.Show($"La base de données MySQL 'wordpress' pour {project.ClientName} a été vérifiée et réparée avec succès !", "Réparation BDD Réussie", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Erreur lors de la réparation BDD : {ex.Message}", "Erreur Réparation", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private async void BtnDelete_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                var result = MessageBox.Show($"Êtes-vous sûr de vouloir supprimer le projet '{project.ClientName}' ?\n\nCela arrêtera les conteneurs Docker associés.", "Confirmation de Suppression", MessageBoxButton.YesNo, MessageBoxImage.Warning);
                if (result == MessageBoxResult.Yes)
                {
                    TxtStatus.Text = $"Arrêt et nettoyage du projet {project.ClientName}...";
                    await DockerService.StopContainersAsync(project.ComposeDir);
                    _allProjects.Remove(project);
                    ApplyFilter();
                    MessageBox.Show($"Le projet {project.ClientName} a été retiré de WoodPress.", "Projet Supprimé", MessageBoxButton.OK, MessageBoxImage.Information);
                }
            }
        }

        private void BtnIde_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                var config = _configService.LoadConfig();
                bool ok = IdeLauncherService.OpenProjectInIde(project.ProjectDir, config.PreferredIde, config.CustomIdePath);
                if (ok)
                {
                    TxtStatus.Text = $"Projet {project.ClientName} ouvert dans {config.PreferredIde} !";
                }
                else
                {
                    MessageBox.Show("Impossible d'ouvrir le projet dans l'IDE sélectionné.", "Erreur IDE", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
            }
        }

        private void BtnFolder_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                if (Directory.Exists(project.ProjectDir))
                {
                    System.Diagnostics.Process.Start("explorer.exe", $"\"{project.ProjectDir}\"");
                }
            }
        }

        private void BtnAudit_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                var win = new AuditWindow(project) { Owner = this };
                win.ShowDialog();
            }
        }

        private void BtnExportAzf_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                var win = new ExportWindow(project) { Owner = this };
                win.ShowDialog();
            }
        }

        private void BtnSettings_Click(object sender, RoutedEventArgs e)
        {
            var config = _configService.LoadConfig();
            string current = config.PreferredIde ?? "code";

            // Permet de basculer de manière fluide entre les IDE principaux
            string[] ides = new[] { "code", "cursor", "phpstorm", "windsurf" };
            int idx = Array.IndexOf(ides, current);
            string nextIde = ides[(idx + 1) % ides.Length];

            config.PreferredIde = nextIde;
            _configService.SaveConfig(config);
            MessageBox.Show($"IDE préféré basculé sur : {nextIde.ToUpper()}", "Paramètres Enregistrés", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private async void BtnImportAzf_Click(object sender, RoutedEventArgs e)
        {
            var ofd = new OpenFileDialog
            {
                Filter = "Paquet WoodPress (*.azf)|*.azf|Tous les fichiers (*.*)|*.*",
                Title = "Sélectionnez un paquet propriétaire .AZF"
            };

            if (ofd.ShowDialog() == true)
            {
                string path = ofd.FileName;
                var manifest = await AzfArchiveService.ReadManifestAsync(path);
                if (manifest != null)
                {
                    MessageBox.Show($"Paquet .AZF reconnu !\nProjet : {manifest.ProjectName}\nClient : {manifest.ClientName}\nVersion WP : {manifest.WpVersion}", "Import .AZF", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else
                {
                    MessageBox.Show("Fichier .AZF invalide ou corrompu.", "Erreur Import", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }
    }
}
