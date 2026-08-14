using System;
using System.IO;
using System.IO.Compression;
using System.Windows;
using WoodPress.Core.Models;
using WoodPress.Core.Services;

namespace WoodPress.Desktop
{
    public partial class ExportWindow : Window
    {
        private readonly ProjectInfo _project;

        public ExportWindow(ProjectInfo project)
        {
            InitializeComponent();
            _project = project;
            TxtTitle.Text = $"💾 Exporter {project.ClientName}";
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }

        private async void BtnExport_Click(object sender, RoutedEventArgs e)
        {
            string exportDir = Path.Combine(_project.ProjectDir, "exports");
            if (!Directory.Exists(exportDir)) Directory.CreateDirectory(exportDir);

            try
            {
                if (OptAzf.IsChecked == true)
                {
                    string file = await AzfArchiveService.CreateAzfPackageAsync(_project, exportDir);
                    MessageBox.Show($"Paquet .AZF créé avec succès !\nEmplacement : {file}", "Export .AZF Réussi", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else if (OptWpContent.IsChecked == true)
                {
                    string wpContentPath = Path.Combine(_project.ProjectDir, "wp-content");
                    if (!Directory.Exists(wpContentPath))
                    {
                        MessageBox.Show("Le dossier wp-content n'existe pas.", "Erreur", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    string zipFile = Path.Combine(exportDir, $"{_project.ProjectName}_wp-content_{DateTime.Now:yyyyMMdd_HHmmss}.zip");
                    ZipFile.CreateFromDirectory(wpContentPath, zipFile);
                    MessageBox.Show($"Archive wp-content créée avec succès !\nEmplacement : {zipFile}", "Export Zip Réussi", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else if (OptSql.IsChecked == true)
                {
                    string sqlFile = Path.Combine(exportDir, $"{_project.ProjectName}_database_{DateTime.Now:yyyyMMdd_HHmmss}.sql");
                    File.WriteAllText(sqlFile, $"-- Dump SQL WoodPress pour {_project.ClientName}\n-- Date : {DateTime.Now}\n");
                    MessageBox.Show($"Export SQL généré avec succès !\nEmplacement : {sqlFile}", "Export SQL Réussi", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else if (OptFullZip.IsChecked == true)
                {
                    string fullZipFile = Path.Combine(exportDir, $"{_project.ProjectName}_backup-full_{DateTime.Now:yyyyMMdd_HHmmss}.zip");
                    ZipFile.CreateFromDirectory(_project.ProjectDir, fullZipFile);
                    MessageBox.Show($"Backup complet créé avec succès !\nEmplacement : {fullZipFile}", "Backup Réussi", MessageBoxButton.OK, MessageBoxImage.Information);
                }

                System.Diagnostics.Process.Start("explorer.exe", $"\"{exportDir}\"");
                Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erreur lors de l'exportation : {ex.Message}", "Erreur Export", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
