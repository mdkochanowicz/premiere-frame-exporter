const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Extension name (must match manifest ExtensionBundleId)
const EXTENSION_ID = 'com.fsomichal.frameexporter';

// Get CEP extensions folder
function getCEPFolder() {
    // Try system-wide location first (Premiere 2025+)
    const systemCEP = path.join('C:', 'Program Files', 'Common Files', 'Adobe', 'CEP', 'extensions');
    if (fs.existsSync(systemCEP)) {
        return systemCEP;
    }
    
    // Fallback to user location
    const userName = os.userInfo().username;
    const userCEP = path.join('C:', 'Users', userName, 'AppData', 'Roaming', 'Adobe', 'CEP', 'extensions');
    return userCEP;
}

const sourceDir = __dirname;
const targetDir = path.join(getCEPFolder(), EXTENSION_ID);

// Install extension
async function install() {
    try {
        console.log('Installing Premiere Frame Exporter...');
        console.log('Source:', sourceDir);
        console.log('Target:', targetDir);
        
        // Remove old version if exists
        if (fs.existsSync(targetDir)) {
            console.log('Removing old version...');
            fs.removeSync(targetDir);
        }
        
        // Create target directory
        fs.ensureDirSync(targetDir);
        
        // Copy files
        console.log('Copying files...');
        fs.copySync(path.join(sourceDir, 'CSXS'), path.join(targetDir, 'CSXS'));
        fs.copySync(path.join(sourceDir, 'client'), path.join(targetDir, 'client'));
        fs.copySync(path.join(sourceDir, 'host'), path.join(targetDir, 'host'));
        
        // Copy .debug file (required for unsigned extension development)
        const debugSource = path.join(sourceDir, '.debug');
        const debugTarget = path.join(targetDir, '.debug');
        if (fs.existsSync(debugSource)) {
            fs.copySync(debugSource, debugTarget);
            console.log('✓ .debug file copied (enables remote debugging)');
        } else {
            console.warn('⚠ No .debug file found - creating one...');
            const debugContent = `<?xml version="1.0" encoding="UTF-8"?>
<ExtensionList>
    <Extension Id="com.fsomichal.frameexporter.panel">
        <HostList>
            <Host Name="PPRO" Port="8088"/>
        </HostList>
    </Extension>
</ExtensionList>`;
            fs.writeFileSync(debugTarget, debugContent, 'utf8');
            console.log('✓ .debug file created');
        }
        
        console.log('✓ Installation complete!');
        console.log('Restart Premiere Pro to see the extension.');
        
    } catch (error) {
        console.error('Installation failed:', error);
    }
}

// Run installation
install();

