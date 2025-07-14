// FlowForge Background Service Worker
// Handles flow detection, tracking, and automation

// Constants
const FLOW_DETECTION_THRESHOLD = 3; // Number of repetitions to detect a flow
const MAX_FLOW_STEPS = 20; // Maximum number of steps in a flow
const FLOW_EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

// State management
let currentFlow = [];
let lastNavigationTime = null;
let flowHistory = [];
let savedFlows = [];
let isRecording = false;
let recordedSteps = [];

// Initialize extension data
chrome.runtime.onInstalled.addListener(async () => {
  console.log('FlowForge extension installed');
  await initializeStorage();
});

// Listen for messages from content scripts or popup/options pages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'flowforge-start-recording') {
    isRecording = true;
    recordedSteps = []; // Clear previous steps
    console.log('Recording started');
    sendResponse({ status: 'recording_started' });
  } else if (request.action === 'flowforge-stop-recording') {
    isRecording = false;
    console.log('Recording stopped', recordedSteps);
    sendResponse({ status: 'recording_stopped', steps: recordedSteps });
  } else if (request.action === 'flowforge-record-step' && isRecording) {
    recordedSteps.push(request.step);
    console.log('Step recorded:', request.step);
    sendResponse({ status: 'step_recorded' });
  }
  return true; // Indicates that sendResponse will be called asynchronously
});

// Initialize storage with default values if needed
async function initializeStorage() {
  const data = await chrome.storage.sync.get(['savedFlows', 'settings']);
  
  if (!data.savedFlows) {
    await chrome.storage.sync.set({ savedFlows: [] });
  } else {
    savedFlows = data.savedFlows;
  }

  if (!data.flowHistory) {
    await chrome.storage.sync.set({ flowHistory: [] });
  } else {
    flowHistory = data.flowHistory;
  }
  
  if (!data.settings) {
    await chrome.storage.sync.set({
      settings: {
        encryptionEnabled: false,
        detectionSensitivity: 'medium', // low, medium, high
        notificationsEnabled: true
      }
    });
  }
}

// Listen for navigation events
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only track main frame navigation (not iframes)
  if (details.frameId !== 0) return;
  
  const tab = await chrome.tabs.get(details.tabId);
  const url = new URL(details.url);
  
  // Ignore extension pages and some special URLs
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'chrome:' || 
      url.protocol === 'about:') {
    return;
  }
  
  recordNavigation({
    url: details.url,
    title: tab.title,
    timestamp: Date.now(),
    tabId: details.tabId
  });
});

// Record a navigation step
async function recordNavigation(navigationData) {
  const currentTime = navigationData.timestamp;
  
  // Check if this is a new flow (based on time gap)
  if (lastNavigationTime && (currentTime - lastNavigationTime > FLOW_EXPIRY_TIME)) {
    // If there was a significant time gap, save the previous flow and start a new one
    if (currentFlow.length > 1) {
      await saveFlowToHistory(currentFlow);
    }
    currentFlow = [];
  }
  
  // Add the current navigation to the flow
  currentFlow.push(navigationData);
  
  // Limit flow size
  if (currentFlow.length > MAX_FLOW_STEPS) {
    currentFlow.shift(); // Remove oldest step
  }
  
  lastNavigationTime = currentTime;

  // If recording is active, add the navigation step to recordedSteps
  if (isRecording) {
    recordedSteps.push({
      type: 'navigation',
      url: navigationData.url,
      title: navigationData.title,
      timestamp: navigationData.timestamp
    });
  }
  
  // Notify content script that we're tracking
  try {
    await chrome.tabs.sendMessage(navigationData.tabId, {
      action: 'flowforge-tracking',
      flowLength: currentFlow.length
    });
  } catch (error) {
    // Tab might be closed or not have content script loaded yet
    console.log('Could not send tracking notification to tab', error);
  }
  
  // Check if this flow matches any known patterns
  await detectRepeatingFlows();
}

