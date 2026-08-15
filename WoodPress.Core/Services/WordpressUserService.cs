using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Security.Cryptography;
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

            string containerName = $"{project.ProjectName.ToLowerInvariant()}-wp";

            return await Task.Run(() =>
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"exec {containerName} wp user list --format=json --allow-root",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psi))
                    {
                        if (proc == null) return list;
                        string json = proc.StandardOutput.ReadToEnd();
                        proc.WaitForExit(5000);
                        if (proc.ExitCode == 0 && !string.IsNullOrWhiteSpace(json))
                        {
                            using (var doc = JsonDocument.Parse(json))
                            {
                                foreach (var elem in doc.RootElement.EnumerateArray())
                                {
                                    int id = elem.TryGetProperty("ID", out var idProp) && idProp.TryGetInt32(out var i) ? i : (int.TryParse(idProp.GetString(), out var parsedId) ? parsedId : 1);
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
                    }
                }
                catch { }

                return list;
            });
        }

        public static async Task<(bool success, string message)> CreateUserAsync(ProjectInfo project, string login, string email, string password, string role)
        {
            if (project == null || !project.IsRunning)
            {
                return (false, "Le conteneur du site doit être démarré.");
            }

            string containerName = $"{project.ProjectName.ToLowerInvariant()}-wp";

            return await Task.Run(() =>
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"exec {containerName} wp user create \"{login}\" \"{email}\" --role={role} --user_pass=\"{password}\" --allow-root",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psi))
                    {
                        if (proc == null) return (false, "Impossible de lancer Docker.");
                        string outStr = proc.StandardOutput.ReadToEnd();
                        string errStr = proc.StandardError.ReadToEnd();
                        proc.WaitForExit(10000);

                        if (proc.ExitCode == 0)
                        {
                            return (true, $"Utilisateur '{login}' créé avec succès !");
                        }
                        return (false, !string.IsNullOrWhiteSpace(errStr) ? errStr : outStr);
                    }
                }
                catch (Exception ex)
                {
                    return (false, ex.Message);
                }
            });
        }

        public static async Task<(bool success, string message)> ResetPasswordAsync(ProjectInfo project, int userId, string newPassword)
        {
            if (project == null || !project.IsRunning)
            {
                return (false, "Le conteneur du site doit être démarré.");
            }

            string containerName = $"{project.ProjectName.ToLowerInvariant()}-wp";

            return await Task.Run(() =>
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"exec {containerName} wp user update {userId} --user_pass=\"{newPassword}\" --allow-root",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psi))
                    {
                        if (proc == null) return (false, "Impossible de lancer Docker.");
                        string outStr = proc.StandardOutput.ReadToEnd();
                        string errStr = proc.StandardError.ReadToEnd();
                        proc.WaitForExit(10000);

                        if (proc.ExitCode == 0)
                        {
                            return (true, "Mot de passe réinitialisé avec succès !");
                        }
                        return (false, !string.IsNullOrWhiteSpace(errStr) ? errStr : outStr);
                    }
                }
                catch (Exception ex)
                {
                    return (false, ex.Message);
                }
            });
        }

        public static async Task<(bool success, string message)> DeleteUserAsync(ProjectInfo project, int userId)
        {
            if (project == null || !project.IsRunning)
            {
                return (false, "Le conteneur du site doit être démarré.");
            }

            string containerName = $"{project.ProjectName.ToLowerInvariant()}-wp";

            return await Task.Run(() =>
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"exec {containerName} wp user delete {userId} --reassign=1 --yes --allow-root",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psi))
                    {
                        if (proc == null) return (false, "Impossible de lancer Docker.");
                        string outStr = proc.StandardOutput.ReadToEnd();
                        string errStr = proc.StandardError.ReadToEnd();
                        proc.WaitForExit(10000);

                        if (proc.ExitCode == 0)
                        {
                            return (true, "Utilisateur supprimé avec succès !");
                        }
                        return (false, !string.IsNullOrWhiteSpace(errStr) ? errStr : outStr);
                    }
                }
                catch (Exception ex)
                {
                    return (false, ex.Message);
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
