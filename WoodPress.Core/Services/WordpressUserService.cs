using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using WoodPress.Core.Models;

namespace WoodPress.Core.Services
{
    public class WordpressUser
    {
        public int Id { get; set; }
        public string Login { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = "administrator";
        public string DisplayName { get; set; } = string.Empty;
    }

    public static class WordpressUserService
    {
        public static async Task<List<WordpressUser>> GetUsersAsync(ProjectInfo project)
        {
            var list = new List<WordpressUser>();
            if (project == null || !project.IsRunning) return list;

            string containerName = await ResolveWpContainerNameAsync(project);
            if (string.IsNullOrEmpty(containerName)) return list;

            string phpCode = @"
require_once '/var/www/html/wp-load.php';
$users = get_users();
$out = [];
foreach($users as $u) {
    $out[] = [
        'ID' => $u->ID,
        'user_login' => $u->user_login,
        'user_email' => $u->user_email,
        'roles' => implode(', ', $u->roles),
        'display_name' => $u->display_name
    ];
}
echo 'WP_USERS_JSON:' . json_encode($out);
";

            string output = await ExecutePhpInContainerAsync(containerName, phpCode);
            int idx = output.IndexOf("WP_USERS_JSON:", StringComparison.Ordinal);
            if (idx >= 0)
            {
                string json = output.Substring(idx + "WP_USERS_JSON:".Length).Trim();
                try
                {
                    using (var doc = JsonDocument.Parse(json))
                    {
                        foreach (var elem in doc.RootElement.EnumerateArray())
                        {
                            int id = elem.TryGetProperty("ID", out var idProp) ? idProp.GetInt32() : 1;
                            string login = elem.TryGetProperty("user_login", out var l) ? l.GetString() ?? "" : "";
                            string email = elem.TryGetProperty("user_email", out var e) ? e.GetString() ?? "" : "";
                            string roles = elem.TryGetProperty("roles", out var r) ? r.GetString() ?? "administrator" : "administrator";
                            string name = elem.TryGetProperty("display_name", out var d) ? d.GetString() ?? login : login;

                            list.Add(new WordpressUser
                            {
                                Id = id,
                                Login = login,
                                Email = email,
                                Role = roles,
                                DisplayName = name
                            });
                        }
                    }
                }
                catch { }
            }

            return list;
        }

        public static async Task<(bool success, string message)> CreateUserAsync(ProjectInfo project, string login, string email, string password, string role)
        {
            if (project == null || !project.IsRunning)
            {
                return (false, "Le conteneur du site doit être démarré.");
            }

            string containerName = await ResolveWpContainerNameAsync(project);
            if (string.IsNullOrEmpty(containerName))
            {
                return (false, "Impossible de résoudre le conteneur WordPress.");
            }

            string escapedLogin = login.Replace("'", "\\'");
            string escapedEmail = email.Replace("'", "\\'");
            string escapedPass = password.Replace("'", "\\'");
            string escapedRole = role.Replace("'", "\\'");

            string phpCode = $@"
require_once '/var/www/html/wp-load.php';
$id = wp_create_user('{escapedLogin}', '{escapedPass}', '{escapedEmail}');
if (is_wp_error($id)) {{
    echo 'WP_USER_ERROR:' . $id->get_error_message();
}} else {{
    $u = new WP_User($id);
    $u->set_role('{escapedRole}');
    echo 'WP_USER_SUCCESS:' . $id;
}}
";

            string output = await ExecutePhpInContainerAsync(containerName, phpCode);
            if (output.Contains("WP_USER_SUCCESS:"))
            {
                return (true, $"Utilisateur '{login}' créé avec succès !");
            }
            if (output.Contains("WP_USER_ERROR:"))
            {
                string err = output.Substring(output.IndexOf("WP_USER_ERROR:", StringComparison.Ordinal) + "WP_USER_ERROR:".Length).Trim();
                return (false, err);
            }

            return (false, !string.IsNullOrWhiteSpace(output) ? output : "Erreur inconnue lors de la création.");
        }

