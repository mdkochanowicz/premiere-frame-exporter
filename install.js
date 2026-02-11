const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Extension name (must match manifest ExtensionBundleId)
const EXTENSION_ID = 'com.fsomichal.frameexporter';

// Get CEP extensions folder
function getCEPFolder() {
    const userName = os.userInfo().username;
    const cepPath = path.join('C:', 'Users', userName, 'AppData', 'Roaming', 'Adobe', 'CEP', 'extensions');
    return cepPath;
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
        
        console.log('✓ Installation complete!');
        console.log('Restart Premiere Pro to see the extension.');
        
    } catch (error) {
        console.error('Installation failed:', error);
    }
}

// Run installation
install();

