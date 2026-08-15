using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using WoodPress.Core.Services;

namespace WoodPress.Desktop
{
    public partial class ResetPasswordDialog : Window
    {
        public string NewPassword { get; private set; } = string.Empty;

        public ResetPasswordDialog(string username)
        {
            InitializeComponent();
            TxtUserTitle.Text = $"🔑 Mot de passe : {username}";
            TxtPassword.Text = WordpressUserService.GenerateStrongPassword(16);
        }

        private void BtnGenerate_Click(object sender, RoutedEventArgs e)
        {
            TxtPassword.Text = WordpressUserService.GenerateStrongPassword(16);
        }

        private void TxtPassword_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (TxtStrength == null) return;

            var (label, colorHex) = WordpressUserService.EvaluatePasswordStrength(TxtPassword.Text);
            TxtStrength.Text = label;
            try
            {
                var color = (Color)ColorConverter.ConvertFromString(colorHex);
                TxtStrength.Foreground = new SolidColorBrush(color);
            }
            catch { }
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnSave_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(TxtPassword.Text))
            {
                MessageBox.Show("Le mot de passe ne peut pas être vide.", "Mot de passe requis", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            NewPassword = TxtPassword.Text.Trim();
            DialogResult = true;
            Close();
        }
    }
}
