using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using WoodPress.Core.Services;

namespace WoodPress.Desktop
{
    public partial class CreateUserDialog : Window
    {
        public string Login => TxtLogin.Text.Trim();
        public string Email => TxtEmail.Text.Trim();
        public string Password => TxtPassword.Text.Trim();
        public string Role
        {
            get
            {
                if (CboRole.SelectedItem is ComboBoxItem item && item.Tag != null)
                {
                    return item.Tag.ToString() ?? "administrator";
                }
                return "administrator";
            }
        }

        public CreateUserDialog()
        {
            InitializeComponent();
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

        private void BtnSubmit_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(Login))
            {
                MessageBox.Show("Veuillez saisir un identifiant.", "Champ Requis", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (string.IsNullOrWhiteSpace(Email))
            {
                MessageBox.Show("Veuillez saisir une adresse email.", "Champ Requis", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (string.IsNullOrWhiteSpace(Password))
            {
                MessageBox.Show("Veuillez définir un mot de passe.", "Champ Requis", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            DialogResult = true;
            Close();
        }
    }
}
