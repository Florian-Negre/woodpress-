using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
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
            _ = Task.Run(async () =>
            {
                string latest = await WordpressOrgApiService.GetLatestWordPressVersionAsync();
                Dispatcher.Invoke(() =>
                {
                    TxtLatestWpBadge.Text = $"WP Officiel : v{latest} 🟢";
                });
            });

            await RefreshProjectsAsync();
        }

        private async Task RefreshProjectsAsync()
        {
            try
            {
                // 1. Vérification globale de l'état du daemon Docker
                bool isDockerRunning = await DockerService.IsDockerRunningAsync();
                if (isDockerRunning)
                {
                    TxtDockerGlobalStatus.Text = "🟢 Docker allumé";
                    TxtDockerGlobalStatus.Foreground = new SolidColorBrush(Color.FromRgb(34, 197, 94)); // Vert #22c55e
                    BtnStartDocker.Visibility = Visibility.Collapsed;
                }
                else
                {
                    TxtDockerGlobalStatus.Text = "🔴 Docker éteint";
                    TxtDockerGlobalStatus.Foreground = new SolidColorBrush(Color.FromRgb(239, 68, 68)); // Rouge #ef4444
                    BtnStartDocker.Visibility = Visibility.Visible;
                }

                // 2. Scan des projets et conteneurs
                _allProjects = await _scanner.ScanAllWorkspacesAsync();

                // Inspection du statut Docker temps réel pour chaque projet
                foreach (var p in _allProjects)
                {
                    if (!isDockerRunning)
                    {
                        p.DockerStatus = "🔴 Arrêté";
                        p.DockerStatusColor = "#ef4444";
                        p.IsRunning = false;
                        continue;
                    }

                    // Inspection dynamique du conteneur Docker
                    string containerName = string.Empty;
                    if (!string.IsNullOrEmpty(p.ComposeDir))
                    {
                        containerName = await DockerService.GetServiceContainerNameAsync(p.ComposeDir, "wordpress");
                    }
                    if (string.IsNullOrEmpty(containerName))
                    {
                        containerName = $"{p.ProjectName.ToLowerInvariant()}-wp";
                    }

                    string status = await DockerService.GetContainerStatusAsync(containerName);
                    if (status != "running")
                    {
                        string altStatus = await DockerService.GetContainerStatusAsync($"{p.ProjectName}-wp");
                        if (altStatus == "running") status = "running";
                    }

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

                    // 3. Évaluation dynamique de la version WordPress vs Official WordPress.org
                    string latestWp = await WordpressOrgApiService.GetLatestWordPressVersionAsync();
                    EvaluateProjectWpVersion(p, latestWp);
                }

                ApplyFilter();
            }
            catch (Exception ex)
            {
                TxtDockerGlobalStatus.Text = $"Erreur lors du scan : {ex.Message}";
            }
        }

        private void EvaluateProjectWpVersion(ProjectInfo p, string latestWp)
        {
            if (string.IsNullOrEmpty(p.WpVersion) || p.WpVersion == "calcul...")
            {
                p.WpVersionStatus = "v... (calcul)";
                p.WpVersionColor = "#94a3b8";
                p.HasWpUpdate = false;
                return;
            }

            int comp = CompareWpVersions(p.WpVersion, latestWp);
            if (comp >= 0)
            {
                p.WpVersionStatus = $"v{p.WpVersion} 🟢";
                p.WpVersionColor = "#22c55e"; // Vert #22c55e
                p.HasWpUpdate = false;
                p.WpUpdateTooltip = $"WordPress à jour (v{p.WpVersion}) — Conforme à la version stable officielle.";
            }
            else
            {
                var localParts = p.WpVersion.Split('.');
                var remoteParts = latestWp.Split('.');

                bool isMajor = (localParts.Length > 0 && remoteParts.Length > 0 && localParts[0] != remoteParts[0]);

                if (isMajor)
                {
                    p.WpVersionStatus = $"v{p.WpVersion} 🟠";
                    p.WpVersionColor = "#f97316"; // Orange
                    p.HasWpUpdate = true;
                    p.WpUpdateTooltip = $"⚠️ Mise à jour MAJEURE disponible (v{latestWp}).\nPrudence : vérifier la compatibilité des extensions avant de migrer.";
                }
                else
                {
                    p.WpVersionStatus = $"v{p.WpVersion} 🟡";
                    p.WpVersionColor = "#f59e0b"; // Jaune
                    p.HasWpUpdate = true;
                    p.WpUpdateTooltip = $"🛡️ Mise à jour MINEURE / SÉCURITÉ disponible (v{latestWp}).\nRecommandée sans risque majeur.";
                }
            }
        }

        private static int CompareWpVersions(string v1, string v2)
        {
            try
            {
                var clean1 = System.Text.RegularExpressions.Regex.Replace(v1, @"[^\d\.]", "");
                var clean2 = System.Text.RegularExpressions.Regex.Replace(v2, @"[^\d\.]", "");
                var ver1 = new Version(clean1.Contains('.') ? clean1 : clean1 + ".0");
                var ver2 = new Version(clean2.Contains('.') ? clean2 : clean2 + ".0");
                return ver1.CompareTo(ver2);
            }
            catch
            {
                return string.Compare(v1, v2, StringComparison.OrdinalIgnoreCase);
            }
        }

        private async void BtnQuickUpdateWp_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                if (!project.IsRunning)
                {
                    MessageBox.Show($"Le site {project.ClientName} doit être démarré pour appliquer la mise à jour WordPress.", "Site Arrêté", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                string latestWp = await WordpressOrgApiService.GetLatestWordPressVersionAsync();
                var localParts = project.WpVersion.Split('.');
                var remoteParts = latestWp.Split('.');
                bool isMajor = (localParts.Length > 0 && remoteParts.Length > 0 && localParts[0] != remoteParts[0]);

                string msg;
                if (isMajor)
                {
                    msg = $"⚠️ AVERTISSEMENT DE MISE À JOUR MAJEURE (v{project.WpVersion} ➔ v{latestWp})\n\n" +
                          "Selon les standards de l'industrie, une mise à jour majeure peut introduire des incompatibilités avec vos thèmes ou constructeurs (Divi, Elementor, ACF) s'ils n'ont pas encore été testés.\n\n" +
                          "Conseil : Assurez-vous d'avoir un backup ou testez d'abord sur un environnement de staging.\n\n" +
                          "Souhaitez-vous lancer la mise à jour maintenant ?";
                }
                else
                {
                    msg = $"🛡️ MISE À JOUR DE SÉCURITÉ & STABILITÉ (v{project.WpVersion} ➔ v{latestWp})\n\n" +
                          "Cette mise à jour mineure applique les derniers correctifs de sécurité et de performance sans rupture de compatibilité.\n\n" +
                          "Voulez-vous procéder à la mise à jour immédiate ?";
                }

                var res = MessageBox.Show(msg, "Mise à Jour WordPress", MessageBoxButton.YesNo, isMajor ? MessageBoxImage.Warning : MessageBoxImage.Question);
                if (res != MessageBoxResult.Yes) return;

                if (elem is Button btn)
                {
                    btn.IsEnabled = false;
                    btn.Content = "⏳...";
                }

                bool ok = await Task.Run(() =>
                {
                    try
                    {
                        string containerName = $"{project.ProjectName.ToLowerInvariant()}-wp";
                        string phpCode = @"
require_once '/var/www/html/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
$skin = new Automatic_Upgrader_Skin();
$upgrader = new Core_Upgrader($skin);
$result = $upgrader->upgrade_core();
echo is_wp_error($result) ? 'WP_UPGRADE_ERR:' . $result->get_error_message() : 'WP_UPGRADE_OK';
";
                        string b64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(phpCode));
                        var psi = new ProcessStartInfo
                        {
                            FileName = "docker",
                            Arguments = $"exec {containerName} php -r \"eval(base64_decode('{b64}'));\"",
                            UseShellExecute = false,
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            CreateNoWindow = true
                        };
                        using (var proc = Process.Start(psi))
                        {
                            if (proc == null) return false;
                            string outStr = proc.StandardOutput.ReadToEnd();
                            proc.WaitForExit(35000);
                            return outStr.Contains("WP_UPGRADE_OK") || proc.ExitCode == 0;
                        }
                    }
                    catch
                    {
                        return false;
                    }
                });

                if (ok)
                {
                    project.WpVersion = latestWp;
                    MessageBox.Show($"WordPress pour {project.ClientName} a été mis à jour avec succès vers la version {latestWp} !", "Mise à Jour Réussie", MessageBoxButton.OK, MessageBoxImage.Information);
                    await RefreshProjectsAsync();
                }
                else
                {
                    MessageBox.Show("Impossible d'appliquer la mise à jour automatiquement. Vérifiez les permissions du conteneur ou la connexion réseau.", "Erreur Mise à Jour", MessageBoxButton.OK, MessageBoxImage.Error);
                }

                if (elem is Button b)
                {
                    b.IsEnabled = true;
                    b.Content = "⚡ MAJ";
                }
            }
        }

        private async void BtnStartDocker_Click(object sender, RoutedEventArgs e)
        {
            BtnStartDocker.IsEnabled = false;
            BtnStartDocker.Content = "⏳ Lancement de Docker Desktop...";
            TxtDockerGlobalStatus.Text = "🟡 Démarrage de Docker Desktop en cours...";
            TxtDockerGlobalStatus.Foreground = new SolidColorBrush(Color.FromRgb(245, 158, 11)); // Jaune #f59e0b

            try
            {
                bool launched = await DockerService.LaunchDockerDesktopAsync();
                if (!launched)
                {
                    MessageBox.Show("Impossible de localiser 'Docker Desktop.exe'. Veuillez démarrer Docker manuellement.", "Docker Introuvable", MessageBoxButton.OK, MessageBoxImage.Warning);
                    BtnStartDocker.IsEnabled = true;
                    BtnStartDocker.Content = "🚀 Démarrer Docker Desktop";
                    return;
                }

                // Attente active jusqu'à ce que Docker réponde (max 45 secondes)
                for (int i = 0; i < 15; i++)
                {
                    await Task.Delay(3000);
                    if (await DockerService.IsDockerRunningAsync())
                    {
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erreur lors du lancement de Docker : {ex.Message}", "Erreur", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                BtnStartDocker.IsEnabled = true;
                BtnStartDocker.Content = "🚀 Démarrer Docker Desktop";
                await RefreshProjectsAsync();
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
            ProjectsControl.ItemsSource = null;
            ProjectsControl.ItemsSource = list;
            TxtCount.Text = $"{list.Count} projet(s) affiché(s)";
        }

        private async void BtnNewProject_Click(object sender, RoutedEventArgs e)
        {
            var win = new CreateProjectWindow { Owner = this };
            if (win.ShowDialog() == true && win.CreatedProject != null)
            {
                MessageBox.Show($"Le projet {win.CreatedProject.ClientName} a été créé dans {win.CreatedProject.ProjectDir} !\n\nPort HTTP : :{win.CreatedProject.HttpPort}", "Projet Créé avec Succès", MessageBoxButton.OK, MessageBoxImage.Information);
                await RefreshProjectsAsync();
            }
        }

        private async void BtnScan_Click(object sender, RoutedEventArgs e)
        {
            var result = MessageBox.Show(
                "Voulez-vous scanner vos dossiers configurés (Workspaces & Learnspace) et Docker à la recherche de sites WordPress existants ?",
                "🔍 Lancer le Scan WordPress",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question
            );

            if (result != MessageBoxResult.Yes) return;

            BtnScan.IsEnabled = false;
            BtnScan.Content = "⏳ Scan en cours...";
            TxtDockerGlobalStatus.Text = "🔍 Analyse de vos répertoires et inspection des conteneurs Docker...";

            try
            {
                await RefreshProjectsAsync();

                int total = _allProjects.Count;
                int online = _allProjects.Count(p => p.IsRunning);
                int stopped = total - online;

                MessageBox.Show(
                    $"Scan terminé avec succès !\n\n📊 Résultat de l'analyse :\n• Total détecté : {total} site(s) WordPress\n• En ligne : 🟢 {online}\n• Arrêté(s) : 🔴 {stopped}",
                    "Résultat du Scan",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information
                );
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erreur lors du scan : {ex.Message}", "Erreur Scan", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                BtnScan.IsEnabled = true;
                BtnScan.Content = "🔍 Scanner";
            }
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

                try
                {
                    bool ok = await DockerService.StartContainersAsync(project.ComposeDir);
                    if (!ok)
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
                string originalText = btn.Content.ToString() ?? "⏹️ Arrêter";
                btn.IsEnabled = false;
                btn.Content = "⏳ Arrêt...";

                try
                {
                    await DockerService.StopContainersAsync(project.ComposeDir);
                }
                finally
                {
                    btn.Content = originalText;
                    btn.IsEnabled = true;
                    await RefreshProjectsAsync();
                }
            }
        }

        private async void BtnRestart_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is ProjectInfo project)
            {
                string originalText = btn.Content.ToString() ?? "🔄 Redémarrer";
                btn.IsEnabled = false;
                btn.Content = "⏳ Redémarrage...";

                try
                {
                    await DockerService.RestartContainersAsync(project.ComposeDir);
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
                if (!project.IsRunning)
                {
                    MessageBox.Show($"Le conteneur de {project.ClientName} doit être démarré pour réparer la base de données.", "Conteneur Arrêté", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

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
                        if (proc == null)
                        {
                            MessageBox.Show("Impossible de lancer le processus Docker.", "Erreur", MessageBoxButton.OK, MessageBoxImage.Error);
                            return;
                        }
                        string err = await proc.StandardError.ReadToEndAsync();
                        proc.WaitForExit(6000);

                        if (proc.ExitCode == 0)
                        {
                            MessageBox.Show($"La base de données MySQL 'wordpress' pour {project.ClientName} a été vérifiée et initialisée avec succès !", "Réparation BDD Réussie", MessageBoxButton.OK, MessageBoxImage.Information);
                        }
                        else
                        {
                            MessageBox.Show($"Échec de la commande MySQL (ExitCode {proc.ExitCode}) :\n{err}", "Erreur MySQL", MessageBoxButton.OK, MessageBoxImage.Error);
                        }
                    }
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
                var result = MessageBox.Show($"Êtes-vous sûr de vouloir retirer le projet '{project.ClientName}' de WoodPress ?\n\nLes conteneurs Docker associés seront arrêtés.", "Confirmation de Retrait", MessageBoxButton.YesNo, MessageBoxImage.Warning);
                if (result == MessageBoxResult.Yes)
                {
                    await DockerService.StopContainersAsync(project.ComposeDir);
                    _allProjects.Remove(project);
                    _configService.SaveProjects(_allProjects);
                    ApplyFilter();
                    MessageBox.Show($"Le projet {project.ClientName} a été retiré de la liste de WoodPress.", "Projet Retiré", MessageBoxButton.OK, MessageBoxImage.Information);
                }
            }
        }

        private void BtnIde_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                var config = _configService.GetConfig();
                bool ok = IdeLauncherService.OpenProjectInIde(project.ProjectDir, config.PreferredIde, config.CustomIdePath);
                if (!ok)
                {
                    MessageBox.Show($"Impossible d'ouvrir l'IDE sélectionné ({config.PreferredIde}). Vérifiez qu'il est bien installé.", "Erreur IDE", MessageBoxButton.OK, MessageBoxImage.Warning);
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

        private void BtnFolder_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is ProjectInfo project)
            {
                if (Directory.Exists(project.ProjectDir))
                {
                    System.Diagnostics.Process.Start("explorer.exe", $"\"{project.ProjectDir}\"");
                }
                else
                {
                    MessageBox.Show("Le répertoire du projet est introuvable sur le disque.", "Erreur Dossier", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
            }
        }

        private void BtnSettings_Click(object sender, RoutedEventArgs e)
        {
            var config = _configService.GetConfig();
            var dialog = new Window
            {
                Title = "Paramètres — Choix de l'IDE par Défaut",
                Width = 380,
                Height = 220,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                Owner = this,
                Background = (SolidColorBrush)FindResource("BgDark")
            };

            var stack = new StackPanel { Margin = new Thickness(20) };
            var lbl = new TextBlock { Text = "Choisissez votre IDE de développement :", Foreground = (SolidColorBrush)FindResource("TextPrimary"), Margin = new Thickness(0, 0, 0, 10), FontWeight = FontWeights.SemiBold };
            var combo = new ComboBox { Margin = new Thickness(0, 0, 0, 16), Padding = new Thickness(6) };
            combo.Items.Add("VS Code (code)");
            combo.Items.Add("Cursor (cursor)");
            combo.Items.Add("PhpStorm (phpstorm64.exe)");
            combo.Items.Add("Windsurf (windsurf)");

            if (config.PreferredIde == "cursor") combo.SelectedIndex = 1;
            else if (config.PreferredIde == "phpstorm") combo.SelectedIndex = 2;
            else if (config.PreferredIde == "windsurf") combo.SelectedIndex = 3;
            else combo.SelectedIndex = 0;

            var btnSave = new Button { Content = "Enregistrer", Background = (SolidColorBrush)FindResource("AccentGreen"), Padding = new Thickness(12, 6, 12, 6) };
            btnSave.Click += (s, ev) =>
            {
                if (combo.SelectedIndex == 1) config.PreferredIde = "cursor";
                else if (combo.SelectedIndex == 2) config.PreferredIde = "phpstorm";
                else if (combo.SelectedIndex == 3) config.PreferredIde = "windsurf";
                else config.PreferredIde = "code";

                _configService.SaveConfig(config);
                dialog.Close();
            };

            stack.Children.Add(lbl);
            stack.Children.Add(combo);
            stack.Children.Add(btnSave);
            dialog.Content = stack;
            dialog.ShowDialog();
        }

        private async void BtnImport_Click(object sender, RoutedEventArgs e)
        {
            var win = new ImportWindow { Owner = this };
            if (win.ShowDialog() == true && win.ImportedProject != null)
            {
                await RefreshProjectsAsync();
            }
        }
    }
}
