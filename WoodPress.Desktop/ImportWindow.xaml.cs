using System;
using System.IO;
using System.Windows;
using Microsoft.Win32;
using WoodPress.Core.Models;
using WoodPress.Core.Services;

namespace WoodPress.Desktop
{
    public partial class ImportWindow : Window
    {
        public ProjectInfo? ImportedProject { get; private set; }

        public ImportWindow()
        {
            InitializeComponent();
        }

        private void FormatRadio_Checked(object sender, RoutedEventArgs e)
        {
            // Réinitialiser le chemin si on change de format
            if (TxtFilePath != null) TxtFilePath.Text = string.Empty;
        }

        private void BtnBrowse_Click(object sender, RoutedEventArgs e)
        {
            string filter = "Paquet WoodPress (*.azf)|*.azf";
            if (OptZip.IsChecked == true) filter = "Archive Zip WordPress (*.zip)|*.zip";
            else if (OptWpress.IsChecked == true) filter = "Archive All-in-One WP Migration (*.wpress)|*.wpress";

            var dlg = new OpenFileDialog
            {
                Title = "Sélectionner l'archive à importer",
                Filter = filter + "|Tous les fichiers (*.*)|*.*"
            };

            if (dlg.ShowDialog(this) == true)
            {
                TxtFilePath.Text = dlg.FileName;
            }
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private async void BtnSubmitImport_Click(object sender, RoutedEventArgs e)
        {
            string filePath = TxtFilePath.Text.Trim();
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
            {
                MessageBox.Show("Veuillez sélectionner un fichier d'archive valide.", "Fichier Manquant", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            string targetBaseDir = @"G:\Workspace";
            if (CboWorkspace.SelectedIndex == 1)
            {
                targetBaseDir = @"E:\E-Dev\WordPress";
            }

            BtnSubmitImport.IsEnabled = false;
            BtnSubmitImport.Content = "⏳ Importation en cours...";

            try
            {
                var imported = await UniversalImportService.ImportProjectArchiveAsync(filePath, targetBaseDir);
                ImportedProject = imported;

                MessageBox.Show(
                    $"Projet '{imported.ClientName}' importé avec succès !\n\n📁 Emplacement : {imported.ProjectDir}\n🌐 Port HTTP : :{imported.HttpPort}\n🗄️ Port MySQL : :{imported.DbPort}",
                    "Importation Réussie",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information
                );

                DialogResult = true;
                Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erreur lors de l'importation : {ex.Message}", "Échec Importation", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                BtnSubmitImport.IsEnabled = true;
                BtnSubmitImport.Content = "📥 Lancer l'Importation";
            }
        }
    }
}
