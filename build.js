const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const AdmZip = require('adm-zip');
const { rcedit } = require('rcedit');

// Helper to copy files
function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// Redirect-aware HTTP/HTTPS download function with progress bar
function downloadFile(fileUrl, targetPath) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(fileUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    protocol.get(fileUrl, (response) => {
      // Follow 3xx redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, targetPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to get '${fileUrl}' (Status Code: ${response.statusCode})`));
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      const fileStream = fs.createWriteStream(targetPath);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(2);
          process.stdout.write(`Downloading: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB / ${(totalSize / 1024 / 1024).toFixed(2)} MB)\r`);
        } else {
          process.stdout.write(`Downloading: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB\r`);
        }
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log('\nDownload completed!');
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(targetPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function run() {
  const electronVersion = '32.1.0';
  const downloadUrl = `https://npmmirror.com/mirrors/electron/${electronVersion}/electron-v${electronVersion}-win32-arm64.zip`;
  const zipPath = path.resolve('electron-arm64.tmp.zip');
  const distDir = path.resolve('dist/modao-win32-arm64');
  
  // 1. Detect app.asar location
  const defaultAsarPaths = [
    path.resolve('../modao-win32/modao-win32-ia32-1.5.4/resources/app.asar'),
    path.resolve('./app.asar')
  ];
  let sourceAsar = '';
  for (const p of defaultAsarPaths) {
    if (fs.existsSync(p)) {
      sourceAsar = p;
      break;
    }
  }
  
  if (!sourceAsar) {
    console.error('\n❌ 错误: 未能找到原版墨刀的 app.asar 核心文件！');
    console.error('------------------------------------------------------------------');
    console.error('请按照以下步骤获取该文件：');
    console.error('1. 下载墨刀官方 Windows x86 绿色运行包：');
    console.error('   👉 https://cdn-release.modao.cc/desktop/prod-1.5.4/win32/modao-win32-ia32-1.5.4.zip');
    console.error('2. 解压下载的 zip 压缩包，在其 resources 目录下找到 app.asar 文件。');
    console.error('3. 将该 app.asar 文件复制到当前构建项目的根目录下。');
    console.error('------------------------------------------------------------------\n');
    process.exit(1);
  }
  
  console.log(`Found original app.asar at: ${sourceAsar}`);
  
  // 2. Download Electron ARM64 runtime
  console.log(`Downloading Electron v${electronVersion} Windows ARM64 from npmmirror...`);
  try {
    await downloadFile(downloadUrl, zipPath);
  } catch (err) {
    console.error('Failed to download Electron runtime:', err);
    process.exit(1);
  }
  
  // 3. Extracting Zip
  console.log(`Extracting Electron runtime to ${distDir}...`);
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(distDir, true);
    console.log('Extraction completed!');
  } catch (err) {
    console.error('Failed to extract zip file:', err);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    process.exit(1);
  }
  
  // Clean up zip
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  // 4. Copy app.asar to destination
  const targetAsar = path.join(distDir, 'resources/app.asar');
  console.log(`Copying app.asar to ${targetAsar}...`);
  copyFile(sourceAsar, targetAsar);
  
  // 5. Modify executable resource properties and rename
  const rawExe = path.join(distDir, 'electron.exe');
  const targetExe = path.join(distDir, 'Mockitt.exe');
  const iconPath = path.resolve('icon.ico');
  
  console.log('Injecting icon and metadata properties...');
  try {
    await rcedit(rawExe, {
      icon: iconPath,
      'version-string': {
        CompanyName: 'MockingBot LLC',
        FileDescription: 'Mockitt',
        FileVersion: '1.5.4',
        ProductVersion: '1.5.4',
        LegalCopyright: 'Copyright \u00A9 2025 MockingBot LLC',
        ProductName: 'Mockitt',
        InternalName: 'Mockitt',
        OriginalFilename: 'Mockitt.exe'
      },
      'file-version': '1.5.4',
      'product-version': '1.5.4'
    });
    
    // Rename electron.exe -> Mockitt.exe
    fs.renameSync(rawExe, targetExe);
    console.log('Successfully renamed electron.exe to Mockitt.exe');
  } catch (err) {
    console.error('Failed to update metadata or rename executable:', err);
    process.exit(1);
  }
  
  console.log('\n======================================================');
  console.log('🎉 Windows ARM64 Native Modao Client Built Successfully!');
  console.log(`Output Directory: ${distDir}`);
  console.log('======================================================\n');
}

run();
