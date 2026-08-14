using System;
using System.Net;
using System.Net.Sockets;

namespace WoodPress.Core.Services
{
    public static class PortScannerService
    {
        /// <summary>
        /// Teste si un port TCP est disponible sur localhost
        /// </summary>
        public static bool IsPortAvailable(int port)
        {
            try
            {
                using (var socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp))
                {
                    socket.Bind(new IPEndPoint(IPAddress.Loopback, port));
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Propose un ensemble de ports TCP libres pour un nouveau projet (HTTP, BDD, PMA, Mail)
        /// </summary>
        public static (int httpPort, int dbPort, int pmaPort, int mailPort) SuggestProjectPorts(int startHttp = 8081, int startDb = 3307, int startPma = 8086, int startMail = 8025)
        {
            int http = FindNextAvailablePort(startHttp);
            int db = FindNextAvailablePort(startDb);
            int pma = FindNextAvailablePort(startPma);
            int mail = FindNextAvailablePort(startMail);

            return (http, db, pma, mail);
        }

        private static int FindNextAvailablePort(int startPort)
        {
            for (int port = startPort; port < startPort + 100; port++)
            {
                if (IsPortAvailable(port))
                {
                    return port;
                }
            }
            return startPort;
        }
    }
}
