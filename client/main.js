// Adobe CEP Interface
const csInterface = new CSInterface();

// UI Elements
const methodSelect = document.getElementById('method');
const timeSettings = document.getElementById('timeSettings');
const motionSettings = document.getElementById('motionSettings');
const intervalInput = document.getElementById('interval');
const sensitivitySlider = document.getElementById('sensitivity');
const sensitivityValue = document.getElementById('sensitivityValue');
const selectSequenceBtn = document.getElementById('selectSequence');
const exportFramesBtn = document.getElementById('exportFrames');
const sequenceInfo = document.getElementById('sequenceInfo');
const sequenceName = document.getElementById('sequenceName');
const sequenceDuration = document.getElementById('sequenceDuration');
const statusDiv = document.getElementById('status');


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


sensitivitySlider.addEventListener('input', function() {
    sensitivityValue.textContent = this.value;
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
        if (result && result !== 'null') {
            const data = JSON.parse(result);
            sequenceName.textContent = data.name;
            sequenceDuration.textContent = data.duration + ' seconds';
            sequenceInfo.style.display = 'block';
            exportFramesBtn.disabled = false;
            showStatus('Sequence selected!', 'success');
        } else {
            showStatus('No active sequence found', 'error');
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
    const params = JSON.stringify({
        method: method,
        interval: parseInt(interval),
        sensitivity: parseInt(sensitivity)
    });
    
    // Call ExtendScript
    csInterface.evalScript(`exportFrames('${params}')`, function(result) {
        exportFramesBtn.disabled = false;
        
        if (result && result !== 'error') {
            const data = JSON.parse(result);
            showStatus(`Successfully exported ${data.count} frames to ${data.path}`, 'success');
        } else {
            showStatus('Error exporting frames', 'error');
        }
    });
});