// FlowForge Content Script
// Handles UI elements and page interaction

// State management
let isTrackingActive = false;
let trackingBadge = null;
let suggestionCard = null;

// Initialize when the content script loads
init();

function init() {
  console.log('FlowForge content script initialized');
  
  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'flowforge-tracking') {
      handleTrackingUpdate(message.flowLength);
      sendResponse({ success: true });
    }
    
    if (message.action === 'flowforge-suggest-automation') {
      showAutomationSuggestion(message.flowData);
      sendResponse({ success: true });
    }
    
    return true; // Required for async response
  });
}

// Handle tracking status updates
function handleTrackingUpdate(flowLength) {
  if (flowLength > 0) {
    showTrackingBadge(flowLength);
  } else {
    hideTrackingBadge();
  }
}

// Show the tracking badge
function showTrackingBadge(stepCount) {
  if (!trackingBadge) {
    trackingBadge = document.createElement('div');
    trackingBadge.className = 'flowforge-tracking-badge';
    document.body.appendChild(trackingBadge);
  }
  
  trackingBadge.innerHTML = `
    <div class="flowforge-badge-content">
      <div class="flowforge-badge-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      </div>
      <div class="flowforge-badge-text">
        <span>Learning...</span>
        <span class="flowforge-step-count">${stepCount} steps</span>
      </div>
    </div>
  `;
  
  // Make sure the badge is visible
  trackingBadge.style.display = 'block';
}

// Hide the tracking badge
function hideTrackingBadge() {
  if (trackingBadge) {
    trackingBadge.style.display = 'none';
  }
}

// Show automation suggestion card
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'flowforge-suggest-automation') {
    showAutomationSuggestion(message.flowData);
    sendResponse({ success: true });
  }
  return true;
});

function showAutomationSuggestion(flowData) {
  // Remove any existing suggestion card
  if (suggestionCard) {
    suggestionCard.remove();
    suggestionCard = null;
  }

  // Create a new suggestion card
  suggestionCard = document.createElement('div');
  suggestionCard.className = 'flowforge-suggestion-card';
  suggestionCard.innerHTML = `
    <div class="flowforge-suggestion-header">
      <div class="flowforge-suggestion-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <div class="flowforge-suggestion-title">Flow Detected</div>
      <button class="flowforge-suggestion-close" aria-label="Close">&times;</button>
    </div>
    <div class="flowforge-suggestion-content">
      <p>We noticed you've repeated this sequence multiple times:</p>
      <div class="flowforge-flow-preview">
        ${generateFlowPreview(flowData)}
      </div>
      <div class="flowforge-suggestion-form">
        <div class="flowforge-form-group">
          <label for="flowforge-flow-name">Name this flow:</label>
          <input type="text" id="flowforge-flow-name" value="${flowData.name}" placeholder="My Flow">
        </div>
        <div class="flowforge-form-group">
          <label for="flowforge-flow-description">Description (optional):</label>
          <input type="text" id="flowforge-flow-description" placeholder="What does this flow do?">
        </div>
      </div>
    </div>
    <div class="flowforge-suggestion-actions">
      <button class="flowforge-btn flowforge-btn-secondary">Dismiss</button>
      <button class="flowforge-btn flowforge-btn-primary">Create Shortcut</button>
    </div>
  `;

  // Add to the page
  document.body.appendChild(suggestionCard);

  // Set up event listeners
  const closeBtn = suggestionCard.querySelector('.flowforge-suggestion-close');
  const dismissBtn = suggestionCard.querySelector('.flowforge-btn-secondary');
  const createBtn = suggestionCard.querySelector('.flowforge-btn-primary');

  closeBtn.addEventListener('click', () => {
    suggestionCard.remove();
    suggestionCard = null;
  });

  dismissBtn.addEventListener('click', () => {
    suggestionCard.remove();
    suggestionCard = null;
  });

  createBtn.addEventListener('click', () => {
    const nameInput = suggestionCard.querySelector('#flowforge-flow-name');
    const descriptionInput = suggestionCard.querySelector('#flowforge-flow-description');

    const flowToSave = {
      ...flowData,
      name: nameInput.value || flowData.name,
      description: descriptionInput.value || ''
    };

    // Send to background script to save
    chrome.runtime.sendMessage({
      action: 'flowforge-save-flow',
      flowData: flowToSave
    }, (response) => {
      if (response && response.success) {
        // Show success message
        showNotification('Flow saved successfully!', 'success');
      } else {
        // Show error message
        showNotification('Failed to save flow.', 'error');
      }

      // Remove the suggestion card
      suggestionCard.remove();
      suggestionCard = null;
    });
  });
}

// Generate HTML preview of a flow
function generateFlowPreview(flowData) {
  let html = '<div class="flowforge-flow-steps">';
  
  flowData.steps.forEach((step, index) => {
    const url = new URL(step.url);
    const favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
    
    html += `
      <div class="flowforge-flow-step">
        <div class="flowforge-step-number">${index + 1}</div>
        <div class="flowforge-step-icon">
          <img src="${favicon}" alt="${url.hostname}" width="16" height="16">
        </div>
        <div class="flowforge-step-info">
          <div class="flowforge-step-title">${step.title || url.hostname}</div>
          <div class="flowforge-step-url">${url.hostname}</div>
        </div>
      </div>
    `;
    
    // Add arrow between steps (except for the last step)
    if (index < flowData.steps.length - 1) {
      html += `
        <div class="flowforge-step-arrow">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </div>
      `;
    }
  });
  
  html += '</div>';
  return html;
}

// Show a notification message
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `flowforge-notification flowforge-notification-${type}`;
  notification.innerHTML = `
    <div class="flowforge-notification-content">
      <div class="flowforge-notification-message">${message}</div>
    </div>
  `;
  
  // Add to the page
  document.body.appendChild(notification);
  
  // Remove after a delay
  setTimeout(() => {
    notification.classList.add('flowforge-notification-hiding');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}