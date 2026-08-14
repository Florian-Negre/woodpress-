using System;
using System.Diagnostics;
using System.IO;
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
