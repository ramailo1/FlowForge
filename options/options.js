// FlowForge Options Script

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const flowList = document.getElementById('flow-list');
const searchInput = document.getElementById('search-input');
const languageSelect = document.getElementById('language-select');

// Settings elements
const settingsForm = document.getElementById('settings-form');
const detectionSensitivity = document.getElementById('detection-sensitivity');
const notificationsEnabled = document.getElementById('notifications-enabled');
const encryptionEnabled = document.getElementById('encryption-enabled');
const darkModeEnabled = document.getElementById('dark-mode-enabled');

// Data management elements
const exportDataBtn = document.getElementById('export-data-btn');
const importDataBtn = document.getElementById('import-data-btn');
const importDataInput = document.getElementById('import-data-input');
const clearDataBtn = document.getElementById('clear-data-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// Confirm modal elements
const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalCloseBtn = document.getElementById('confirm-modal-close');
const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel');
const confirmModalConfirmBtn = document.getElementById('confirm-modal-confirm');

// Flow creation modal elements
const createFlowModal = document.getElementById('create-flow-modal');
const createFlowForm = document.getElementById('create-flow-form');
const createFlowCloseBtn = document.getElementById('close-create-flow-modal');
const createFlowCancelBtn = document.getElementById('cancel-create-flow');
const addStepBtn = document.getElementById('add-step-btn');
const recordFlowBtn = document.getElementById('record-flow-btn');

// Add step modal elements
const addStepModal = document.getElementById('add-step-modal');
const addStepForm = document.getElementById('add-step-form');
const addStepCloseBtn = document.getElementById('close-add-step-modal');
const addStepCancelBtn = document.getElementById('cancel-add-step');

// Toast element
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// State
let flows = [];
let filteredFlows = [];
let settings = {};
let pendingAction = null;
let currentSteps = [];
let editingStepIndex = -1;
let isRecordingFlow = false;

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Add event listener for back to extension button
const backToPopupBtn = document.getElementById('back-to-popup');
if (backToPopupBtn) {
  backToPopupBtn.addEventListener('click', function(e) {
    e.preventDefault();
    // Try to close the tab or redirect to popup
    window.close();
  });
}

function toggleDarkMode() {
  if (darkModeEnabled.checked) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

async function init() {
  console.log('DOM fully loaded, checking importDataInput:', importDataInput);
  // Set up event listeners
  setupEventListeners();

  // Add event listener for reload extension button
  const reloadExtensionBtn = document.getElementById('reload-extension-btn');
  if (reloadExtensionBtn) {
    reloadExtensionBtn.addEventListener('click', () => {
      chrome.runtime.reload();
    });
  }
  
  // Load data
  await Promise.all([
    loadFlows(),
    loadSettings()
  ]);
  
  // Render UI
  renderFlows();
  renderSettings();
  applyI18nMessages();
  populateLanguageDropdown();
}

function renderSettings() {
  if (settings) {
    detectionSensitivity.value = settings.detectionSensitivity || 'medium';
    notificationsEnabled.checked = settings.notificationsEnabled !== false;
    encryptionEnabled.checked = settings.encryptionEnabled || false;
    if (darkModeEnabled) {
      darkModeEnabled.checked = settings.darkModeEnabled || false;
    }
    if (languageSelect) {
      languageSelect.value = settings.language || 'en'; // Default to English if no language is set
    }
    toggleDarkMode(); // Apply dark mode immediately on settings render
  }
}

async function loadLocaleMessages(locale) {
  try {
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load messages for locale ${locale}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading locale messages for ${locale}:`, error);
    // Fallback to default locale if loading fails
    const defaultUrl = chrome.runtime.getURL(`_locales/en/messages.json`);
    const defaultResponse = await fetch(defaultUrl);
    return await defaultResponse.json();
  }
}

async function applyI18nMessages() {
  const currentLanguage = settings.language || 'en'; // Default to English if no language is set
  const messages = await loadLocaleMessages(currentLanguage);

  const getMessage = (key) => messages[key]?.message || `__MSG_${key}__`;

  document.title = getMessage('optionsTitle');

  const backToPopupBtn = document.getElementById('back-to-popup');
  if (backToPopupBtn) {
    backToPopupBtn.textContent = getMessage('backToExtension');
  }

  const h1Title = document.querySelector('h1');
  if (h1Title) {
    h1Title.textContent = getMessage('optionsTitle');
  }

  const flowsTabDiv = document.querySelector('.tab-button[data-tab="flows"] div');
  if (flowsTabDiv) {
    flowsTabDiv.textContent = getMessage('flowsTab');
  }

  const settingsTabDiv = document.querySelector('.tab-button[data-tab="settings"] div');
  if (settingsTabDiv) {
    settingsTabDiv.textContent = getMessage('settingsTab');
  }

  const dataManagementTabDiv = document.querySelector('.tab-button[data-tab="data"] div');
  if (dataManagementTabDiv) {
    dataManagementTabDiv.textContent = getMessage('dataManagementTab');
  }

  const aboutTabDiv = document.querySelector('.tab-button[data-tab="about"] div');
  if (aboutTabDiv) {
    aboutTabDiv.textContent = getMessage('aboutTab');
  }

  const flowsTabH2 = document.querySelector('#flows-tab h2');
  if (flowsTabH2) {
    flowsTabH2.textContent = getMessage('manageFlowsHeader');
  }

  const searchInputPlaceholder = document.querySelector('#flows-tab #search-input');
  if (searchInputPlaceholder) {
    searchInputPlaceholder.placeholder = getMessage('searchFlowsPlaceholder');
  }

  const createFlowBtn = document.querySelector('#create-flow-btn');
  if (createFlowBtn) {
    createFlowBtn.textContent = getMessage('newFlowButton');
  }

  const settingsTabH2 = document.querySelector('#settings-tab h2');
  if (settingsTabH2) {
    settingsTabH2.textContent = getMessage('extensionSettingsHeader');
  }

  const languageSelectionLabel = document.getElementById('languageSelectionLabel');
  if (languageSelectionLabel) {
    languageSelectionLabel.textContent = getMessage('languageSelectionLabel');
  }

  const languageSelectionDescription = document.getElementById('languageSelectionDescription');
  if (languageSelectionDescription) {
    languageSelectionDescription.textContent = getMessage('languageSelectionDescription');
  }

  const flowDetectionSensitivityHeader = document.getElementById('flowDetectionSensitivityHeader');
  if (flowDetectionSensitivityHeader) {
    flowDetectionSensitivityHeader.textContent = getMessage('flowDetectionSensitivityHeader');
  }

  const flowDetectionSensitivityDescription = document.getElementById('flowDetectionSensitivityDescription');
  if (flowDetectionSensitivityDescription) {
    flowDetectionSensitivityDescription.textContent = getMessage('flowDetectionSensitivityDescription');
  }

  const sensitivityLow = document.getElementById('sensitivityLow');
  if (sensitivityLow) {
    sensitivityLow.textContent = getMessage('sensitivityLow');
  }

  const sensitivityMedium = document.getElementById('sensitivityMedium');
  if (sensitivityMedium) {
    sensitivityMedium.textContent = getMessage('sensitivityMedium');
  }

  const sensitivityHigh = document.getElementById('sensitivityHigh');
  if (sensitivityHigh) {
    sensitivityHigh.textContent = getMessage('sensitivityHigh');
  }

  const enableNotificationsLabel = document.getElementById('enableNotificationsLabel');
  if (enableNotificationsLabel) {
    enableNotificationsLabel.textContent = getMessage('enableNotificationsLabel');
  }

  const enableNotificationsDescription = document.getElementById('enableNotificationsDescription');
  if (enableNotificationsDescription) {
    enableNotificationsDescription.textContent = getMessage('enableNotificationsDescription');
  }

  const enableEncryptionLabel = document.getElementById('enableEncryptionLabel');
  if (enableEncryptionLabel) {
    enableEncryptionLabel.textContent = getMessage('enableEncryptionLabel');
  }

  const enableEncryptionDescription = document.getElementById('enableEncryptionDescription');
  if (enableEncryptionDescription) {
    enableEncryptionDescription.textContent = getMessage('enableEncryptionDescription');
  }

  enableDarkModeLabel = document.getElementById('enableDarkModeLabel');
  if (enableDarkModeLabel) {
    enableDarkModeLabel.textContent = getMessage('enableDarkModeLabel');
  }

  enableDarkModeDescription = document.getElementById('enableDarkModeDescription');
  if (enableDarkModeDescription) {
    enableDarkModeDescription.textContent = getMessage('enableDarkModeDescription');
  }

  const saveSettingsBtn = document.getElementById('save-settings-btn');
  if (saveSettingsBtn) {
    saveSettingsBtn.textContent = getMessage('saveSettingsButton');
  }

  const dataTabH2 = document.querySelector('#data-tab h2');
  if (dataTabH2) {
    dataTabH2.textContent = getMessage('dataManagementHeader');
  }

  const exportDataHeader = document.querySelector('#data-tab h3:nth-of-type(1)');
  if (exportDataHeader) {
    exportDataHeader.textContent = chrome.i18n.getMessage('exportDataHeader');
  }

  const exportDataDescription = document.querySelector('#data-tab p:nth-of-type(1)');
  if (exportDataDescription) {
    exportDataDescription.textContent = chrome.i18n.getMessage('exportDataDescription');
  }

  const exportDataBtn = document.getElementById('export-data-btn');
  if (exportDataBtn) {
    exportDataBtn.textContent = getMessage('exportDataButton');
  }

  const importDataHeader = document.querySelector('#data-tab h3:nth-of-type(2)');
  if (importDataHeader) {
    importDataHeader.textContent = chrome.i18n.getMessage('importDataHeader');
  }

  const importDataDescription = document.querySelector('#data-tab p:nth-of-type(2)');
  if (importDataDescription) {
    importDataDescription.textContent = chrome.i18n.getMessage('importDataDescription');
  }

  const importFileLabel = document.querySelector('label[for="import-file"]');
  if (importFileLabel) {
    importFileLabel.textContent = getMessage('importDataButton');
  }

  const clearDataHeader = document.querySelector('#data-tab h3:nth-of-type(3)');
  if (clearDataHeader) {
    clearDataHeader.textContent = chrome.i18n.getMessage('clearDataHeader');
  }

  const clearDataDescription = document.querySelector('#data-tab p:nth-of-type(3)');
  if (clearDataDescription) {
    clearDataDescription.textContent = chrome.i18n.getMessage('clearDataDescription');
  }

  const clearDataBtn = document.getElementById('clear-data-btn');
  if (clearDataBtn) {
    clearDataBtn.textContent = chrome.i18n.getMessage('clearDataButton');
  }

  const clearHistoryBtn = document.getElementById('clear-history-btn');
  if (clearHistoryBtn) {
    clearHistoryBtn.textContent = chrome.i18n.getMessage('clearHistoryButton');
  }

  const aboutTabH2 = document.querySelector('#about-tab h2');
  if (aboutTabH2) {
    aboutTabH2.textContent = getMessage('aboutHeader');
  }

  const versionInfo = document.getElementById('versionInfo');
  if (versionInfo) {
    versionInfo.textContent = getMessage('versionInfo', [chrome.runtime.getManifest().version]);
  }

  const developedBy = document.getElementById('developedBy');
  if (developedBy) {
    developedBy.textContent = chrome.i18n.getMessage('developedBy');
  }

  const supportDevelopment = document.getElementById('supportDevelopment');
  if (supportDevelopment) {
    supportDevelopment.textContent = chrome.i18n.getMessage('supportDevelopment');
  }

  const buyMeACoffeeLink = document.getElementById('buyMeACoffeeLink');
  if (buyMeACoffeeLink) {
    buyMeACoffeeLink.textContent = chrome.i18n.getMessage('buyMeACoffee');
  }

  const privacyPolicyLink = document.getElementById('privacyPolicyLink');
  if (privacyPolicyLink) {
    privacyPolicyLink.textContent = chrome.i18n.getMessage('privacyPolicy');
  }

  const termsOfServiceLink = document.getElementById('termsOfServiceLink');
  if (termsOfServiceLink) {
    termsOfServiceLink.textContent = chrome.i18n.getMessage('termsOfService');
  }

  const confirmModalTitle = document.getElementById('confirm-modal-title');
  if (confirmModalTitle) {
    confirmModalTitle.textContent = chrome.i18n.getMessage('confirmModalTitle');
  }

  const confirmModalCancel = document.getElementById('confirm-modal-cancel');
  if (confirmModalCancel) {
    confirmModalCancel.textContent = chrome.i18n.getMessage('cancelButton');
  }

  const confirmModalConfirm = document.getElementById('confirm-modal-confirm');
  if (confirmModalConfirm) {
    confirmModalConfirm.textContent = chrome.i18n.getMessage('confirmButton');
  }

  const createFlowModalTitle = document.getElementById('createFlowModalTitle');
  if (createFlowModalTitle) {
    createFlowModalTitle.textContent = chrome.i18n.getMessage('createNewFlowModalTitle');
  }

  const flowNameLabel = document.getElementById('flowNameLabel');
  if (flowNameLabel) {
    flowNameLabel.textContent = chrome.i18n.getMessage('flowNameLabel');
  }

  const flowDescriptionLabel = document.getElementById('flowDescriptionLabel');
  if (flowDescriptionLabel) {
    flowDescriptionLabel.textContent = chrome.i18n.getMessage('flowDescriptionLabel');
  }

  const stepsLabel = document.getElementById('stepsLabel');
  if (stepsLabel) {
    stepsLabel.textContent = chrome.i18n.getMessage('stepsLabel');
  }

  const noStepsAddedYet = document.getElementById('noStepsAddedYet');
  if (noStepsAddedYet) {
    noStepsAddedYet.textContent = chrome.i18n.getMessage('noStepsAddedYet');
  }

  const addStepButton = document.getElementById('addStepButton');
  if (addStepButton) {
    addStepButton.textContent = chrome.i18n.getMessage('addStepButton');
  }

  const cancelCreateFlowButton = document.getElementById('cancelCreateFlowButton');
  if (cancelCreateFlowButton) {
    cancelCreateFlowButton.textContent = chrome.i18n.getMessage('cancelButton');
  }

  const createFlowButtonModal = document.getElementById('createFlowButtonModal');
  if (createFlowButtonModal) {
    createFlowButtonModal.textContent = chrome.i18n.getMessage('createFlowButtonModal');
  }

  const addStepModalTitle = document.getElementById('addStepModalTitle');
  if (addStepModalTitle) {
    addStepModalTitle.textContent = chrome.i18n.getMessage('addStepModalTitle');
  }

  const urlLabel = document.getElementById('urlLabel');
  if (urlLabel) {
    urlLabel.textContent = chrome.i18n.getMessage('urlLabel');
  }

  const stepTitleLabel = document.getElementById('stepTitleLabel');
  if (stepTitleLabel) {
    stepTitleLabel.textContent = chrome.i18n.getMessage('stepTitleLabel');
  }

  const customScriptLabel = document.getElementById('customScriptLabel');
  if (customScriptLabel) {
    customScriptLabel.textContent = chrome.i18n.getMessage('customScriptLabel');
  }

  const customScriptDescription = document.getElementById('customScriptDescription');
  if (customScriptDescription) {
    customScriptDescription.textContent = chrome.i18n.getMessage('customScriptDescription');
  }

  const addStepButtonModal = document.getElementById('addStepButtonModal');
  if (addStepButtonModal) {
    addStepButtonModal.textContent = chrome.i18n.getMessage('addStepButtonModal');
  }

  const cancelAddStepButton = document.getElementById('cancelAddStepButton');
  if (cancelAddStepButton) {
    cancelAddStepButton.textContent = chrome.i18n.getMessage('cancelButton');
  }

  const toastMessage = document.getElementById('toast-message');
  if (toastMessage) {
    toastMessage.textContent = chrome.i18n.getMessage('toastMessage');
  }

  enableDarkModeLabel = document.getElementById('enableDarkModeLabel');
  if (enableDarkModeLabel) {
    enableDarkModeLabel.textContent = chrome.i18n.getMessage('enableDarkModeLabel');
  }

  enableDarkModeDescription = document.getElementById('enableDarkModeDescription');
  if (enableDarkModeDescription) {
    enableDarkModeDescription.textContent = chrome.i18n.getMessage('enableDarkModeDescription');
  }
}


async function loadSettings() {
  try {
    const response = await chrome.storage.sync.get('settings');
    settings = response.settings || {};
    // Detect browser language on first install if no language is set
    if (!settings.language) {
      const browserLanguage = chrome.i18n.getUILanguage();
      // Check if the browser language is one of our supported locales
      const supportedLocales = ['en', 'fr', 'es', 'ar', 'zh', 'ja', 'ko'];
      const detectedLanguage = supportedLocales.find(locale => browserLanguage.startsWith(locale)) || 'en';
      settings.language = detectedLanguage;
      // Save the detected language to storage
      await chrome.storage.sync.set({ settings: settings });
      console.log('Detected and saved language:', detectedLanguage);
    }

    // Detect browser theme on first install if no dark mode setting is found
    if (settings.darkModeEnabled === undefined) {
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      settings.darkModeEnabled = prefersDarkMode;
      await chrome.storage.sync.set({ settings: settings });
      console.log('Detected and saved dark mode preference:', prefersDarkMode);
    }
  } catch (error) {
    console.error('Settings loading error:', error);
    showToast('Failed to load settings');
  }
}

async function handleLanguageChange(event) {
  const newLanguage = event.target.value;
  settings.language = newLanguage;
  await chrome.storage.sync.set({ settings });
  // Re-apply i18n messages to update the UI without reloading the extension
  applyI18nMessages();
  // Re-populate the dropdown to reflect the newly selected language
  populateLanguageDropdown();
}

async function populateLanguageDropdown() {
  const availableLocales = await getAvailableLocales();
  const currentUILanguage = chrome.i18n.getUILanguage();

  languageSelect.innerHTML = ''; // Clear existing options

  const languageNames = {
    'en': 'English',
    'fr': 'Français',
    'es': 'Español',
    'ar': 'العربية',
    'zh': '中文 (简体)',
    'ja': '日本語',
    'ko': '한국어'
  };

  for (const lang of availableLocales) {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = languageNames[lang] || lang; // Display the full native name, fallback to code if not found
    if (lang === (settings.language || currentUILanguage)) {
      option.selected = true;
    }
    languageSelect.appendChild(option);
  }

  // Optionally, add more user-friendly names for common languages
  // This would require a mapping or more sophisticated i18n setup
  // For now, just using the language code
}

async function getAvailableLocales() {
  return new Promise(resolve => {
    chrome.runtime.getPackageDirectoryEntry(function(root) {
      root.getDirectory('_locales', {create: false}, function(localesDir) {
        localesDir.createReader().readEntries(function(entries) {
          const locales = entries.filter(entry => entry.isDirectory).map(entry => entry.name);
          resolve(locales);
        });
      });
    });
  });
}

function setupEventListeners() {
  // Tab navigation
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      showTab(tabId);
    });
  });

  // Flow search
  if (searchInput) searchInput.addEventListener('input', handleSearch);

  // Create flow button
  const createFlowBtn = document.getElementById('create-flow-btn');
  if (createFlowBtn) {
    createFlowBtn.addEventListener('click', showCreateFlowModal);
  }

  // Settings form
  if (settingsForm) settingsForm.addEventListener('submit', handleSettingsSave);
  if (languageSelect) languageSelect.addEventListener('change', handleLanguageChange);
  
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', handleSettingsSave);
  }

  if (darkModeEnabled) {
    darkModeEnabled.addEventListener('change', toggleDarkMode);
  }
  
  // Export/Import data
  if (exportDataBtn) exportDataBtn.addEventListener('click', handleExportData);
  if (importDataBtn) importDataBtn.addEventListener('click', () => importDataInput.click());
  if (importDataInput) importDataInput.addEventListener('change', handleImportData);
  
  // Clear data
  if (clearDataBtn) clearDataBtn.addEventListener('click', () => showConfirmModal('clear-all'));
  if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => showConfirmModal('clear-history'));
  
  // Confirm modal
  if (confirmModalCancelBtn) confirmModalCancelBtn.addEventListener('click', hideConfirmModal);
  if (confirmModalConfirmBtn) confirmModalConfirmBtn.addEventListener('click', handleConfirmAction);
  
  // Create Flow Modal
  if (createFlowCloseBtn) createFlowCloseBtn.addEventListener('click', hideCreateFlowModal);
  if (createFlowCancelBtn) createFlowCancelBtn.addEventListener('click', hideCreateFlowModal);
  if (createFlowForm) createFlowForm.addEventListener('submit', handleCreateFlow);
  if (addStepBtn) addStepBtn.addEventListener('click', showAddStepModal);
  if (recordFlowBtn) recordFlowBtn.addEventListener('click', toggleFlowRecording);
  
  // Add Step Modal
  if (addStepCloseBtn) addStepCloseBtn.addEventListener('click', hideAddStepModal);
  if (addStepCancelBtn) addStepCancelBtn.addEventListener('click', hideAddStepModal);
  if (addStepForm) addStepForm.addEventListener('submit', handleAddStep);
}

function showTab(tabId) {
  // Update tab buttons
  tabButtons.forEach(button => {
    const buttonTabId = button.getAttribute('data-tab');
    
    if (buttonTabId === tabId) {
      button.classList.add('active');
      button.classList.remove('text-gray-500');
      button.classList.add('text-indigo-600', 'border-indigo-500');
    } else {
      button.classList.remove('active');
      button.classList.remove('text-indigo-600', 'border-indigo-500');
      button.classList.add('text-gray-500');
    }
  });
  
  // Update tab contents
  tabContents.forEach(content => {
    if (content.id === `${tabId}-tab`) {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  });
}

// Fix flow rendering in options.js
async function loadFlows() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'flowforge-get-flows'
    });
    
    flows = response?.flows || [];
    filteredFlows = [...flows];
    renderFlows();
  } catch (error) {
    console.error('Flow loading error:', error);
    showToast('Failed to load flows');
  }
}

// Fix flow creation handler
async function handleCreateFlow(e) {
  e.preventDefault();
  e.stopPropagation(); // Add this line
  
  const name = document.getElementById('flow-name').value;
  const description = document.getElementById('flow-description').value;
  
  console.log('Attempting to create flow:', { name, description, steps: currentSteps.length });

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
      console.log('Response from save-flow message:', response);
      if (response && response.success) {
        console.log('Flow saved successfully, reloading and rendering flows...');
        // Reload flows
        await loadFlows();
        renderFlows();
        
        // Hide modal
        hideCreateFlowModal();
        
        // Show success message
        showToast('Flow created successfully');
      } else {
        console.error('Failed to save flow:', response && response.error);
        showToast('Failed to create flow');
      }
    });
  } else {
    console.log('Flow name is empty or no steps recorded.');
    showToast('Please provide a name and record at least one step.');
  }
}

// Handle adding a step to the flow
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

// Render the steps in the flow creation modal
function renderSteps() {
  const stepsContainer = document.getElementById('flow-steps');
  
  if (currentSteps.length === 0) {
    stepsContainer.innerHTML = '<div class="text-sm text-gray-500 italic">No steps added yet. Click "Add Step" or "Record Flow" above.</div>';
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

// Edit a step
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

// Delete a step
function deleteStep(index) {
  currentSteps.splice(index, 1);
  renderSteps();
}

// Toggle flow recording
function toggleFlowRecording() {
  console.log('toggleFlowRecording called');
  isRecordingFlow = !isRecordingFlow;
  console.log('isRecordingFlow:', isRecordingFlow);
  
  if (isRecordingFlow) {
    // Start recording
    recordFlowBtn.classList.remove('bg-green-100', 'text-green-700');
    recordFlowBtn.classList.add('bg-red-100', 'text-red-700');
    recordFlowBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
      Stop Recording
    `;
    
    // Clear any existing steps
    currentSteps = [];
    renderSteps();
    
    // Start recording navigation events
    chrome.runtime.sendMessage({ action: 'flowforge-start-recording' });
    
    // Show toast
    showToast('Recording started. Navigate through your flow, then click Stop Recording.');
  } else {
    // Stop recording
    recordFlowBtn.classList.remove('bg-red-100', 'text-red-700');
    recordFlowBtn.classList.add('bg-green-100', 'text-green-700');
    recordFlowBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
      Record Flow
    `;
    
    // Get recorded steps from background
    chrome.runtime.sendMessage({ action: 'flowforge-stop-recording' }, (response) => {
      if (response && response.steps && response.steps.length > 0) {
        currentSteps = response.steps;
        renderSteps();
        showToast(`Recorded ${currentSteps.length} steps`);
      } else {
        showToast('No steps were recorded');
      }
    });
  }
}

function createFlowItem(flow) {
  const li = document.createElement('li');
  li.className = 'flow-item';
  
  // Get favicon for the first step
  let faviconUrl = '';
  if (flow.steps && flow.steps.length > 0) {
    const firstStepUrl = new URL(flow.steps[0].url);
    faviconUrl = `https://www.google.com/s2/favicons?domain=${firstStepUrl.hostname}&sz=32`;
  }
  
  // Format dates
  const createdDate = new Date(flow.createdAt).toLocaleDateString();
  let lastRunText = 'Never run';
  if (flow.lastRun) {
    const lastRunDate = new Date(flow.lastRun);
    lastRunText = lastRunDate.toLocaleDateString();
  }
  
  li.innerHTML = `
    <div class="px-4 py-4 sm:px-6 hover:bg-gray-50">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <img class="h-8 w-8 rounded bg-gray-100" src="${faviconUrl}" alt="">
          </div>
          <div class="ml-4">
            <div class="text-sm font-medium text-indigo-600">${flow.name}</div>
            <div class="text-sm text-gray-500">${flow.description || 'No description'}</div>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <button class="run-flow-btn inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run
          </button>
          <div class="relative dropdown">
            <button class="p-1 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none" aria-label="Options">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            <div class="dropdown-menu hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
              <a href="#" class="edit-flow-btn block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit</a>
              <a href="#" class="export-flow-btn block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Export</a>
              <a href="#" class="delete-flow-btn block px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Delete</a>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-2 sm:flex sm:justify-between">
        <div class="sm:flex">
          <div class="flex items-center text-sm text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>${flow.steps.length} steps</span>
          </div>
          <div class="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Created: ${createdDate}</span>
          </div>
        </div>
        <div class="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Last run: ${lastRunText}</span>
        </div>
      </div>
    </div>
  `;
  
  // Add event listeners
  const runBtn = li.querySelector('.run-flow-btn');
  runBtn.addEventListener('click', () => runFlow(flow.id));
  
  const menuBtn = li.querySelector('.dropdown button');
  const menu = li.querySelector('.dropdown-menu');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    menu.classList.add('hidden');
  });
  
  const editBtn = li.querySelector('.edit-flow-btn');
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    menu.classList.add('hidden');
    editFlow(flow);
  });
  
  const exportBtn = li.querySelector('.export-flow-btn');
  exportBtn.addEventListener('click', (e) => {
    e.preventDefault();
    menu.classList.add('hidden');
    exportSingleFlow(flow);
  });
  
  const deleteBtn = li.querySelector('.delete-flow-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    menu.classList.add('hidden');
    // Show delete confirmation
    confirmModalTitle.textContent = 'Delete Flow';
    confirmModalMessage.textContent = `Are you sure you want to delete the flow "${flow.name}"?`;
    confirmModalConfirmBtn.setAttribute('data-action', 'delete-flow');
    confirmModalConfirmBtn.setAttribute('data-flow-id', flow.id);
    confirmModal.classList.remove('hidden');
  });
  
  return li;
}

