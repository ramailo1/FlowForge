/**
 * Unit tests for FlowForge flow detection logic
 */

// Mock chrome API
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  }
};

global.chrome = mockChrome;

// Import the flow detection module
const FlowDetector = require('../lib/flow-detector');

describe('FlowDetector', () => {
  let flowDetector;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize with default settings
    flowDetector = new FlowDetector({
      minRepetitionsToSuggest: 3,
      maxFlowLength: 10,
      maxTimeGapBetweenSteps: 5 * 60 * 1000 // 5 minutes
    });
    
    // Mock storage data
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ 
        navigationHistory: [],
        detectedFlows: [],
        savedFlows: []
      });
    });
  });
  
  describe('addNavigationEvent', () => {
    test('should add a navigation event to history', async () => {
      const event = {
        url: 'https://example.com',
        title: 'Example',
        timestamp: Date.now()
      };
      
      await flowDetector.addNavigationEvent(event);
      
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          navigationHistory: expect.arrayContaining([event])
        }),
        expect.any(Function)
      );
    });
    
    test('should trim history if it exceeds the limit', async () => {
      // Create history with 101 items (exceeding the 100 limit)
      const history = Array(101).fill().map((_, i) => ({
        url: `https://example.com/${i}`,
        title: `Example ${i}`,
        timestamp: Date.now() - (101 - i) * 1000
      }));
      
      // Mock storage to return this history
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ navigationHistory: history, detectedFlows: [], savedFlows: [] });
      });
      
      const newEvent = {
        url: 'https://example.com/new',
        title: 'New Example',
        timestamp: Date.now()
      };
      
      await flowDetector.addNavigationEvent(newEvent);
      
      // Verify the oldest item was removed
      const setCall = mockChrome.storage.local.set.mock.calls[0][0];
      expect(setCall.navigationHistory.length).toBe(100);
      expect(setCall.navigationHistory[0].url).not.toBe('https://example.com/0');
      expect(setCall.navigationHistory[99]).toEqual(newEvent);
    });
  });
  
  describe('detectFlows', () => {
    test('should detect a repeated flow of 3 steps', async () => {
      // Create a history with a repeated pattern
      const repeatedFlow = [
        { url: 'https://google.com', title: 'Google', timestamp: 1000 },
        { url: 'https://wikipedia.org', title: 'Wikipedia', timestamp: 2000 },
        { url: 'https://trello.com', title: 'Trello', timestamp: 3000 }
      ];
      
      const history = [
        ...repeatedFlow,
        ...repeatedFlow.map(e => ({ ...e, timestamp: e.timestamp + 10000 })),
        ...repeatedFlow.map(e => ({ ...e, timestamp: e.timestamp + 20000 }))
      ];
      
      // Mock storage to return this history
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ navigationHistory: history, detectedFlows: [], savedFlows: [] });
      });
      
      await flowDetector.detectFlows();
      
      // Verify a flow was detected
      const setCall = mockChrome.storage.local.set.mock.calls[0][0];
      expect(setCall.detectedFlows.length).toBe(1);
      expect(setCall.detectedFlows[0].steps.length).toBe(3);
      expect(setCall.detectedFlows[0].occurrences).toBe(3);
      expect(setCall.detectedFlows[0].steps[0].url).toBe('https://google.com');
    });
    
    test('should not detect flows with less than 3 repetitions', async () => {
      // Create a history with a pattern that only repeats twice
      const repeatedFlow = [
        { url: 'https://google.com', title: 'Google', timestamp: 1000 },
        { url: 'https://wikipedia.org', title: 'Wikipedia', timestamp: 2000 }
      ];
      
      const history = [
        ...repeatedFlow,
        ...repeatedFlow.map(e => ({ ...e, timestamp: e.timestamp + 10000 }))
      ];
      
      // Mock storage to return this history
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ navigationHistory: history, detectedFlows: [], savedFlows: [] });
      });
      
      await flowDetector.detectFlows();
      
      // Verify no flow was detected
      const setCall = mockChrome.storage.local.set.mock.calls[0][0];
      expect(setCall.detectedFlows.length).toBe(0);
    });
    
    test('should not detect flows with time gaps exceeding the threshold', async () => {
      // Create a history with a repeated pattern but with large time gaps
      const repeatedFlow = [
        { url: 'https://google.com', title: 'Google', timestamp: 1000 },
        { url: 'https://wikipedia.org', title: 'Wikipedia', timestamp: 2000 },
        { url: 'https://trello.com', title: 'Trello', timestamp: 3000 }
      ];
      
      // Second occurrence has a large time gap between steps
      const secondOccurrence = [
        { url: 'https://google.com', title: 'Google', timestamp: 10000 },
        { url: 'https://wikipedia.org', title: 'Wikipedia', timestamp: 20000 + (6 * 60 * 1000) }, // 6 minutes gap
        { url: 'https://trello.com', title: 'Trello', timestamp: 30000 + (6 * 60 * 1000) }
      ];
      
      const thirdOccurrence = repeatedFlow.map(e => ({ ...e, timestamp: e.timestamp + 40000 }));
      
      const history = [...repeatedFlow, ...secondOccurrence, ...thirdOccurrence];
      
      // Mock storage to return this history
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ navigationHistory: history, detectedFlows: [], savedFlows: [] });
      });
      
      await flowDetector.detectFlows();
      
      // Verify no flow was detected due to time gap
      const setCall = mockChrome.storage.local.set.mock.calls[0][0];
      expect(setCall.detectedFlows.length).toBe(0);
    });
  });
  
  describe('saveFlow', () => {
    test('should save a flow with custom name and trigger', async () => {
      const flow = {
        id: 'flow-123',
        steps: [
          { url: 'https://google.com', title: 'Google' },
          { url: 'https://wikipedia.org', title: 'Wikipedia' },
          { url: 'https://trello.com', title: 'Trello' }
        ],
        occurrences: 3,
        lastDetected: Date.now()
      };
      
      const customFlow = {
        ...flow,
        name: 'Research Flow',
        trigger: {
          type: 'manual',
          conditions: {}
        }
      };
      
      // Mock storage
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 
          navigationHistory: [],
          detectedFlows: [flow],
          savedFlows: []
        });
      });
      
      await flowDetector.saveFlow(flow.id, 'Research Flow', { type: 'manual', conditions: {} });
      
      // Verify flow was saved
      const setCall = mockChrome.storage.local.set.mock.calls[0][0];
      expect(setCall.savedFlows.length).toBe(1);
      expect(setCall.savedFlows[0].name).toBe('Research Flow');
      expect(setCall.savedFlows[0].trigger.type).toBe('manual');
      
      // Verify detected flow was removed
      expect(setCall.detectedFlows.length).toBe(0);
    });
  });
  
  describe('executeFlow', () => {
    test('should send messages to execute each step of a flow', async () => {
      const flow = {
        id: 'flow-123',
        name: 'Research Flow',
        steps: [
          { url: 'https://google.com', title: 'Google' },
          { url: 'https://wikipedia.org', title: 'Wikipedia' },
          { url: 'https://trello.com', title: 'Trello' }
        ],
        trigger: {
          type: 'manual',
          conditions: {}
        }
      };
      
      await flowDetector.executeFlow(flow);
      
      // Verify messages were sent for each step
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(3);
      
      // Verify first message
      expect(mockChrome.runtime.sendMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          action: 'executeFlowStep',
          step: flow.steps[0],
          flowId: flow.id,
          stepIndex: 0,
          totalSteps: 3
        })
      );
    });
  });
});