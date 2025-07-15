// FlowForge Popup Script

// DOM Elements
const flowList = document.getElementById('flow-list');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const searchInput = document.getElementById('search-input');
const createFlowBtn = document.getElementById('create-flow-btn');
const createFirstFlowBtn = document.getElementById('create-first-flow-btn');
const settingsBtn = document.getElementById('settings-btn');
const recordFlowBtn = document.getElementById('record-flow-btn');

// Modals
const createFlowModal = document.getElementById('create-flow-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const createFlowForm = document.getElementById('create-flow-form');
const cancelFlowBtn = document.getElementById('cancel-flow-btn');
const addStepBtn = document.getElementById('add-step-btn');

const addStepModal = document.getElementById('add-step-modal');
const closeStepModalBtn = document.getElementById('close-step-modal-btn');
const addStepForm = document.getElementById('add-step-form');
const cancelStepBtn = document.getElementById('cancel-step-btn');

// Function to apply internationalized messages to the UI
function applyI18nMessages() {


  document.getElementById('search-input').placeholder = chrome.i18n.getMessage('searchFlowsPlaceholder');
  document.getElementById('noFlowsYetHeader').textContent = chrome.i18n.getMessage('noFlowsYetHeader');
  document.getElementById('noFlowsYetDescription').textContent = chrome.i18n.getMessage('noFlowsYetDescription');
  document.getElementById('create-first-flow-btn').textContent = chrome.i18n.getMessage('createFlowButton');
  document.getElementById('footerText').textContent = chrome.i18n.getMessage('footerText');
  document.getElementById('optionsLink').textContent = chrome.i18n.getMessage('optionsLink');
  document.getElementById('supportDeveloperTitle').textContent = chrome.i18n.getMessage('supportDeveloperTitle');
  document.getElementById('buyMeACoffee').textContent = chrome.i18n.getMessage('buyMeACoffee');
  document.getElementById('createNewFlowModalTitle').textContent = chrome.i18n.getMessage('createNewFlowModalTitle');
  document.getElementById('flowNameLabel').textContent = chrome.i18n.getMessage('flowNameLabel');
  document.getElementById('flowDescriptionLabel').textContent = chrome.i18n.getMessage('flowDescriptionLabel');
  document.getElementById('stepsLabel').textContent = chrome.i18n.getMessage('stepsLabel');
  document.getElementById('noStepsAddedYet').textContent = chrome.i18n.getMessage('noStepsAddedYet');
  document.getElementById('addStepButton').textContent = chrome.i18n.getMessage('addStepButton');
  document.getElementById('recordFlowBtn').textContent = chrome.i18n.getMessage('recordFlowButton');
  document.getElementById('cancelFlowBtn').textContent = chrome.i18n.getMessage('cancelButton');
  document.getElementById('createFlowBtnModal').textContent = chrome.i18n.getMessage('createFlowButtonModal');
  document.getElementById('addStepModalTitle').textContent = chrome.i18n.getMessage('addStepModalTitle');
  document.getElementById('urlLabel').textContent = chrome.i18n.getMessage('urlLabel');
  document.getElementById('stepTitleLabel').textContent = chrome.i18n.getMessage('stepTitleLabel');
  document.getElementById('customScriptLabel').textContent = chrome.i18n.getMessage('customScriptLabel');
  document.getElementById('customScriptDescription').textContent = chrome.i18n.getMessage('customScriptDescription');
  document.getElementById('addStepButtonModal').textContent = chrome.i18n.getMessage('addStepButtonModal');
}

// State

// State
let flows = [];
let filteredFlows = [];
let currentSteps = [];
let editingStepIndex = -1;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Set up event listeners
  setupEventListeners();

  // Check recording status
  chrome.runtime.sendMessage({ action: 'flowforge-get-recording-status' }, (response) => {
    if (response && response.isRecording) {
      isRecording = true;
      recordFlowBtn.textContent = 'Stop Recording';
      recordFlowBtn.classList.remove('bg-white', 'text-indigo-700');
      recordFlowBtn.classList.add('bg-red-100', 'text-red-700');
      showCreateFlowModal(); // Automatically show recording progress
    }
  });

  // Apply internationalized messages
  applyI18nMessages();

  // Load flows
  await loadFlows();

  // Render UI
  renderFlows();
}