// Save a completed flow to history
async function saveFlowToHistory(flow) {
  // Don't save flows that are too short
  if (flow.length < 2) return;
  
  // Create a simplified version of the flow for storage
  const simplifiedFlow = flow.map(step => ({
    url: step.url,
    title: step.title,
    timestamp: step.timestamp
  }));
  
  // Add to history
  flowHistory.push({
    flow: simplifiedFlow,
    timestamp: Date.now(),
    id: generateFlowId(simplifiedFlow)
  });
  
  // Limit history size
  if (flowHistory.length > 100) {
    flowHistory.shift(); // Remove oldest flow
  }

  // Save history to storage
  await chrome.storage.sync.set({ flowHistory: flowHistory });
}

// Generate a unique ID for a flow based on its URLs
function generateFlowId(flow) {
  const urlString = flow.map(step => new URL(step.url).hostname).join('-');
  return 'flow-' + btoa(urlString).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
}

// Detect if the current flow matches any repeating patterns
async function detectRepeatingFlows() {
  if (currentFlow.length < 2) return;

  // Use ML-based clustering to detect similar flows
  const clusters = clusterFlows(flowHistory);

  for (const cluster of clusters) {
    if (cluster.length >= FLOW_DETECTION_THRESHOLD) {
      // Check if cluster flow is already saved
      const clusterSignature = createFlowSignature(cluster[0].flow);
      const alreadySaved = savedFlows.some(savedFlow => 
        flowSignaturesMatch(clusterSignature, createFlowSignature(savedFlow.steps))
      );

      if (!alreadySaved) {
        // Suggest automation for representative flow
        suggestFlowAutomation(cluster[0].flow);
      }
    }
  }
}

// Simple clustering of flows based on signature similarity
function clusterFlows(flows) {
  const clusters = [];

  for (const flowEntry of flows) {
    let addedToCluster = false;
    const flowSig = createFlowSignature(flowEntry.flow);

    for (const cluster of clusters) {
      const clusterSig = createFlowSignature(cluster[0].flow);
      if (flowSignaturesMatch(flowSig, clusterSig)) {
        cluster.push(flowEntry);
        addedToCluster = true;
        break;
      }
    }

    if (!addedToCluster) {
      clusters.push([flowEntry]);
    }
  }

  return clusters;
}


// Create a signature for a flow (for comparison)
function createFlowSignature(flow) {
  return flow.map(step => {
    const url = new URL(step.url);
    // Return domain and pathname for signature
    return `${url.hostname}${url.pathname}`;
  });
}

// Compare two flow signatures to see if they match
function flowSignaturesMatch(sig1, sig2) {
  // Must be same length
  if (sig1.length !== sig2.length) return false;
  
  // Each step must match
  for (let i = 0; i < sig1.length; i++) {
    if (sig1[i] !== sig2[i]) return false;
  }
  
  return true;
}

// Suggest creating an automation for a detected flow
async function suggestFlowAutomation(flow) {
  // Get the active tab to show the suggestion
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;
  
  const activeTab = tabs[0];
  
  // Create a suggested name based on the first and last URLs
  const firstUrl = new URL(flow[0].url);
  const lastUrl = new URL(flow[flow.length - 1].url);
  const suggestedName = `${firstUrl.hostname} to ${lastUrl.hostname}`;
  
  // Send message to content script to show suggestion
  try {
    await chrome.tabs.sendMessage(activeTab.id, {
      action: 'flowforge-suggest-automation',
      flowData: {
        name: suggestedName,
        steps: flow.map(step => ({
          url: step.url,
          title: step.title
        })),
        id: generateFlowId(flow)
      }
    });
  } catch (error) {
    console.log('Could not send suggestion to tab', error);
  }
}