function showAddStepModal() {
  // Reset form
  if(addStepForm) addStepForm.reset();
  editingStepIndex = -1;
  
  // Show modal
  if(addStepModal) addStepModal.classList.remove('hidden');
}

function hideAddStepModal() {
  if(addStepModal) addStepModal.classList.add('hidden');
}

function handleSearch() {
  const searchTerm = searchInput.value.toLowerCase();
  filteredFlows = flows.filter(flow => 
    flow.name.toLowerCase().includes(searchTerm) || 
    (flow.description && flow.description.toLowerCase().includes(searchTerm))
  );
  renderFlows();
}


// Hoist modal functions before setupEventListeners
function showCreateFlowModal() {
  if(createFlowModal) createFlowModal.classList.remove('hidden');
  if(document.getElementById('flow-name')) document.getElementById('flow-name').value = '';
  if(document.getElementById('flow-description')) document.getElementById('flow-description').value = '';
  currentSteps = [];
  renderSteps();
  isCreatingNewFlow = true;
  editingFlowId = null;
  const flowNameInput = document.getElementById('flow-name');
  if (flowNameInput) flowNameInput.focus();
}

function hideCreateFlowModal() {
  if(createFlowModal) createFlowModal.classList.add('hidden');
}

function handleSearch() {
  const searchTerm = searchInput.value.toLowerCase();
  filteredFlows = flows.filter(flow => 
    flow.name.toLowerCase().includes(searchTerm) || 
    (flow.description && flow.description.toLowerCase().includes(searchTerm))
  );
  renderFlows();
}

