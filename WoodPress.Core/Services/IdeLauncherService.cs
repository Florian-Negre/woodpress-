using System;
using System.Diagnostics;
using System.IO;

namespace WoodPress.Core.Services
{
    public static class IdeLauncherService
    {
        /// <summary>
        /// Ouvre un projet local ou volume dans l'IDE préféré sous Windows/Linux
        /// </summary>
        public static bool OpenProjectInIde(string projectDir, string preferredIde = "code", string customExePath = "")
        {
            if (string.IsNullOrWhiteSpace(projectDir) || !Directory.Exists(projectDir))
            {
                return false;
            }

            string executable = "code.cmd";
            if (OperatingSystem.IsWindows())
            {
                switch (preferredIde?.ToLowerInvariant())
                {
                    case "cursor":
                        executable = "cursor.cmd";
                        break;
                    case "phpstorm":
                        executable = "phpstorm.bat";
                        break;
                    case "windsurf":
                        executable = "windsurf.cmd";
                        break;
                    case "custom":
                        if (!string.IsNullOrWhiteSpace(customExePath)) executable = customExePath;
                        break;
                    default:
                        executable = "code.cmd";
                        break;
                }
            }
            else
            {
                // Linux / macOS
                switch (preferredIde?.ToLowerInvariant())
                {
                    case "cursor": executable = "cursor"; break;
                    case "phpstorm": executable = "phpstorm"; break;
                    case "windsurf": executable = "windsurf"; break;
                    default: executable = "code"; break;
                }
            }

            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = executable,
                    Arguments = $"\"{projectDir}\"",
                    UseShellExecute = true,
                    CreateNoWindow = true
                };

                Process.Start(psi);
                return true;
            }
            catch (Exception)
            {
                // Fallback sur l'explorateur Windows ou le gestionnaire de fichiers Linux
                try
                {
                    if (OperatingSystem.IsWindows())
                    {
                        Process.Start("explorer.exe", $"\"{projectDir}\"");
                    }
                    else
                    {
                        Process.Start("xdg-open", $"\"{projectDir}\"");
                    }
                    return true;
                }
                catch
                {
                    return false;
                }
            }
        }
    }
}
