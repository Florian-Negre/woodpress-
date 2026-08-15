using System.Threading.Tasks;
using System.Windows;
using WoodPress.Core.Models;
using WoodPress.Core.Services;

namespace WoodPress.Desktop
{
    public partial class AuditWindow : Window
    {
        private readonly ProjectInfo _project;

        public AuditWindow(ProjectInfo project)
        {
            InitializeComponent();
            _project = project;
            TxtTitle.Text = $"🔍 Audit & Détails : {project.ClientName}";
            TxtSubtitle.Text = $"Dossier : {project.ProjectDir} | Version WP : {project.WpVersion} — Analyse en cours...";

            Loaded += AuditWindow_Loaded;
        }

        private async void AuditWindow_Loaded(object sender, RoutedEventArgs e)
        {
            // Exécution asynchrone hors du thread UI
            var (plugins, themes) = await Task.Run(() => PluginAuditService.AuditProject(_project));

            GridPlugins.ItemsSource = plugins;
            GridThemes.ItemsSource = themes;

            string statusSummary = $"{plugins.Count} extension(s), {themes.Count} thème(s)";
            if (plugins.Count == 0 && !_project.IsRunning)
            {
                statusSummary += " (Démarrez le conteneur Docker pour interroger WP-CLI)";
            }
            TxtSubtitle.Text = $"Dossier : {_project.ProjectDir} | Version WP : {_project.WpVersion} | {statusSummary}";
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }
    }
}