function runFlow(flowId) {
  chrome.runtime.sendMessage({
    action: 'flowforge-execute-flow',
    flowId
  }, (response) => {
    if (response && response.success) {
      showToast('Flow execution started');
    } else {
      showToast('Failed to run flow: ' + (response.error || 'Unknown error'));
    }
  });
}

function editFlow(flow) {
  // Open popup with edit mode
  chrome.runtime.sendMessage({
    action: 'flowforge-edit-flow',
    flowId: flow.id
  });
  window.close();
}

async function deleteFlow(flowId) {
  try {
    // Get current flows
    const data = await chrome.storage.local.get(['savedFlows']);
    const savedFlows = data.savedFlows || [];
    const updatedFlows = savedFlows.filter(flow => flow.id !== flowId);
    
    // Save updated flows
    await chrome.storage.local.set({ savedFlows: updatedFlows });
    
    // Update local state
    flows = updatedFlows;
    filteredFlows = flows.filter(flow => filteredFlows.some(f => f.id === flow.id));
    
    // Render updated list
    renderFlows();
    showToast('Flow deleted successfully');
  } catch (error) {
    console.error('Error deleting flow:', error);
    showToast('Failed to delete flow');
  }
}

async function handleExportData() {
  try {
    const data = await chrome.storage.local.get(['savedFlows', 'settings']);
    
    const exportData = {
      savedFlows: data.savedFlows || [],
      settings: data.settings || {},
      exportDate: Date.now()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `flowforge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showToast('Data exported successfully');
  } catch (error) {
    console.error('Error exporting data:', error);
    showToast('Failed to export data');
  }
}

function exportSingleFlow(flow) {
  const exportData = {
    flow: flow,
    exportDate: new Date().toISOString(),
    version: '1.0.0'
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `flowforge-flow-${flow.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
  
  showToast('Flow exported successfully');
}

async function handleImportData() {
  const file = importDataInput.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      // Validate data structure
      if (!data.savedFlows || !Array.isArray(data.savedFlows)) {
        throw new Error('Invalid data format');
      }
      
      // Import data
      await chrome.storage.local.set({
        savedFlows: data.savedFlows,
        settings: data.settings || {}
      });
      
      // Reload data
      await Promise.all([
        loadFlows(),
        loadSettings()
      ]);
      
      // Update UI
      renderFlows();
      renderSettings();
      
      showToast('Data imported successfully');
    } catch (error) {
      console.error('Error importing data:', error);
      showToast('Failed to import data: ' + error.message);
    }
    
    // Reset file input
    importDataInput.value = '';
  };
  
  reader.readAsText(file);
}

async function importSingleFlow(flow) {
  try {
    // Get current flows
    const data = await chrome.storage.local.get(['savedFlows']);
    const savedFlows = data.savedFlows || [];
    
    // Check if flow with same ID already exists
    const existingIndex = savedFlows.findIndex(f => f.id === flow.id);
    if (existingIndex >= 0) {
      // Generate new ID to avoid conflict
      flow.id = 'flow-' + Date.now();
    }
    
    // Add the new flow
    savedFlows.push(flow);
    
    // Save updated flows
    await chrome.storage.local.set({ savedFlows });
    
    // Update local state
    flows = savedFlows;
    filteredFlows = [...flows];
    
    // Render updated list
    renderFlows();
    showToast('Flow imported successfully');
  } catch (error) {
    console.error('Error importing flow:', error);
    showToast('Failed to import flow');
  }
}

// This function is no longer needed as handleImportData now handles all import functionality

async function clearAllData() {
  try {
    await chrome.storage.local.remove(['savedFlows', 'settings']);
    
    // Reset state
    flows = [];
    filteredFlows = [];
    await chrome.storage.local.set({ savedFlows: [] });
    settings = {
      encryptionEnabled: false,
      detectionSensitivity: 'medium',
      notificationsEnabled: true
    };
    
    // Update UI
    renderFlows();
    renderSettings();
    
    // Clear history in background script
    chrome.runtime.sendMessage({ action: 'flowforge-clear-history' });
    
    showToast('All data cleared successfully');
  } catch (error) {
    console.error('Error clearing data:', error);
    showToast('Failed to clear data');
  }
}

async function clearHistory() {
  try {
    // Send message to background script
    chrome.runtime.sendMessage({ action: 'flowforge-clear-history' }, (response) => {
      if (response && response.success) {
        showToast('Browsing history cleared successfully');
      } else {
        showToast('Failed to clear browsing history');
      }
    });
  } catch (error) {
    console.error('Error clearing history:', error);
    showToast('Failed to clear browsing history');
  }
}

function showConfirmModal(action) {
  confirmModalConfirmBtn.setAttribute('data-action', action);
  
  if (action === 'clear-all') {
    confirmModalTitle.textContent = 'Clear All Data';
    confirmModalMessage.textContent = 'This will delete all your saved flows and reset all settings. This action cannot be undone.';
  } else if (action === 'clear-history') {
    confirmModalTitle.textContent = 'Clear Browsing History';
    confirmModalMessage.textContent = 'This will clear your browsing history used for flow detection. Your saved flows will remain intact.';
  }
  
  confirmModal.classList.remove('hidden');
}

// Add null-safe element references
const autoSaveCheckbox = document.getElementById('auto-save');
const darkModeCheckbox = document.getElementById('dark-mode');
const syncCheckbox = document.getElementById('sync-devices');

if (settingsForm && autoSaveCheckbox && darkModeCheckbox && syncCheckbox) {
  settingsForm.addEventListener('submit', handleSettingsSave);
}

// Fix settings handler with null checks
function handleSettingsSave(e) {
  e.preventDefault();
  
  const formData = {
    autoSave: autoSaveCheckbox?.checked || false,
    syncAcrossDevices: syncCheckbox?.checked || false,
    detectionSensitivity: detectionSensitivity.value,
    notificationsEnabled: notificationsEnabled.checked,
    encryptionEnabled: encryptionEnabled.checked,
    darkModeEnabled: darkModeEnabled.checked,
    language: languageSelect.value
  };

  chrome.storage.sync.set({ settings: formData }, () => {
    showToast('Settings saved successfully');
    applyI18nMessages(); // Apply i18n messages after saving settings
    chrome.runtime.sendMessage({ 
      action: 'update-settings',
      settings: formData 
    });
  });
}
if (flowList) {
  loadFlows();
}

function hideConfirmModal() {
  confirmModal.classList.add('hidden');
}

function handleConfirmAction() {
  const action = confirmModalConfirmBtn.getAttribute('data-action');
  
  if (action === 'clear-all') {
    chrome.storage.local.clear().then(() => {
      // Reset state
      flows = [];
      filteredFlows = [];
      settings = {
        encryptionEnabled: false,
        detectionSensitivity: 'medium',
        notificationsEnabled: true
      };
      
      // Update UI
      renderFlows();
      renderSettings();
      
      hideConfirmModal();
      showToast('All data cleared successfully');
    });
  } else if (action === 'clear-history') {
    chrome.runtime.sendMessage({ action: 'flowforge-clear-history' }, (response) => {
      hideConfirmModal();
      showToast('Browsing history cleared successfully');
    });
  } else if (action === 'delete-flow') {
    const flowId = confirmModalConfirmBtn.getAttribute('data-flow-id');
    if (flowId) {
      deleteFlow(flowId);
      hideConfirmModal();
    }
  }
}

// Show a toast notification
function showToast(message, duration = 3000) {
  toastMessage.textContent = message;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, duration);
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
// Fixed renderFlows implementation
function renderFlows() {
  flowList.innerHTML = '';
  
  // Add bulk action controls
  flowList.innerHTML += `
    <div class="bulk-actions mb-4">
      <button 
        id="delete-selected-flows"
        class="bg-red-100 text-red-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-red-200 disabled:opacity-50"
        disabled
      >
        Delete Selected
      </button>
      <label class="ml-3 text-sm text-gray-700">
        <input type="checkbox" id="select-all-flows" class="mr-2">
        Select All
      </label>
    </div>
  `;

  filteredFlows.forEach(flow => {
    const flowElement = document.createElement('div');
    flowElement.className = 'flow-item bg-white p-4 rounded-lg shadow-sm mb-3';
    flowElement.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <input 
            type="checkbox" 
            class="flow-checkbox"
            value="${flow.id}"
            data-testid="checkbox-${flow.id}"
          >
          <div>
            <h3 class="font-medium">${flow.name}</h3>
            ${flow.description ? `<p class="text-sm text-gray-500">${flow.description}</p>` : ''}
          </div>
        </div>
        <div class="flex space-x-2">
          <button 
            class="edit-flow p-1 text-gray-500 hover:text-indigo-600"
            data-flow-id="${flow.id}"
            aria-label="Edit flow"
          >
            <svg class="w-5 h-5"><use xlink:href="#pencil-icon"></svg>
          </button>
          <button 
            class="delete-flow p-1 text-gray-500 hover:text-red-600"
            data-flow-id="${flow.id}"
            aria-label="Delete flow"
          >
            <svg class="w-5 h-5"><use xlink:href="#trash-icon"></svg>
          </button>
        </div>
      </div>
    `;
    
    // Add event listeners
    flowElement.querySelector('.edit-flow').addEventListener('click', () => editFlow(flow.id));
    flowElement.querySelector('.delete-flow').addEventListener('click', () => confirmDeleteFlow(flow.id));
    flowElement.querySelector('.flow-checkbox').addEventListener('change', updateBulkActions);
    
    flowList.appendChild(flowElement);
  });

  // Bulk action handlers
  document.getElementById('select-all-flows').addEventListener('change', toggleSelectAll);
  document.getElementById('delete-selected-flows').addEventListener('click', handleBulkDelete);
}

function updateBulkActions() {
  const checkboxes = [...document.querySelectorAll('.flow-checkbox:checked')];
  const deleteBtn = document.getElementById('delete-selected-flows');
  deleteBtn.disabled = checkboxes.length === 0;
}

function toggleSelectAll(e) {
  const checkboxes = document.querySelectorAll('.flow-checkbox');
  checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
  updateBulkActions();
}

async function handleBulkDelete() {
  const flowIds = [...document.querySelectorAll('.flow-checkbox:checked')]
    .map(checkbox => checkbox.value);

  if (flowIds.length > 0) {
    chrome.runtime.sendMessage({
      action: 'flowforge-delete-flows',
      flowIds
    }, () => {
      showToast(`Deleted ${flowIds.length} flows`);
      loadFlows();
    });
  }
}

