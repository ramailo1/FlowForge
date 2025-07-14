/**
 * FlowDetector - Core module for detecting and managing navigation flows
 * 
 * This module is responsible for:
 * 1. Tracking user navigation patterns
 * 2. Detecting repeated sequences (flows)
 * 3. Managing saved flows
 * 4. Executing flows
 */

class FlowDetector {
  constructor(options = {}) {
    // Default configuration
    this.config = {
      minRepetitionsToSuggest: options.minRepetitionsToSuggest || 3,
      maxFlowLength: options.maxFlowLength || 10,
      maxTimeGapBetweenSteps: options.maxTimeGapBetweenSteps || 5 * 60 * 1000, // 5 minutes
      maxHistorySize: options.maxHistorySize || 100,
      minStepsInFlow: options.minStepsInFlow || 2
    };

    // Initialize listeners
    this.initListeners();
  }

  /**
   * Initialize message listeners
   */
  initListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'addNavigationEvent') {
        this.addNavigationEvent(message.event).then(() => sendResponse({ success: true }));
        return true; // Keep the message channel open for async response
      } else if (message.action === 'detectFlows') {
        this.detectFlows().then(() => sendResponse({ success: true }));
        return true;
      } else if (message.action === 'saveFlow') {
        this.saveFlow(message.flowId, message.name, message.trigger)
          .then(() => sendResponse({ success: true }));
        return true;
      } else if (message.action === 'executeFlow') {
        this.executeFlow(message.flow).then(() => sendResponse({ success: true }));
        return true;
      } else if (message.action === 'deleteFlow') {
        this.deleteFlow(message.flowId, message.type).then(() => sendResponse({ success: true }));
        return true;
      }
    });
  }

  /**
   * Add a navigation event to history
   * @param {Object} event - Navigation event with url, title, and timestamp
   */
  async addNavigationEvent(event) {
    try {
      // Get current navigation history
      const data = await this.getStorageData(['navigationHistory']);
      let history = data.navigationHistory || [];

      // Add new event
      history.push(event);

      // Trim history if it exceeds the maximum size
      if (history.length > this.config.maxHistorySize) {
        history = history.slice(history.length - this.config.maxHistorySize);
      }

      // Save updated history
      await this.setStorageData({ navigationHistory: history });

      // Detect flows after adding a new event
      await this.detectFlows();

      return true;
    } catch (error) {
      console.error('Error adding navigation event:', error);
      return false;
    }
  }

  /**
   * Detect repeated navigation flows
   */
  async detectFlows() {
    try {
      // Get navigation history and existing detected flows
      const data = await this.getStorageData(['navigationHistory', 'detectedFlows']);
      const history = data.navigationHistory || [];
      let detectedFlows = data.detectedFlows || [];

      // Skip if history is too short
      if (history.length < this.config.minStepsInFlow * this.config.minRepetitionsToSuggest) {
        return false;
      }

      // Find potential flows of different lengths
      for (let flowLength = this.config.minStepsInFlow; flowLength <= this.config.maxFlowLength; flowLength++) {
        const potentialFlows = this.findPotentialFlows(history, flowLength);

        // Add new detected flows
        for (const flow of potentialFlows) {
          // Check if this flow already exists
          const existingFlowIndex = detectedFlows.findIndex(f => 
            this.areFlowsEqual(f.steps, flow.steps));

          if (existingFlowIndex >= 0) {
            // Update existing flow
            detectedFlows[existingFlowIndex].occurrences = flow.occurrences;
            detectedFlows[existingFlowIndex].lastDetected = Date.now();
          } else {
            // Add new flow
            detectedFlows.push({
              id: 'flow-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
              steps: flow.steps,
              occurrences: flow.occurrences,
              lastDetected: Date.now()
            });
          }
        }
      }

      // Save updated detected flows
      await this.setStorageData({ detectedFlows });

      return true;
    } catch (error) {
      console.error('Error detecting flows:', error);
      return false;
    }
  }

  /**
   * Find potential flows of a specific length in navigation history
   * @param {Array} history - Navigation history
   * @param {Number} flowLength - Length of flows to detect
   * @returns {Array} - Potential flows
   */
  findPotentialFlows(history, flowLength) {
    const potentialFlows = [];
    const flowOccurrences = {};

    // Iterate through history to find sequences of the specified length
    for (let i = 0; i <= history.length - flowLength; i++) {
      // Extract the sequence
      const sequence = history.slice(i, i + flowLength);
      
      // Check if the sequence has valid time gaps
      if (!this.hasValidTimeGaps(sequence)) {
        continue;
      }

      // Create a key for this sequence
      const sequenceKey = sequence.map(step => step.url).join('|');

      // Count occurrences
      if (!flowOccurrences[sequenceKey]) {
        flowOccurrences[sequenceKey] = {
          steps: sequence.map(step => ({ url: step.url, title: step.title })),
          occurrences: 1,
          positions: [i]
        };
      } else {
        // Only count as a new occurrence if it doesn't overlap with previous occurrences
        const lastPosition = flowOccurrences[sequenceKey].positions[flowOccurrences[sequenceKey].positions.length - 1];
        if (i >= lastPosition + flowLength) {
          flowOccurrences[sequenceKey].occurrences++;
          flowOccurrences[sequenceKey].positions.push(i);
        }
      }
    }

    // Filter flows that have enough repetitions
    for (const key in flowOccurrences) {
      if (flowOccurrences[key].occurrences >= this.config.minRepetitionsToSuggest) {
        potentialFlows.push({
          steps: flowOccurrences[key].steps,
          occurrences: flowOccurrences[key].occurrences
        });
      }
    }

    return potentialFlows;
  }

  /**
   * Check if a sequence has valid time gaps between steps
   * @param {Array} sequence - Sequence of navigation events
   * @returns {Boolean} - Whether the sequence has valid time gaps
   */
  hasValidTimeGaps(sequence) {
    for (let i = 1; i < sequence.length; i++) {
      const timeGap = sequence[i].timestamp - sequence[i - 1].timestamp;
      if (timeGap > this.config.maxTimeGapBetweenSteps) {
        return false;
      }
    }
    return true;
  }

  /**
   * Compare two flows to check if they are equal
   * @param {Array} flow1 - First flow
   * @param {Array} flow2 - Second flow
   * @returns {Boolean} - Whether the flows are equal
   */
  areFlowsEqual(flow1, flow2) {
    if (flow1.length !== flow2.length) {
      return false;
    }

    for (let i = 0; i < flow1.length; i++) {
      if (flow1[i].url !== flow2[i].url) {
        return false;
      }
    }

    return true;
  }

  /**
   * Save a detected flow as a user flow
   * @param {String} flowId - ID of the detected flow
   * @param {String} name - Custom name for the flow
   * @param {Object} trigger - Trigger configuration
   */
  async saveFlow(flowId, name, trigger) {
    try {
      // Get detected flows and saved flows
      const data = await this.getStorageData(['detectedFlows', 'savedFlows']);
      const detectedFlows = data.detectedFlows || [];
      const savedFlows = data.savedFlows || [];

      // Find the detected flow
      const flowIndex = detectedFlows.findIndex(flow => flow.id === flowId);
      if (flowIndex === -1) {
        throw new Error('Flow not found');
      }

      const flow = detectedFlows[flowIndex];

      // Create a saved flow
      const savedFlow = {
        id: flow.id,
        name: name || `Flow ${savedFlows.length + 1}`,
        steps: flow.steps,
        createdAt: Date.now(),
        trigger: trigger || { type: 'manual', conditions: {} }
      };

      // Add to saved flows
      savedFlows.push(savedFlow);

      // Remove from detected flows
      detectedFlows.splice(flowIndex, 1);

      // Save updated flows
      await this.setStorageData({
        detectedFlows,
        savedFlows
      });

      return true;
    } catch (error) {
      console.error('Error saving flow:', error);
      return false;
    }
  }

  /**
   * Execute a saved flow
   * @param {Object} flow - Flow to execute
   */
  async executeFlow(flow) {
    try {
      // Execute each step in sequence
      for (let i = 0; i < flow.steps.length; i++) {
        const step = flow.steps[i];
        
        // Send message to execute this step
        await this.sendMessage({
          action: 'executeFlowStep',
          step,
          flowId: flow.id,
          stepIndex: i,
          totalSteps: flow.steps.length
        });

        // Wait for step to complete (could be improved with actual completion detection)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return true;
    } catch (error) {
      console.error('Error executing flow:', error);
      return false;
    }
  }

  /**
   * Delete a flow (either detected or saved)
   * @param {String} flowId - ID of the flow to delete
   * @param {String} type - Type of flow ('detected' or 'saved')
   */
  async deleteFlow(flowId, type) {
    try {
      // Get flows
      const storageKey = type === 'detected' ? 'detectedFlows' : 'savedFlows';
      const data = await this.getStorageData([storageKey]);
      const flows = data[storageKey] || [];

      // Find and remove the flow
      const flowIndex = flows.findIndex(flow => flow.id === flowId);
      if (flowIndex === -1) {
        throw new Error('Flow not found');
      }

      flows.splice(flowIndex, 1);

      // Save updated flows
      const updateData = {};
      updateData[storageKey] = flows;
      await this.setStorageData(updateData);

      return true;
    } catch (error) {
      console.error('Error deleting flow:', error);
      return false;
    }
  }

  /**
   * Helper function to get data from storage
   * @param {Array} keys - Keys to get from storage
   * @returns {Promise} - Promise resolving to storage data
   */
  getStorageData(keys) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(keys, (result) => {
        resolve(result);
      });
    });
  }

  /**
   * Helper function to set data in storage
   * @param {Object} data - Data to set in storage
   * @returns {Promise} - Promise resolving when data is set
   */
  setStorageData(data) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(data, () => {
        resolve();
      });
    });
  }

  /**
   * Helper function to send a message
   * @param {Object} message - Message to send
   * @returns {Promise} - Promise resolving to response
   */
  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response);
      });
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FlowDetector;
}