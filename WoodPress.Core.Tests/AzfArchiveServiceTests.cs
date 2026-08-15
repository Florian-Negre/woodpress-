using System;
using System.IO;
using System.Threading.Tasks;
using WoodPress.Core.Models;
using WoodPress.Core.Services;
using Xunit;

namespace WoodPress.Core.Tests
{
    public class AzfArchiveServiceTests
    {
        [Fact]
        public async Task CreateAndReadManifest_ShouldPreserveMetadata()
        {
            // Arrange
            string tempDir = Path.Combine(Path.GetTempPath(), "woodpress_test_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDir);

            string projectDir = Path.Combine(tempDir, "sample-project");
            Directory.CreateDirectory(projectDir);
            File.WriteAllText(Path.Combine(projectDir, "docker-compose.yml"), "version: '3.8'\nservices:\n  wordpress:\n    image: wordpress:7.0.4-php8.4\n");

            var project = new ProjectInfo
            {
                ProjectName = "sample-project",
                ClientName = "Sample Client",
                ProjectDir = projectDir,
                ComposeDir = projectDir,
                WpVersion = "7.0.4",
                PhpVersion = "8.4",
                HttpPort = 8090,
                DbPort = 3310
            };

            try
            {
                // Act
                string azfFile = await AzfArchiveService.CreateAzfPackageAsync(project, tempDir, "Test Unit");

                // Assert
                Assert.True(File.Exists(azfFile));

                var manifest = await AzfArchiveService.ReadManifestAsync(azfFile);
                Assert.NotNull(manifest);
                Assert.Equal("sample-project", manifest.ProjectName);
                Assert.Equal("Sample Client", manifest.ClientName);
                Assert.Equal("7.0.4", manifest.WpVersion);
                Assert.Equal("8.4", manifest.PhpVersion);
                Assert.Equal(8090, manifest.OriginalHttpPort);
                Assert.Equal("Test Unit", manifest.CustomNotes);
            }
            finally
            {
                if (Directory.Exists(tempDir))
                {
                    try { Directory.Delete(tempDir, true); } catch { }
                }
            }
        }
    }
}
