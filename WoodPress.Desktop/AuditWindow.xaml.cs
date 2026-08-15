using System;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using WoodPress.Core.Models;
using WoodPress.Core.Services;

namespace WoodPress.Desktop
{
    public partial class AuditWindow : Window
    {
        private readonly ProjectInfo _project;
        private ProjectAuditReport? _report;

        public AuditWindow(ProjectInfo project)
        {
            InitializeComponent();
            _project = project;
            TxtTitle.Text = $"🔍 Audit & Gestion : {project.ClientName}";
            TxtSubtitle.Text = $"Dossier : {project.ProjectDir} | Version actuelle : {project.WpVersion} — Analyse en cours...";

            Loaded += AuditWindow_Loaded;
        }

        private async void AuditWindow_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                _report = await PluginAuditService.AuditProjectAsync(_project);

                GridPlugins.ItemsSource = _report.Plugins;
                GridThemes.ItemsSource = _report.Themes;

                // Affichage du Score de Santé
                TxtHealthScore.Text = $"{_report.HealthScore}% 🛡️";
                if (_report.HealthScore >= 90)
                {
                    TxtHealthScore.Foreground = new SolidColorBrush(Color.FromRgb(34, 197, 94)); // Vert #22c55e
                    BrdHealthScore.BorderBrush = new SolidColorBrush(Color.FromRgb(34, 197, 94));
                }
                else if (_report.HealthScore >= 70)
                {
                    TxtHealthScore.Foreground = new SolidColorBrush(Color.FromRgb(245, 158, 11)); // Jaune #f59e0b
                    BrdHealthScore.BorderBrush = new SolidColorBrush(Color.FromRgb(245, 158, 11));
                }
                else
                {
                    TxtHealthScore.Foreground = new SolidColorBrush(Color.FromRgb(239, 68, 68)); // Rouge #ef4444
                    BrdHealthScore.BorderBrush = new SolidColorBrush(Color.FromRgb(239, 68, 68));
                }

                // Bannière de mise à jour Core WordPress
                if (_report.NeedsCoreUpdate)
                {
                    BrdCoreUpdate.Visibility = Visibility.Visible;
                    TxtCoreUpdateMsg.Text = $"⚡ Mise à jour WordPress disponible : v{_report.LatestWpVersion} (Installé : v{_report.CurrentWpVersion})";
                }
                else
                {
                    BrdCoreUpdate.Visibility = Visibility.Collapsed;
                }

                TxtSubtitle.Text = $"Dossier : {_project.ProjectDir} | WP actuel : {_report.CurrentWpVersion} (Dernier officiel : {_report.LatestWpVersion}) | {_report.HealthSummary}";