        public static async Task<(bool success, string message)> ResetPasswordAsync(ProjectInfo project, int userId, string newPassword)
        {
            if (project == null || !project.IsRunning)
            {
                return (false, "Le conteneur du site doit être démarré.");
            }

            string containerName = await ResolveWpContainerNameAsync(project);
            if (string.IsNullOrEmpty(containerName))
            {
                return (false, "Impossible de résoudre le conteneur WordPress.");
            }

            string escapedPass = newPassword.Replace("'", "\\'");
            string phpCode = $@"
require_once '/var/www/html/wp-load.php';
wp_set_password('{escapedPass}', {userId});
echo 'WP_USER_SUCCESS:OK';
";

            string output = await ExecutePhpInContainerAsync(containerName, phpCode);
            if (output.Contains("WP_USER_SUCCESS:OK"))
            {
                return (true, "Mot de passe réinitialisé avec succès !");
            }

            return (false, !string.IsNullOrWhiteSpace(output) ? output : "Erreur lors de la réinitialisation.");
        }

        public static async Task<(bool success, string message)> DeleteUserAsync(ProjectInfo project, int userId)
        {
            if (project == null || !project.IsRunning)
            {
                return (false, "Le conteneur du site doit être démarré.");
            }

            string containerName = await ResolveWpContainerNameAsync(project);
            if (string.IsNullOrEmpty(containerName))
            {
                return (false, "Impossible de résoudre le conteneur WordPress.");
            }

            string phpCode = $@"
require_once '/var/www/html/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/user.php';
$ok = wp_delete_user({userId}, 1);
echo $ok ? 'WP_USER_SUCCESS:OK' : 'WP_USER_ERROR:Impossible de supprimer cet utilisateur';
";

            string output = await ExecutePhpInContainerAsync(containerName, phpCode);
            if (output.Contains("WP_USER_SUCCESS:OK"))
            {
                return (true, "Utilisateur supprimé avec succès !");
            }
            if (output.Contains("WP_USER_ERROR:"))
            {
                string err = output.Substring(output.IndexOf("WP_USER_ERROR:", StringComparison.Ordinal) + "WP_USER_ERROR:".Length).Trim();
                return (false, err);
            }

            return (false, !string.IsNullOrWhiteSpace(output) ? output : "Erreur lors de la suppression.");
        }

        private static async Task<string> ResolveWpContainerNameAsync(ProjectInfo project)
        {
            if (!string.IsNullOrEmpty(project.ComposeDir))
            {
                string resolved = await DockerService.GetServiceContainerNameAsync(project.ComposeDir, "wordpress");
                if (!string.IsNullOrEmpty(resolved)) return resolved;
            }

            string directLower = $"{project.ProjectName.ToLowerInvariant()}-wp";
            string status = await DockerService.GetContainerStatusAsync(directLower);
            if (status == "running") return directLower;

            return $"{project.ProjectName}-wp";
        }

        private static async Task<string> ExecutePhpInContainerAsync(string containerName, string phpCode)
        {
            return await Task.Run(() =>
            {
                try
                {
                    string b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(phpCode));
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
                        if (proc == null) return string.Empty;
                        string outStr = proc.StandardOutput.ReadToEnd();
                        string errStr = proc.StandardError.ReadToEnd();
                        proc.WaitForExit(10000);

                        return outStr + (string.IsNullOrWhiteSpace(outStr) ? errStr : "");
                    }
                }
                catch (Exception ex)
                {
                    return $"Erreur exécution: {ex.Message}";
                }
            });
        }

        public static string GenerateStrongPassword(int length = 16)
        {
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
            var bytes = new byte[length];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            var res = new char[length];
            for (int i = 0; i < length; i++)
            {
                res[i] = chars[bytes[i] % chars.Length];
            }
            return new string(res);
        }

        public static (string label, string color) EvaluatePasswordStrength(string password)
        {
            if (string.IsNullOrEmpty(password)) return ("Vide", "#94a3b8");
            if (password.Length < 8) return ("Faible 🔴", "#ef4444");

            int score = 0;
            if (password.Length >= 12) score += 2;
            else if (password.Length >= 8) score += 1;

            if (Regex.IsMatch(password, @"[a-z]") && Regex.IsMatch(password, @"[A-Z]")) score++;
            if (Regex.IsMatch(password, @"\d")) score++;
            if (Regex.IsMatch(password, @"[!@#$%^&*()_\-+=\[\]{}|]")) score++;

            return score switch
            {
                >= 4 => ("Béton Armé 🛡️", "#22c55e"),
                3 => ("Fort 🟢", "#8BC34A"),
                2 => ("Moyen 🟡", "#f59e0b"),
                _ => ("Faible 🔴", "#ef4444")
            };
        }
    }
}