function setupEventListeners() {
  // Search
  searchInput.addEventListener('input', handleSearch);
  
  // Create flow
  createFlowBtn.addEventListener('click', showCreateFlowModal);
  createFirstFlowBtn.addEventListener('click', showCreateFlowModal);
  closeModalBtn.addEventListener('click', hideCreateFlowModal);
  cancelFlowBtn.addEventListener('click', hideCreateFlowModal);
  createFlowForm.addEventListener('submit', handleCreateFlow);
  
  // Add step
  addStepBtn.addEventListener('click', showAddStepModal);
  closeStepModalBtn.addEventListener('click', hideAddStepModal);
  cancelStepBtn.addEventListener('click', hideAddStepModal);
  addStepForm.addEventListener('submit', handleAddStep);
  
  // Settings
  settingsBtn.addEventListener('click', openOptionsPage);
  if (recordFlowBtn) {
    recordFlowBtn.addEventListener('click', handleRecordFlow);
  }
}

async function loadFlows() {
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  flowList.classList.add('hidden');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'flowforge-get-flows'
    });

    if (response && response.flows) {
      flows = response.flows;
      filteredFlows = [...flows];
    }
  } catch (error) {
    console.error('Error loading flows:', error);
  } finally {
    loadingState.classList.add('hidden');
    updateUIState();
  }
}

// Listen for flow updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'flowforge-flows-updated') {
    loadFlows().then(() => renderFlows());
  }
});

function updateUIState() {
  if (filteredFlows.length === 0) {
    emptyState.classList.remove('hidden');
    flowList.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    flowList.classList.remove('hidden');
  }
}

function renderFlows() {
  // Clear the list
  flowList.innerHTML = '';

  // Render each flow
  filteredFlows.forEach(flow => {
    const flowCard = createFlowCard(flow);
    flowList.appendChild(flowCard);
  });

  updateUIState();
}

function createFlowCard(flow) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-lg shadow border border-gray-200 overflow-hidden hover:shadow-md transition-shadow w-full';
  card.dataset.flowId = flow.id;

  // Get favicon for the first step
  let faviconUrl = '';
  if (flow.steps && flow.steps.length > 0) {
    const firstStepUrl = new URL(flow.steps[0].url);
    faviconUrl = `https://www.google.com/s2/favicons?domain=${firstStepUrl.hostname}&sz=32`;
  }

  // Format the last run date
  let lastRunText = 'Never run';
  if (flow.lastRun) {
    const lastRunDate = new Date(flow.lastRun);
    lastRunText = `Last run: ${lastRunDate.toLocaleDateString()}`;
  }

  card.innerHTML = `
    <div class="p-4">
      <div class="flex items-start">
        <div class="flex-shrink-0 mr-3">
          <img src="${faviconUrl}" alt="" class="w-8 h-8 rounded bg-gray-100">
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-medium text-gray-900 truncate">${flow.name}</h3>
          <p class="text-xs text-gray-500 mt-1 truncate">${flow.description || 'No description'}</p>
          <div class="flex items-center mt-2 text-xs text-gray-500">
            <span class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              ${flow.steps.length} steps
            </span>
            <span class="mx-2">•</span>
            <span>${lastRunText}</span>
          </div>
        </div>
        <div class="ml-2 flex-shrink-0 flex">
          <div class="dropdown relative">
            <button class="p-1 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none" aria-label="Options">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            <div class="dropdown-menu hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
              <a href="#" class="edit-flow-btn block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit</a>
              <a href="#" class="delete-flow-btn block px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Delete</a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="bg-gray-50 px-4 py-3 border-t border-gray-200">
      <button class="run-flow-btn w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Run Flow
      </button>
    </div>
  `;

  // Add event listeners
  const runBtn = card.querySelector('.run-flow-btn');
  runBtn.addEventListener('click', () => runFlow(flow.id));

  const menuBtn = card.querySelector('.dropdown button');
  const menu = card.querySelector('.dropdown-menu');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    menu.classList.add('hidden');
  });

  const editBtn = card.querySelector('.edit-flow-btn');
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    editFlow(flow);
  });

  const deleteBtn = card.querySelector('.delete-flow-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    deleteFlow(flow.id);
  });

  return card;
}

