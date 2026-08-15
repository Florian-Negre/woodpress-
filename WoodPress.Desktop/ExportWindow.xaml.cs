using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Threading.Tasks;
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
            BtnExportAction.IsEnabled = false;
            BtnExportAction.Content = "⏳ Exportation en cours...";

            string exportDir = Path.Combine(_project.ProjectDir, "exports");
            if (!Directory.Exists(exportDir)) Directory.CreateDirectory(exportDir);

            try
            {
                if (OptAzf.IsChecked == true)
                {
                    string file = await AzfArchiveService.CreateAzfPackageAsync(_project, exportDir);
                    MessageBox.Show($"Paquet propriétaire .AZF créé avec succès !\n\nEmplacement : {file}", "Export .AZF Réussi", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else if (OptWpContent.IsChecked == true)
                {
                    string wpContentPath = Path.Combine(_project.ProjectDir, "wp-content");
                    if (!Directory.Exists(wpContentPath))
                    {
                        wpContentPath = Path.Combine(_project.ProjectDir, "wp-content-mirror");
                    }

                    if (!Directory.Exists(wpContentPath))
                    {
                        MessageBox.Show("Le dossier wp-content ou wp-content-mirror est introuvable.", "Dossier Introuvable", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }

                    string zipFile = Path.Combine(exportDir, $"{_project.ProjectName}_wp-content_{DateTime.Now:yyyyMMdd_HHmmss}.zip");
                    await Task.Run(() => ZipFile.CreateFromDirectory(wpContentPath, zipFile, CompressionLevel.Optimal, false));
                    MessageBox.Show($"Archive wp-content créée avec succès !\n\nEmplacement : {zipFile}", "Export Zip Réussi", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else if (OptSql.IsChecked == true)
                {
                    if (!_project.IsRunning)
                    {
                        MessageBox.Show($"Le conteneur de {_project.ClientName} doit être démarré pour extraire la base de données SQL réelle.", "Conteneur Arrêté", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }

                    string sqlFile = Path.Combine(exportDir, $"{_project.ProjectName}_database_{DateTime.Now:yyyyMMdd_HHmmss}.sql");
                    string dbContainer = $"{_project.ProjectName}-db";

                    bool dumped = await Task.Run(() =>
                    {
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
                                if (proc == null) return false;
                                string sql = proc.StandardOutput.ReadToEnd();
                                string err = proc.StandardError.ReadToEnd();
                                proc.WaitForExit(15000);
                                if (proc.ExitCode == 0 && !string.IsNullOrWhiteSpace(sql))
                                {
                                    File.WriteAllText(sqlFile, sql);
                                    return true;
                                }
                                return false;
                            }
                        }
                        catch { return false; }
                    });

                    if (dumped)
                    {
                        MessageBox.Show($"Export MySQL (dump réel) généré avec succès !\n\nEmplacement : {sqlFile}", "Export SQL Réussi", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                    else
                    {
                        MessageBox.Show("Impossible d'exécuter mysqldump sur le conteneur de base de données.", "Échec Dump SQL", MessageBoxButton.OK, MessageBoxImage.Error);
                        return;
                    }
                }
                else if (OptFullZip.IsChecked == true)
                {
                    // Pour éviter le conflit d'écrire le zip dans le dossier qu'on compresse
                    string tempZip = Path.Combine(Path.GetTempPath(), $"{_project.ProjectName}_backup-full_{DateTime.Now:yyyyMMdd_HHmmss}.zip");
                    string finalZip = Path.Combine(exportDir, Path.GetFileName(tempZip));

                    await Task.Run(() =>
                    {
                        using (var zip = ZipFile.Open(tempZip, ZipArchiveMode.Create))
                        {
                            foreach (var file in Directory.GetFiles(_project.ProjectDir, "*.*", SearchOption.AllDirectories))
                            {
                                // Exclure le sous-dossier exports pour éviter la récursion
                                if (file.StartsWith(exportDir, StringComparison.OrdinalIgnoreCase)) continue;

                                string rel = file.Substring(_project.ProjectDir.Length).TrimStart('\\', '/');
                                zip.CreateEntryFromFile(file, rel);
                            }
                        }
                        if (File.Exists(finalZip)) File.Delete(finalZip);
                        File.Move(tempZip, finalZip);
                    });

                    MessageBox.Show($"Backup complet créé avec succès !\n\nEmplacement : {finalZip}", "Backup Réussi", MessageBoxButton.OK, MessageBoxImage.Information);
                }

                System.Diagnostics.Process.Start("explorer.exe", $"\"{exportDir}\"");
                Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erreur lors de l'exportation : {ex.Message}", "Erreur Export", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                BtnExportAction.IsEnabled = true;
                BtnExportAction.Content = "💾 Générer l'Exportation";
            }
        }
    }
}
