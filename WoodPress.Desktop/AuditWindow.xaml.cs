using System.Windows;
using WoodPress.Core.Models;
using WoodPress.Core.Services;

namespace WoodPress.Desktop
{
    public partial class AuditWindow : Window
    {
        public AuditWindow(ProjectInfo project)
        {
            InitializeComponent();
            TxtTitle.Text = $"🔍 Audit & Détails : {project.ClientName}";
            TxtSubtitle.Text = $"Dossier : {project.ProjectDir} | Version WP : {project.WpVersion}";

            var (plugins, themes) = PluginAuditService.AuditProject(project);
            GridPlugins.ItemsSource = plugins;
            GridThemes.ItemsSource = themes;
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }
    }
}