let isRecording = false;

function handleRecordFlow() {
  isRecording = !isRecording;
  if (isRecording) {
    // Start recording
    chrome.runtime.sendMessage({ action: 'flowforge-start-recording' }, (response) => {
      if (response && response.success) {
        recordFlowBtn.textContent = 'Stop Recording';
        recordFlowBtn.classList.remove('bg-white', 'text-indigo-700');
        recordFlowBtn.classList.add('bg-red-100', 'text-red-700');
      }
    });
  } else {
    // Stop recording
    chrome.runtime.sendMessage({ action: 'flowforge-stop-recording' }, (response) => {
      if (response && response.success && response.steps) {
        recordFlowBtn.textContent = 'Record Flow';
        recordFlowBtn.classList.remove('bg-red-100', 'text-red-700');
        recordFlowBtn.classList.add('bg-white', 'text-indigo-700');
        // Add recorded steps to the modal
        currentSteps = response.steps;
        renderSteps();
      }
    });
  }
}

function renderSteps() {
  const flowSteps = document.getElementById('flow-steps');
  flowSteps.innerHTML = '';
  if (currentSteps.length === 0) {
    flowSteps.innerHTML = '<div class="text-sm text-gray-500 italic">No steps added yet. Click "Add Step" below.</div>';
    return;
  }
  currentSteps.forEach((step, idx) => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between bg-gray-100 rounded px-2 py-1';
    div.innerHTML = `<span class="truncate">${step.url}</span>`;
    flowSteps.appendChild(div);
  });
}

function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  
  if (searchTerm === '') {
    filteredFlows = [...flows];
  } else {
    filteredFlows = flows.filter(flow => {
      return (
        flow.name.toLowerCase().includes(searchTerm) ||
        (flow.description && flow.description.toLowerCase().includes(searchTerm))
      );
    });
  }
  
  renderFlows();
}

function showCreateFlowModal() {
  // Reset form
  createFlowForm.reset();
  currentSteps = [];
  renderSteps();
  
  // Show modal
  createFlowModal.classList.remove('hidden');
}

function hideCreateFlowModal() {
  createFlowModal.classList.add('hidden');
}

function showAddStepModal() {
  // Reset form
  addStepForm.reset();
  editingStepIndex = -1;
  
  // Show modal
  addStepModal.classList.remove('hidden');
}

function hideAddStepModal() {
  addStepModal.classList.add('hidden');
}

function handleCreateFlow(e) {
  e.preventDefault();
  
  const name = document.getElementById('flow-name').value;
  const description = document.getElementById('flow-description').value;
  
  if (name && currentSteps.length > 0) {
    const newFlow = {
      name,
      description,
      steps: currentSteps,
      id: 'flow-' + Date.now(),
      createdAt: Date.now(),
      lastRun: null,
      runCount: 0,
      triggers: []
    };
    
    // Save to background
    chrome.runtime.sendMessage({
      action: 'flowforge-save-flow',
      flowData: newFlow
    }, async (response) => {
      if (response && response.success) {
        // Reload flows
        await loadFlows();
        renderFlows();
        
        // Hide modal
        hideCreateFlowModal();
      }
    });
  }
}

