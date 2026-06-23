const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const AdmZip = require('adm-zip');
const rceditModule = require('rcedit');
const rcedit = typeof rceditModule === 'function' ? rceditModule : rceditModule.rcedit;

// Helper to copy files
function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// Fetch helper for HTML content
function fetchHtml(pageUrl) {
  return new Promise((resolve, reject) => {
    https.get(pageUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch page (Status: ${res.statusCode})`));
      }
      let html = '';
      res.on('data', (chunk) => { html += chunk; });
      res.on('end', () => resolve(html));
    }).on('error', reject);
  });
}

// Parse download link and version from official download page
async function getLatestX86ZipInfo() {
  const downloadsPage = 'https://modao.cc/feature/downloads.html';
  console.log(`Fetching Modao downloads page: ${downloadsPage}...`);
  try {
    const html = await fetchHtml(downloadsPage);
    // Match data-href="/desktop/prod-x.y.z/win32/modao-win32-ia32-x.y.z.zip"
    const match = html.match(/data-href="([^"]*?ia32[^"]*?\.zip)"/);
    if (match && match[1]) {
      let relativeUrl = match[1];
      if (!relativeUrl.startsWith('http')) {
        relativeUrl = 'https://cdn-release.modao.cc' + relativeUrl;
      }
      const versionMatch = relativeUrl.match(/modao-win32-ia32-([\d\.]+)\.zip/);
      const version = versionMatch ? versionMatch[1] : '1.5.4';
      return { url: relativeUrl, version };
    }
  } catch (err) {
    console.warn('Warning: Failed to fetch latest downloads page. Using fallback link.', err.message);
  }
  
  return {
    url: 'https://cdn-release.modao.cc/desktop/prod-1.5.4/win32/modao-win32-ia32-1.5.4.zip',
    version: '1.5.4'
  };
}

// Redirect-aware HTTP/HTTPS downloader with progress bar
function downloadFile(fileUrl, targetPath) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(fileUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    protocol.get(fileUrl, (response) => {
      // Follow redirects
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
  const distDir = path.resolve('dist/modao-win32-arm64');
  const tempExtractedDir = path.resolve('dist/temp-extracted');
  const x86ZipTmpPath = path.resolve('modao-x86-temp.tmp.zip');
  
  // Clean up any stale temp directories
  if (fs.existsSync(tempExtractedDir)) {
    fs.rmSync(tempExtractedDir, { recursive: true, force: true });
  }
  
  // 1. Detect if app.asar is already present locally
  const defaultAsarPaths = [
    path.resolve('../modao-win32/modao-win32-ia32-1.5.4/resources/app.asar'),
    path.resolve('./app.asar')
  ];
  let sourceAsar = '';
  let electronVersion = '32.1.0'; // Default
  let modaoVersion = '1.5.4'; // Default
  
  for (const p of defaultAsarPaths) {
    if (fs.existsSync(p)) {
      sourceAsar = p;
      const versionFile = path.join(path.dirname(p), '../version');
      if (fs.existsSync(versionFile)) {
        electronVersion = fs.readFileSync(versionFile, 'utf8').trim();
      }
      break;
    }
  }
  
  if (sourceAsar) {
    console.log(`Found local app.asar at: ${sourceAsar}`);
    console.log(`Using matched Electron version: ${electronVersion}`);
  } else {
    console.log('No local app.asar detected. Checking latest version from Modao official site...');
    const x86Info = await getLatestX86ZipInfo();
    console.log(`Latest Modao version: ${x86Info.version}`);
    console.log(`Download URL: ${x86Info.url}`);
    modaoVersion = x86Info.version;
    
    // Download official x86 package
    console.log('Downloading Modao official x86 package...');
    try {
      await downloadFile(x86Info.url, x86ZipTmpPath);
    } catch (err) {
      console.error('Failed to download official x86 package:', err);
      process.exit(1);
    }
    
    // Partially extract app.asar and version file from the x86 zip package
    console.log('Extracting app.asar and version files from the package...');
    try {
      const zip = new AdmZip(x86ZipTmpPath);
      const zipEntries = zip.getEntries();
      fs.mkdirSync(tempExtractedDir, { recursive: true });
      
      let foundAsar = false;
      let foundVersion = false;
      
      zipEntries.forEach((entry) => {
        if (entry.entryName.endsWith('resources/app.asar')) {
          zip.extractEntryTo(entry.entryName, tempExtractedDir, false, true);
          foundAsar = true;
        }
        if (entry.entryName.endsWith('version')) {
          zip.extractEntryTo(entry.entryName, tempExtractedDir, false, true);
          foundVersion = true;
        }
      });
      
      if (!foundAsar) {
        throw new Error('Could not find resources/app.asar inside the zip package.');
      }
      
      sourceAsar = path.join(tempExtractedDir, 'app.asar');
      
      if (foundVersion) {
        const verPath = path.join(tempExtractedDir, 'version');
        electronVersion = fs.readFileSync(verPath, 'utf8').trim();
      }
      console.log('Successfully extracted app.asar!');
      console.log(`Target Electron Version: ${electronVersion}`);
      
    } catch (err) {
      console.error('Failed to parse zip package:', err);
      if (fs.existsSync(x86ZipTmpPath)) fs.unlinkSync(x86ZipTmpPath);
      process.exit(1);
    } finally {
      if (fs.existsSync(x86ZipTmpPath)) {
        fs.unlinkSync(x86ZipTmpPath);
      }
    }
  }
  
  // 2. Download corresponding Electron ARM64 runtime
  const arm64ZipPath = path.resolve('electron-arm64.tmp.zip');
  const electronMirrors = [
    'https://npmmirror.com/mirrors/electron/',
    'https://mirrors.huaweicloud.com/electron/',
    'https://mirrors.cloud.tencent.com/electron/'
  ];
  
  let downloaded = false;
  for (const mirror of electronMirrors) {
    const arm64DownloadUrl = `${mirror}${electronVersion}/electron-v${electronVersion}-win32-arm64.zip`;
    console.log(`Downloading Electron v${electronVersion} Windows ARM64 from mirror: ${mirror}...`);
    try {
      await downloadFile(arm64DownloadUrl, arm64ZipPath);
      downloaded = true;
      break;
    } catch (err) {
      console.warn(`[WARNING] Failed to download from mirror ${mirror}: ${err.message}. Trying next mirror...`);
      if (fs.existsSync(arm64ZipPath)) {
        try { fs.unlinkSync(arm64ZipPath); } catch (e) {}
      }
    }
  }
  
  if (!downloaded) {
    console.error('Error: Failed to download Electron ARM64 runtime from all mirrors.');
    process.exit(1);
  }
  
  // 3. Extract ARM64 runtime
  console.log(`Extracting Electron ARM64 runtime to ${distDir}...`);
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  
  try {
    const zip = new AdmZip(arm64ZipPath);
    zip.extractAllTo(distDir, true);
    console.log('Extraction completed!');
  } catch (err) {
    console.error('Failed to extract ARM64 runtime:', err);
    if (fs.existsSync(arm64ZipPath)) fs.unlinkSync(arm64ZipPath);
    process.exit(1);
  } finally {
    if (fs.existsSync(arm64ZipPath)) {
      fs.unlinkSync(arm64ZipPath);
    }
  }
  
  // 4. Copy app.asar to destination
  const targetAsar = path.join(distDir, 'resources/app.asar');
  console.log(`Copying app.asar to ${targetAsar}...`);
  copyFile(sourceAsar, targetAsar);
  
  // 5. Write version file
  const targetVersion = path.join(distDir, 'version');
  fs.writeFileSync(targetVersion, electronVersion);
  
  // 6. Modify executable resource properties and rename
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
        FileVersion: modaoVersion,
        ProductVersion: modaoVersion,
        LegalCopyright: 'Copyright \u00A9 2025 MockingBot LLC',
        ProductName: 'Mockitt',
        InternalName: 'Mockitt',
        OriginalFilename: 'Mockitt.exe'
      },
      'file-version': modaoVersion,
      'product-version': modaoVersion
    });
    
    fs.renameSync(rawExe, targetExe);
    console.log('Successfully renamed electron.exe to Mockitt.exe');
  } catch (err) {
    console.error('Failed to update metadata or rename executable:', err);
    process.exit(1);
  }
  
  // Cleanup temp extracted dir if any
  if (fs.existsSync(tempExtractedDir)) {
    fs.rmSync(tempExtractedDir, { recursive: true, force: true });
  }
  
  console.log('\n======================================================');
  console.log('🎉 Windows ARM64 Native Modao Client Built Successfully!');
  console.log(`Output Directory: ${distDir}`);
  console.log(`Application Version: ${modaoVersion}`);
  console.log('======================================================\n');
}

run();
