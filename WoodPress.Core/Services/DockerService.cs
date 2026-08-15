using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace WoodPress.Core.Services
{
    public static class DockerService
    {
        /// <summary>
        /// Teste si le daemon Docker est en cours d'exécution
        /// </summary>
        public static async Task<bool> IsDockerRunningAsync()
        {
            return await Task.Run(() =>
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = "info",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psi))
                    {
                        if (proc == null) return false;
                        proc.WaitForExit(3000);
                        return proc.ExitCode == 0;
                    }
                }
                catch
                {
                    return false;
                }
            });
        }

        /// <summary>
        /// Lance l'application Docker Desktop sous Windows
        /// </summary>
        public static async Task<bool> LaunchDockerDesktopAsync()
        {
            return await Task.Run(() =>
            {
                try
                {
                    string dockerDesktopPath = @"C:\Program Files\Docker\Docker\Docker Desktop.exe";
                    if (File.Exists(dockerDesktopPath))
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = dockerDesktopPath,
                            UseShellExecute = true
                        });
                        return true;
                    }
                    return false;
                }
                catch
                {
                    return false;
                }
            });
        }

        /// <summary>
        /// Obtient le statut en temps réel d'un conteneur ("running", "stopped", "starting", "not_linked")
        /// </summary>
        public static async Task<string> GetContainerStatusAsync(string containerName)
        {
            if (string.IsNullOrWhiteSpace(containerName)) return "not_linked";

            return await Task.Run(() =>
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"inspect --format=\"{{{{.State.Status}}}}\" {containerName}",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };

                    using (var proc = Process.Start(psi))
                    {
                        if (proc == null) return "not_linked";
                        string output = proc.StandardOutput.ReadToEnd().Trim();
                        proc.WaitForExit(3000);

                        if (proc.ExitCode != 0) return "stopped";
                        if (output.Equals("running", StringComparison.OrdinalIgnoreCase)) return "running";
                        if (output.Contains("restarting") || output.Contains("created")) return "starting";
                        return "stopped";
                    }
                }
                catch
                {
                    return "stopped";
                }
            });
        }

        /// <summary>
        /// Trouve le nom réel d'un conteneur pour un service donné via docker compose ps
        /// </summary>
        public static async Task<string> GetServiceContainerNameAsync(string composeDir, string serviceName = "wordpress")
        {
            if (string.IsNullOrWhiteSpace(composeDir) || !Directory.Exists(composeDir)) return string.Empty;

            return await Task.Run(() =>
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = "compose ps --format json",
                        WorkingDirectory = composeDir,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psi))
                    {
                        if (proc == null) return string.Empty;
                        string json = proc.StandardOutput.ReadToEnd();
                        proc.WaitForExit(3000);
                        if (proc.ExitCode == 0 && !string.IsNullOrWhiteSpace(json))
                        {
                            // Docker Compose JSON peut être une liste ou des objets par ligne
                            var lines = json.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                            foreach (var line in lines)
                            {
                                try
                                {
                                    using (var doc = JsonDocument.Parse(line.Trim()))
                                    {
                                        var root = doc.RootElement;
                                        if (root.ValueKind == JsonValueKind.Array)
                                        {
                                            foreach (var item in root.EnumerateArray())
                                            {
                                                string sName = item.TryGetProperty("Service", out var s) ? s.GetString() ?? "" : "";
                                                if (sName.Equals(serviceName, StringComparison.OrdinalIgnoreCase))
                                                {
                                                    return item.TryGetProperty("Name", out var n) ? n.GetString() ?? "" : "";
                                                }
                                            }
                                        }
                                        else if (root.ValueKind == JsonValueKind.Object)
                                        {
                                            string sName = root.TryGetProperty("Service", out var s) ? s.GetString() ?? "" : "";
                                            if (sName.Equals(serviceName, StringComparison.OrdinalIgnoreCase))
                                            {
                                                return root.TryGetProperty("Name", out var n) ? n.GetString() ?? "" : "";
                                            }
                                        }
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                }
                catch { }

                return string.Empty;
            });
        }

        /// <summary>
        /// Démarre les conteneurs docker-compose d'un projet
        /// </summary>
        public static async Task<bool> StartContainersAsync(string composeDir)
        {
            return await RunDockerComposeCmdAsync(composeDir, "up -d");
        }

        /// <summary>
        /// Arrête les conteneurs docker-compose d'un projet
        /// </summary>
        public static async Task<bool> StopContainersAsync(string composeDir)
        {
            return await RunDockerComposeCmdAsync(composeDir, "stop");
        }

        /// <summary>
        /// Redémarre les conteneurs docker-compose d'un projet
        /// </summary>
        public static async Task<bool> RestartContainersAsync(string composeDir)
        {
            return await RunDockerComposeCmdAsync(composeDir, "restart");
        }

        /// <summary>
        /// Exécute une commande docker-compose dans le répertoire du projet
        /// </summary>
        private static async Task<bool> RunDockerComposeCmdAsync(string composeDir, string subCommand)
        {
            if (string.IsNullOrWhiteSpace(composeDir) || !Directory.Exists(composeDir))
            {
                return false;
            }

            return await Task.Run(() =>
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"compose {subCommand}",
                        WorkingDirectory = composeDir,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };

                    using (var proc = Process.Start(psi))
                    {
                        if (proc == null) return false;
                        proc.WaitForExit(30000);
                        return proc.ExitCode == 0;
                    }
                }
                catch
                {
                    return false;
                }
            });
        }
    }
}
