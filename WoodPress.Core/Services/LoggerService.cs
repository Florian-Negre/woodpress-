using System;
using System.IO;

namespace WoodPress.Core.Services
{
    public static class LoggerService
    {
        private static readonly string LogDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "WoodPress", "logs");
        private static readonly string LogFile = Path.Combine(LogDir, "woodpress.log");
        private static readonly object LockObj = new object();

        static LoggerService()
        {
            try
            {
                if (!Directory.Exists(LogDir))
                {
                    Directory.CreateDirectory(LogDir);
                }
            }
            catch { }
        }

        public static void LogInfo(string message) => Write("INFO", message);
        public static void LogWarning(string message) => Write("WARN", message);
        public static void LogError(string message, Exception? ex = null)
        {
            string detail = ex != null ? $"{message} | Exception: {ex.GetType().Name}: {ex.Message}\n{ex.StackTrace}" : message;
            Write("ERROR", detail);
        }

        private static void Write(string level, string message)
        {
            try
            {
                lock (LockObj)
                {
                    string line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [{level}] {message}{Environment.NewLine}";
                    File.AppendAllText(LogFile, line);
                }
            }
            catch { }
        }
    }
}
