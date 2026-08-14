using System;
using System.Security.Cryptography;
using System.Text;

namespace WoodPress.Core.Services
{
    public static class WpAccountService
    {
        /// <summary>
        /// Génère un mot de passe très sécurisé (ex: AzF-8$kL@2026!)
        /// </summary>
        public static string GenerateSecurePassword(int length = 16)
        {
            const string validChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*()_+-=";
            var res = new StringBuilder();
            using (var rng = RandomNumberGenerator.Create())
            {
                byte[] uintBuffer = new byte[sizeof(uint)];
                while (res.Length < length)
                {
                    rng.GetBytes(uintBuffer);
                    uint num = BitConverter.ToUInt32(uintBuffer, 0);
                    res.Append(validChars[(int)(num % (uint)validChars.Length)]);
                }
            }
            return $"AzF-{res}";
        }
    }
}
