// background.js

// State
let isRecording = false;
let recordedSteps = [];
let savedFlows = [];
let settings = {};

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log('FlowForge extension installed.');
  // Load saved flows from storage
  chrome.storage.local.get(['savedFlows'], (data) => {
    if (data.savedFlows) {
      savedFlows = data.savedFlows;
    }
  });
  loadSettings(); // Load settings on installation
});

// Load settings on startup
chrome.runtime.onStartup.addListener(() => {
  loadSettings();
});

async function loadSettings() {
  try {
    const response = await chrome.storage.sync.get('settings');
    settings = response.settings || {};
    console.log('Background settings loaded:', settings);
  } catch (error) {
    console.error('Background settings loading error:', error);
  }
}

// Listen for messages from the popup or options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'flowforge-start-recording':
      startRecording(sendResponse);
      break;
    case 'flowforge-stop-recording':
      stopRecording(sendResponse);
      break;
    case 'flowforge-get-recording-status':
      getRecordingStatus(sendResponse);
      break;
    case 'flowforge-get-flows':
      getFlows(sendResponse);
      break;
    case 'flowforge-save-flow':
      saveFlow(request.flowData, sendResponse);
      break;
    case 'flowforge-execute-flow':
      executeFlow(request.flowId, sendResponse);
      break;
    case 'flowforge-delete-flow':
      deleteFlow(request.flowId, sendResponse);
      break;
    case 'flowforge-edit-flow':
      // Placeholder for editing a flow
      sendResponse({ success: true });
      break;
    case 'update-settings':
      // Reload settings to ensure background script is aware of changes
      loadSettings();
      sendResponse({ success: true });
      break;
    case 'flowforge-delete-flows':
      deleteFlows(request.flowIds, sendResponse);
      break;
    default:
      console.warn('Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
      break;
  }
  // Return true to indicate that the response will be sent asynchronously
  return true;
});

function getRecordingStatus(sendResponse) {
  sendResponse({ success: true, isRecording });
}

// Start recording navigation events
function startRecording(sendResponse) {
  console.log('startRecording called');
  if (isRecording) {
    sendResponse({ success: false, error: 'Already recording' });
    return;
  }

  isRecording = true;
  recordedSteps = [];

  // Listen for navigation events
  chrome.webNavigation.onCompleted.addListener(handleNavigation);

  sendResponse({ success: true });
}

// Stop recording and return the recorded steps
function stopRecording(sendResponse) {
  console.log('stopRecording called');
  if (!isRecording) {
    sendResponse({ success: false, error: 'Not recording' });
    return;
  }

  isRecording = false;
  chrome.webNavigation.onCompleted.removeListener(handleNavigation);

  sendResponse({ success: true, steps: recordedSteps });
}

// Handle navigation events during recording
function handleNavigation(details) {
  // Ignore iframes and other non-top-level frames
  if (details.frameId !== 0) {
    return;
  }

  // Get the tab information to get the title
  chrome.tabs.get(details.tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }

    recordedSteps.push({
      url: details.url,
      title: tab.title,
      timestamp: details.timeStamp
    });
  });
}

// Get all saved flows
function getFlows(sendResponse) {
  sendResponse({ success: true, flows: savedFlows });
}

// Save a new flow
function saveFlow(flowData, sendResponse) {
  // Check for duplicate flow names
  if (savedFlows.some(flow => flow.name === flowData.name)) {
    sendResponse({ success: false, error: 'Flow name already exists' });
    return;
  }

  savedFlows.push(flowData);

  // Save to storage
  chrome.storage.local.set({ savedFlows }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      // Notify popup to reload flows
      chrome.runtime.sendMessage({ action: 'flowforge-flows-updated' });
      sendResponse({ success: true });
    }
  });
}

// Delete multiple flows
function deleteFlows(flowIds, sendResponse) {
  const initialCount = savedFlows.length;
  savedFlows = savedFlows.filter(flow => !flowIds.includes(flow.id));
  const finalCount = savedFlows.length;

  if (initialCount > finalCount) {
    saveFlowsToStorage();
    sendResponse({ success: true, message: `${initialCount - finalCount} flows deleted.` });
  } else {
    sendResponse({ success: false, error: 'No matching flows found to delete.' });
  }
}

// Save the updated flows array to storage
function saveFlowsToStorage() {
  chrome.storage.local.set({ savedFlows });
}

// Execute a flow
async function executeFlow(flowId, sendResponse) {
  const flow = savedFlows.find(f => f.id === flowId);

  if (!flow) {
    sendResponse({ success: false, error: 'Flow not found' });
    return;
  }

  try {
    for (const step of flow.steps) {
      // Create a new tab for each step
      await new Promise(resolve => {
        chrome.tabs.create({ url: step.url }, (tab) => {
          // Wait for the tab to complete loading
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          });
        });
      });
    }

    // Update last run time
    flow.lastRun = Date.now();
    flow.runCount = (flow.runCount || 0) + 1;
    chrome.storage.local.set({ savedFlows });

    sendResponse({ success: true });
  } catch (error) {
    console.error('Error executing flow:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Delete a flow
function deleteFlow(flowId, sendResponse) {
  const initialLength = savedFlows.length;
  savedFlows = savedFlows.filter(flow => flow.id !== flowId);

  if (savedFlows.length === initialLength) {
    sendResponse({ success: false, error: 'Flow not found' });
    return;
  }

  // Save to storage
  chrome.storage.local.set({ savedFlows }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      // Notify popup to reload flows
      chrome.runtime.sendMessage({ action: 'flowforge-flows-updated' });
      sendResponse({ success: true });
    }
  });
}