                // Chargement des utilisateurs WordPress
                await LoadUsersAsync();
            }
            catch (Exception ex)
            {
                TxtSubtitle.Text = $"Erreur lors de l'audit : {ex.Message}";
            }
        }

        private async Task LoadUsersAsync()
        {
            if (!_project.IsRunning)
            {
                GridUsers.ItemsSource = null;
                return;
            }

            var users = await WordpressUserService.GetUsersAsync(_project);
            GridUsers.ItemsSource = users;
        }

        private async void BtnRefreshUsers_Click(object sender, RoutedEventArgs e)
        {
            await LoadUsersAsync();
        }

        private async void BtnAddUser_Click(object sender, RoutedEventArgs e)
        {
            if (!_project.IsRunning)
            {
                MessageBox.Show("Le conteneur du site doit être démarré pour ajouter un utilisateur.", "Conteneur Arrêté", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var dlg = new CreateUserDialog { Owner = this };
            if (dlg.ShowDialog() == true)
            {
                var (ok, msg) = await WordpressUserService.CreateUserAsync(_project, dlg.Login, dlg.Email, dlg.Password, dlg.Role);
                if (ok)
                {
                    MessageBox.Show(msg, "Utilisateur Créé", MessageBoxButton.OK, MessageBoxImage.Information);
                    await LoadUsersAsync();
                }
                else
                {
                    MessageBox.Show($"Échec de la création :\n{msg}", "Erreur", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private async void BtnResetPassword_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is WordpressUser user)
            {
                if (!_project.IsRunning)
                {
                    MessageBox.Show("Le conteneur du site doit être démarré pour modifier le mot de passe.", "Conteneur Arrêté", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                var dlg = new ResetPasswordDialog(user.Login) { Owner = this };
                if (dlg.ShowDialog() == true)
                {
                    var (ok, msg) = await WordpressUserService.ResetPasswordAsync(_project, user.Id, dlg.NewPassword);
                    if (ok)
                    {
                        MessageBox.Show($"Le mot de passe pour '{user.Login}' a été mis à jour avec succès !\n\nNouveau mot de passe : {dlg.NewPassword}", "Mot de Passe Réinitialisé", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                    else
                    {
                        MessageBox.Show($"Échec de la réinitialisation :\n{msg}", "Erreur", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
            }
        }

        private async void BtnDeleteUser_Click(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.Tag is WordpressUser user)
            {
                if (!_project.IsRunning)
                {
                    MessageBox.Show("Le conteneur du site doit être démarré pour supprimer un utilisateur.", "Conteneur Arrêté", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                var confirm = MessageBox.Show(
                    $"Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur '{user.Login}' (ID: {user.Id}) ?\n\nSes contenus seront réassignés à l'administrateur principal.",
                    "Confirmation de Suppression Utilisateur",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning
                );

                if (confirm != MessageBoxResult.Yes) return;

                var (ok, msg) = await WordpressUserService.DeleteUserAsync(_project, user.Id);
                if (ok)
                {
                    MessageBox.Show(msg, "Utilisateur Supprimé", MessageBoxButton.OK, MessageBoxImage.Information);
                    await LoadUsersAsync();
                }
                else
                {
                    MessageBox.Show($"Échec de la suppression :\n{msg}", "Erreur", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private async void BtnUpdateWpCore_Click(object sender, RoutedEventArgs e)
        {
            if (!_project.IsRunning)
            {
                MessageBox.Show("Le conteneur Docker du site doit être démarré pour exécuter la mise à jour WordPress.", "Conteneur Arrêté", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var confirm = MessageBox.Show(
                $"Voulez-vous mettre à jour WordPress de la version {_report?.CurrentWpVersion} vers la version {_report?.LatestWpVersion} via WP-CLI ?",
                "Confirmation Mise à Jour WordPress",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question
            );

            if (confirm != MessageBoxResult.Yes) return;

            BtnUpdateWpCore.IsEnabled = false;
            BtnUpdateWpCore.Content = "⏳ Mise à jour en cours...";

            bool updated = await Task.Run(() =>
            {
                try
                {
                    string containerName = $"{_project.ProjectName}-wp";
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"exec {containerName} wp core update --allow-root",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psi))
                    {
                        if (proc == null) return false;
                        proc.WaitForExit(30000);
                        return proc.ExitCode == 0;
                    }
                }
                catch
                {
                    return false;
                }
            });

            if (updated)
            {
                _project.WpVersion = _report?.LatestWpVersion ?? _project.WpVersion;
                MessageBox.Show($"WordPress a été mis à jour avec succès vers la version {_project.WpVersion} !", "Mise à Jour Réussie", MessageBoxButton.OK, MessageBoxImage.Information);
                AuditWindow_Loaded(this, new RoutedEventArgs());
            }
            else
            {
                MessageBox.Show("Échec de la commande de mise à jour WordPress. Vérifiez votre connexion ou les droits du conteneur.", "Erreur", MessageBoxButton.OK, MessageBoxImage.Error);
                BtnUpdateWpCore.IsEnabled = true;
                BtnUpdateWpCore.Content = "⚡ Mettre à jour WordPress";
            }
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }
    }
}
