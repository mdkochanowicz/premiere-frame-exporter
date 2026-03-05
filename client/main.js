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

// Face detection UI elements
const faceSettings = document.getElementById('faceSettings');
const faceSensitivitySlider = document.getElementById('faceSensitivity');
const faceSensitivityValue = document.getElementById('faceSensitivityValue');
const faceSensitivityHint = document.getElementById('faceSensitivityHint');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

var customOutputPath = '';
var faceModelReady = false;

// Initialize face detection model on startup
(function initFaceModel() {
    var extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    var modelsDir = extensionPath + '/client/models';
    FaceAnalyzer.init(modelsDir).then(function() {
        faceModelReady = true;
        console.log('[main] Face detection model ready');
    }).catch(function(err) {
        console.error('[main] Failed to load face model:', err);
    });
})();

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
    timeSettings.style.display = 'none';
    motionSettings.style.display = 'none';
    faceSettings.style.display = 'none';

    if (this.value === 'time') {
        timeSettings.style.display = 'block';
    } else if (this.value === 'motion') {
        motionSettings.style.display = 'block';
    } else if (this.value === 'face') {
        faceSettings.style.display = 'block';
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

// Face sensitivity hints
var faceSensitivityHints = {
    1: 'Very low \u2014 only drastic face changes',
    2: 'Low \u2014 major speaker switches',
    3: 'Low-medium',
    4: 'Medium-low',
    5: 'Balanced \u2014 captures clear speaker changes',
    6: 'Medium-high',
    7: 'High \u2014 catches subtle movements',
    8: 'High \u2014 more frames exported',
    9: 'Very high \u2014 many frames',
    10: 'Maximum \u2014 captures every small change'
};

faceSensitivitySlider.addEventListener('input', function() {
    faceSensitivityValue.textContent = this.value;
    faceSensitivityHint.textContent = faceSensitivityHints[this.value] || '';
});

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

// Helper: wrap csInterface.evalScript in a Promise
function evalScriptAsync(script) {
    return new Promise(function(resolve, reject) {
        csInterface.evalScript(script, function(result) {
            if (result && result !== 'undefined' && result !== 'null') {
                try {
                    var data = JSON.parse(result);
                    if (data.error) {
                        reject(new Error(data.error));
                    } else {
                        resolve(data);
                    }
                } catch (e) {
                    reject(new Error('Unexpected response: ' + result));
                }
            } else {
                reject(new Error('No response from ExtendScript'));
            }
        });
    });
}

// Progress bar helpers
function showProgress(phase, percent, text) {
    progressContainer.style.display = 'block';
    progressFill.className = 'progress-fill ' + phase;
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}

function hideProgress() {
    progressContainer.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = '';
}

// Face Detection 3-pass export flow
function exportWithFaceDetection(format, sensitivity) {
    if (!faceModelReady) {
        showStatus('Face detection model not loaded yet. Please wait a moment and try again.', 'error');
        exportFramesBtn.disabled = false;
        return;
    }

    // PASS 1: Sampling — export low-quality JPEG frames
    showStatus('Pass 1/3: Exporting sampling frames...', 'info');
    showProgress('sampling', 10, 'Sampling frames from sequence...');

    var samplingParams = JSON.stringify({ sensitivity: sensitivity });
    var escapedSampling = samplingParams.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    evalScriptAsync("exportSamplingFrames('" + escapedSampling + "')")
        .then(function(samplingResult) {
            showProgress('sampling', 100, 'Sampled ' + samplingResult.count + ' frames');
            showStatus('Pass 2/3: Analyzing faces... (0/' + samplingResult.count + ')', 'info');

            // PASS 2: Analyze faces in sampled frames
            return FaceAnalyzer.analyzeFrames(
                samplingResult.path,
                samplingResult.count,
                samplingResult.interval,
                sensitivity,
                function(current, total) {
                    var pct = Math.round((current / total) * 100);
                    showProgress('analyzing', pct, 'Analyzing face ' + current + '/' + total);
                    showStatus('Pass 2/3: Analyzing faces... (' + current + '/' + total + ')', 'info');
                }
            ).then(function(timestamps) {
                return { timestamps: timestamps, samplingPath: samplingResult.path };
            });
        })
        .then(function(analysisResult) {
            showProgress('analyzing', 100, 'Found ' + analysisResult.timestamps.length + ' face changes');

            if (analysisResult.timestamps.length === 0) {
                showStatus('No significant face changes detected. Try increasing sensitivity.', 'error');
                hideProgress();
                exportFramesBtn.disabled = false;
                // Cleanup
                csInterface.evalScript('cleanupSamplingFrames()');
                return;
            }

            // PASS 3: Export final frames at detected timestamps
            showStatus('Pass 3/3: Exporting ' + analysisResult.timestamps.length + ' frames...', 'info');
            showProgress('exporting', 50, 'Exporting final frames...');

            var exportParams = JSON.stringify({
                timestamps: analysisResult.timestamps,
                format: format,
                outputPath: customOutputPath
            });
            var escapedExport = exportParams.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

            return evalScriptAsync("exportFramesByTimestamps('" + escapedExport + "')")
                .then(function(exportResult) {
                    showProgress('exporting', 100, 'Done!');
                    showStatus('Exported ' + exportResult.count + ' frames to: ' + exportResult.path, 'success');
                    exportFramesBtn.disabled = false;

                    // Cleanup sampling frames
                    csInterface.evalScript('cleanupSamplingFrames()');

                    setTimeout(hideProgress, 3000);
                });
        })
        .catch(function(err) {
            showStatus('Face detection error: ' + err.message, 'error');
            hideProgress();
            exportFramesBtn.disabled = false;
            csInterface.evalScript('cleanupSamplingFrames()');
        });
}

// Export Frames
exportFramesBtn.addEventListener('click', function() {
    const method = methodSelect.value;
    const interval = intervalInput.value;
    const sensitivity = sensitivitySlider.value;
    const format = formatSelect.value;
    
    exportFramesBtn.disabled = true;

    // Face detection uses separate 3-pass flow
    if (method === 'face') {
        var faceSens = parseInt(faceSensitivitySlider.value);
        exportWithFaceDetection(format, faceSens);
        return;
    }

    // Time-based and Motion detection use the original single-pass flow
    showStatus('Exporting frames...', 'info');

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