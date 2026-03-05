// Adobe CEP Interface
const csInterface = new CSInterface();

// UI Elements
const methodSelect = document.getElementById('method');
const formatSelect = document.getElementById('format');
const timeSettings = document.getElementById('timeSettings');
const motionSettings = document.getElementById('motionSettings');
const intervalInput = document.getElementById('interval');
const sensitivitySlider = document.getElementById('sensitivity');
const sensitivityValue = document.getElementById('sensitivityValue');
const strategySelect = document.getElementById('strategy');
const strategyHint = document.getElementById('strategyHint');
const sensitivitySection = document.getElementById('sensitivitySection');
const sensitivityHint = document.getElementById('sensitivityHint');
const editPointPreview = document.getElementById('editPointPreview');
const selectSequenceBtn = document.getElementById('selectSequence');
const exportFramesBtn = document.getElementById('exportFrames');
const sequenceInfo = document.getElementById('sequenceInfo');
const sequenceName = document.getElementById('sequenceName');
const sequenceDuration = document.getElementById('sequenceDuration');
const statusDiv = document.getElementById('status');
const outputPathInput = document.getElementById('outputPath');
const browseFolderBtn = document.getElementById('browseFolder');

var customOutputPath = '';

// Browse for output folder using modern Windows file explorer dialog
var nodePath = require('path');
var childProcess = require('child_process');

browseFolderBtn.addEventListener('click', function() {
    try {
        var extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        var scriptPath = nodePath.join(extensionPath, 'host', 'folderPicker.ps1');
        var result = childProcess.execSync(
            'powershell.exe -ExecutionPolicy Bypass -NoProfile -File "' + scriptPath + '"',
            { encoding: 'utf8', windowsHide: true, timeout: 120000 }
        );
        var folder = result.trim();
        if (folder) {
            customOutputPath = folder;
            outputPathInput.value = folder;
        }
    } catch (e) {
        // User cancelled or error — do nothing
    }
});

// Event Listeners
methodSelect.addEventListener('change', function() {
    if (this.value === 'time') {
        timeSettings.style.display = 'block';
        motionSettings.style.display = 'none';
    } else if (this.value === 'motion') {
        timeSettings.style.display = 'none';
        motionSettings.style.display = 'block';
    }
});


// Strategy hints
var strategyHints = {
    cuts: 'Scans timeline for clip boundaries \u2014 captures each speaker switch.',
    markers: 'Exports a frame at each sequence marker position.'
};

var sensitivityHints = {
    1: 'Only major cuts (clips > 10s)', 2: 'Only major cuts (clips > 10s)',
    3: 'Medium cuts (clips > 5s)', 4: 'Medium cuts (clips > 5s)',
    5: 'Min clip duration: ~2s', 6: 'Min clip duration: ~2s',
    7: 'Fine cuts (clips > 0.5s)', 8: 'Fine cuts (clips > 0.5s)',
    9: 'All edit points', 10: 'All edit points'
};

strategySelect.addEventListener('change', function() {
    strategyHint.textContent = strategyHints[this.value] || '';
    // Show/hide sensitivity for strategies that use it
    if (this.value === 'markers') {
        sensitivitySection.style.display = 'none';
        editPointPreview.textContent = '';
    } else {
        sensitivitySection.style.display = 'block';
        updateEditPointPreview();
    }
});

sensitivitySlider.addEventListener('input', function() {
    sensitivityValue.textContent = this.value;
    sensitivityHint.textContent = sensitivityHints[this.value] || '';
    updateEditPointPreview();
});

function updateEditPointPreview() {
    if (methodSelect.value !== 'motion' || strategySelect.value !== 'cuts') return;
    if (!exportFramesBtn.disabled === true && !sequenceInfo.style.display) return;
    csInterface.evalScript('getEditPointCount("' + sensitivitySlider.value + '")', function(result) {
        try {
            var data = JSON.parse(result);
            if (data.count !== undefined) {
                editPointPreview.textContent = '\u2192 ' + data.count + ' edit points detected';
            }
        } catch(e) {}
    });
}

// Helper Functions
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
}

function hideStatus() {
    statusDiv.style.display = 'none';
}

// Select Active Sequence
selectSequenceBtn.addEventListener('click', function() {
    showStatus('Getting sequence info...', 'info');
    
    // Call ExtendScript in Premiere Pro
    csInterface.evalScript('getActiveSequenceInfo()', function(result) {
        if (result && result !== 'null' && result !== 'undefined') {
            try {
                var data = JSON.parse(result);
                if (data.error) {
                    showStatus(data.error, 'error');
                    return;
                }
                sequenceName.textContent = data.name;
                sequenceDuration.textContent = data.duration + 's (' + data.width + 'x' + data.height + ', ' + data.frameRate + ' fps)';
                sequenceInfo.style.display = 'block';
                exportFramesBtn.disabled = false;
                showStatus('Sequence selected!', 'success');
                updateEditPointPreview();
            } catch (e) {
                showStatus('Error parsing sequence info: ' + e.message, 'error');
            }
        } else {
            showStatus('No active sequence found. Open a sequence first.', 'error');
        }
    });
});

// Export Frames
exportFramesBtn.addEventListener('click', function() {
    const method = methodSelect.value;
    const interval = intervalInput.value;
    const sensitivity = sensitivitySlider.value;
    
    showStatus('Exporting frames...', 'info');
    exportFramesBtn.disabled = true;
    
    // Prepare parameters
    const format = formatSelect.value;

    const strategy = strategySelect.value;

    const params = JSON.stringify({
        method: method,
        format: format,
        outputPath: customOutputPath,
        interval: parseInt(interval),
        sensitivity: parseInt(sensitivity),
        strategy: strategy
    });
    
    // Call ExtendScript — escape backslashes for evalScript string embedding
    var escapedParams = params.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    csInterface.evalScript("exportFrames('" + escapedParams + "')", function(result) {
        exportFramesBtn.disabled = false;
        
        if (result && result !== 'undefined' && result !== 'null') {
            try {
                var data = JSON.parse(result);
                if (data.error) {
                    showStatus('Export error: ' + data.error, 'error');
                    return;
                }
                showStatus('Exported ' + data.count + ' frames to: ' + data.path, 'success');
            } catch (e) {
                showStatus('Unexpected response: ' + result, 'error');
            }
        } else {
            showStatus('No response from export script. Check the ExtendScript console.', 'error');
        }
    });
});