function handleAddStep(e) {
  e.preventDefault();
  
  const url = document.getElementById('step-url').value;
  const title = document.getElementById('step-title').value;
  const script = document.getElementById('step-script').value;
  
  if (url) {
    const step = {
      url,
      title: title || new URL(url).hostname,
      script: script || null
    };
    
    if (editingStepIndex >= 0) {
      // Edit existing step
      currentSteps[editingStepIndex] = step;
    } else {
      // Add new step
      currentSteps.push(step);
    }
    
    renderSteps();
    hideAddStepModal();
  }
}

function renderSteps() {
  const stepsContainer = document.getElementById('flow-steps');
  
  if (currentSteps.length === 0) {
    stepsContainer.innerHTML = '<div class="text-sm text-gray-500 italic">No steps added yet. Click "Add Step" below.</div>';
    return;
  }
  
  stepsContainer.innerHTML = '';
  
  currentSteps.forEach((step, index) => {
    const stepElement = document.createElement('div');
    stepElement.className = 'flex items-center justify-between bg-gray-50 rounded p-2';
    
    const url = new URL(step.url);
    const favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
    
    stepElement.innerHTML = `
      <div class="flex items-center space-x-2">
        <div class="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
          ${index + 1}
        </div>
        <div class="flex items-center">
          <img src="${favicon}" alt="" class="w-4 h-4 mr-2">
          <span class="text-sm truncate max-w-[250px]">${step.title || url.hostname}</span>
        </div>
      </div>
      <div class="flex space-x-1">
        <button type="button" class="edit-step-btn p-1 text-gray-500 hover:text-indigo-600" title="Edit Step">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button type="button" class="delete-step-btn p-1 text-gray-500 hover:text-red-600" title="Delete Step">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;
    
    // Add event listeners
    const editBtn = stepElement.querySelector('.edit-step-btn');
    editBtn.addEventListener('click', () => editStep(index));
    
    const deleteBtn = stepElement.querySelector('.delete-step-btn');
    deleteBtn.addEventListener('click', () => deleteStep(index));
    
    stepsContainer.appendChild(stepElement);
  });
}

function editStep(index) {
  const step = currentSteps[index];
  editingStepIndex = index;
  
  // Fill form
  document.getElementById('step-url').value = step.url;
  document.getElementById('step-title').value = step.title || '';
  document.getElementById('step-script').value = step.script || '';
  
  // Show modal
  showAddStepModal();
}

function deleteStep(index) {
  currentSteps.splice(index, 1);
  renderSteps();
}

function editFlow(flow) {
  // Fill form
  document.getElementById('flow-name').value = flow.name;
  document.getElementById('flow-description').value = flow.description || '';
  currentSteps = [...flow.steps];
  
  // Show modal
  renderSteps();
  showCreateFlowModal();
}

function deleteFlow(flowId) {
  if (confirm('Are you sure you want to delete this flow?')) {
    // Get current flows
    chrome.storage.local.get(['savedFlows'], (data) => {
      const savedFlows = data.savedFlows || [];
      const updatedFlows = savedFlows.filter(flow => flow.id !== flowId);
      
      // Save updated flows
      chrome.storage.local.set({ savedFlows: updatedFlows }, async () => {
        // Reload flows
        await loadFlows();
        renderFlows();
      });
    });
  }
}

function runFlow(flowId) {
  chrome.runtime.sendMessage({
    action: 'flowforge-execute-flow',
    flowId
  }, (response) => {
    if (response && response.success) {
      // Close popup
      window.close();
    } else {
      alert('Failed to run flow. ' + (response.error || ''));
    }
  });
}

function openOptionsPage() {
  chrome.runtime.openOptionsPage();
}

// Handle dropdown menus
document.addEventListener('click', (e) => {
  const dropdowns = document.querySelectorAll('.dropdown-menu');
  dropdowns.forEach(dropdown => {
    if (!dropdown.contains(e.target) && !dropdown.previousElementSibling.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
});