// Save a new flow automation
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'flowforge-save-flow') {
    saveFlow(message.flowData)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates async response
  }
  
  if (message.action === 'flowforge-execute-flow') {
    executeFlow(message.flowId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates async response
  }
  
  if (message.action === 'flowforge-get-flows') {
    chrome.storage.sync.get(['savedFlows'])
      .then(data => sendResponse({ flows: data.savedFlows || [] }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Indicates async response
  }
});

// Save a flow to storage
async function saveFlow(flowData) {
  // Get existing flows
  const data = await chrome.storage.sync.get(['savedFlows']);
  const flows = data.savedFlows || [];
  
  // Add the new flow
  flows.push({
    id: flowData.id || generateFlowId(flowData.steps),
    name: flowData.name,
    description: flowData.description || '',
    steps: flowData.steps,
    triggers: flowData.triggers || [],
    createdAt: Date.now(),
    lastRun: null,
    runCount: 0
  });
  
  // Save back to storage
  await chrome.storage.sync.set({ savedFlows: flows });
  savedFlows = flows;
}

// Execute a saved flow
async function executeFlow(flowId) {
  // Get the flow data
  const data = await chrome.storage.sync.get(['savedFlows']);
  const flows = data.savedFlows || [];
  const flow = flows.find(f => f.id === flowId);
  
  if (!flow) {
    throw new Error('Flow not found');
  }
  
  // Update flow stats
  flow.lastRun = Date.now();
  flow.runCount++;
  await chrome.storage.sync.set({ savedFlows: flows });
  
  // Create a new tab for the first step
  const tab = await chrome.tabs.create({ url: flow.steps[0].url, active: true });
  
  // Store execution state
  const executionState = {
    flowId,
    currentStepIndex: 0,
    tabId: tab.id,
    steps: flow.steps
  };
  
  // Set up listener for tab updates to track progress through the flow
  chrome.tabs.onUpdated.addListener(function tabUpdateListener(tabId, changeInfo, tab) {
    if (tabId === executionState.tabId && changeInfo.status === 'complete') {
      // Current step is loaded, check if we need to run any custom scripts
      const currentStep = executionState.steps[executionState.currentStepIndex];
      
      // If there's a custom script for this step, execute it
      if (currentStep.script) {
        chrome.scripting.executeScript({
          target: { tabId },
          func: new Function(currentStep.script)
        }).then(() => {
          // Wait a moment after script execution
          setTimeout(() => {
            moveToNextStep(executionState, tabUpdateListener);
          }, 1000);
        }).catch(error => {
          console.error('Error executing script:', error);
          moveToNextStep(executionState, tabUpdateListener);
        });
      } else {
        // No script, just wait a moment then move to next step
        setTimeout(() => {
          moveToNextStep(executionState, tabUpdateListener);
        }, 1000);
      }
    }
  });
}

// Move to the next step in a flow execution
function moveToNextStep(executionState, listenerToRemove) {
  executionState.currentStepIndex++;
  
  // Check if we've completed all steps
  if (executionState.currentStepIndex >= executionState.steps.length) {
    // Flow complete, clean up
    chrome.tabs.onUpdated.removeListener(listenerToRemove);
    return;
  }
  
  // Navigate to the next URL
  const nextStep = executionState.steps[executionState.currentStepIndex];
  chrome.tabs.update(executionState.tabId, { url: nextStep.url });
}

// Clear browsing history
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'flowforge-clear-history') {
    clearFlowHistory()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates async response
  }
});

// Clear flow history
async function clearFlowHistory() {
  flowHistory = [];
  currentFlow = [];
  lastNavigationTime = null;
  await chrome.storage.sync.remove('flowHistory');
}

// Handle manual flow recording
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'flowforge-start-recording') {
    // Start recording
    isRecording = true;
    recordedSteps = [];
    sendResponse({ success: true });
  }
  
  if (message.action === 'flowforge-stop-recording') {
    // Stop recording
    isRecording = false;
    sendResponse({ success: true, steps: recordedSteps });
  }
  
  return true; // Indicates async response
});

// Add recording functionality to navigation listener
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only track main frame navigation (not iframes)
  if (details.frameId !== 0) return;
  
  const tab = await chrome.tabs.get(details.tabId);
  const url = new URL(details.url);
  
  // Ignore extension pages and some special URLs
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'chrome:' || 
      url.protocol === 'about:') {
    return;
  }
  
  // If we're manually recording, add this step to recordedSteps
  if (isRecording) {
    recordedSteps.push({
      url: details.url,
      title: tab.title,
      script: null
    });
  }
});