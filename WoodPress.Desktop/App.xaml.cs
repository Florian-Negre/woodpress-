using System;
using System.Windows;

namespace WoodPress.Desktop
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            AppDomain.CurrentDomain.UnhandledException += (s, args) =>
            {
                MessageBox.Show($"Erreur non gérée : {args.ExceptionObject}", "Erreur WoodPress", MessageBoxButton.OK, MessageBoxImage.Error);
            };

            DispatcherUnhandledException += (s, args) =>
            {
                MessageBox.Show($"Erreur UI : {args.Exception.Message}\n\n{args.Exception.StackTrace}", "Erreur WoodPress UI", MessageBoxButton.OK, MessageBoxImage.Error);
                args.Handled = true;
            };

            base.OnStartup(e);
        }
    }
}
