const { runAgentLoop, AGENT_TOOLS } = require('./agentService');
const axios = require('axios');

jest.mock('axios');

describe('agentService module', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('module exports', () => {
    it('should export agentService module', () => {
      const agentService = require('./agentService');
      expect(agentService).toBeDefined();
    });

    it('should export runAgentLoop function', () => {
      expect(typeof runAgentLoop).toBe('function');
    });

    it('should export AGENT_TOOLS array', () => {
      expect(Array.isArray(AGENT_TOOLS)).toBe(true);
      expect(AGENT_TOOLS.length).toBeGreaterThan(0);
    });

    it('each tool should have type function and a valid function definition', () => {
      AGENT_TOOLS.forEach(tool => {
        expect(tool).toHaveProperty('type', 'function');
        expect(tool).toHaveProperty('function');
        expect(tool.function).toHaveProperty('name');
        expect(tool.function).toHaveProperty('description');
        expect(typeof tool.function.name).toBe('string');
        expect(typeof tool.function.description).toBe('string');
      });
    });
  });

  describe('runAgentLoop', () => {
    it('should send answer and stop if no tool calls', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: 'Hello, here is your answer',
              tool_calls: null
            }
          }]
        }
      });

      const res = {
        write: jest.fn(),
        end: jest.fn()
      };

      await runAgentLoop('Hello', res, 'http://localhost');

      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('answer'));
      expect(res.end).toHaveBeenCalled();
    });

    it('should execute get_footprint tool and feedback', async () => {
      // First Groq response: call get_footprint
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: '',
              tool_calls: [{
                id: 'call_1',
                function: {
                  name: 'get_footprint',
                  arguments: '{"days": 7}'
                }
              }]
            }
          }]
        }
      });

      // Backend API mock
      axios.create = jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: { totalCO2e: 100 } }),
        post: jest.fn()
      }));

      // Second Groq response: final answer
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: 'Your footprint is 100.',
              tool_calls: null
            }
          }]
        }
      });

      const res = {
        write: jest.fn(),
        end: jest.fn()
      };

      await runAgentLoop('What is my footprint?', res, 'http://localhost');

      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('thinking'));
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('tool_result'));
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('Your footprint is 100.'));
      expect(res.end).toHaveBeenCalled();
    });

    it('should execute get_transport_options tool', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: '',
              tool_calls: [{
                id: 'call_2',
                function: {
                  name: 'get_transport_options',
                  arguments: '{"origin": "A", "destination": "B"}'
                }
              }]
            }
          }]
        }
      });

      axios.create = jest.fn(() => ({
        post: jest.fn().mockResolvedValue({ data: { distanceKm: 50, allModes: [] } })
      }));

      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: 'Transport options calculated.',
              tool_calls: null
            }
          }]
        }
      });

      const res = { write: jest.fn(), end: jest.fn() };
      await runAgentLoop('How to get from A to B?', res, 'http://localhost');
      expect(res.end).toHaveBeenCalled();
    });

    it('should execute log_activity tool', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: '',
              tool_calls: [{
                id: 'call_3',
                function: {
                  name: 'log_activity',
                  arguments: '{"category": "transport", "subtype": "bus", "quantity": 10}'
                }
              }]
            }
          }]
        }
      });

      axios.create = jest.fn(() => ({
        post: jest.fn().mockResolvedValue({ data: { co2e: 1.5 } })
      }));

      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: 'Logged successfully.',
              tool_calls: null
            }
          }]
        }
      });

      const res = { write: jest.fn(), end: jest.fn() };
      await runAgentLoop('Log 10km bus', res, 'http://localhost');
      expect(res.end).toHaveBeenCalled();
    });

    it('should execute set_goal tool', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: '',
              tool_calls: [{
                id: 'call_4',
                function: {
                  name: 'set_goal',
                  arguments: '{"dailyGoalKg": 5.5}'
                }
              }]
            }
          }]
        }
      });

      axios.create = jest.fn(() => ({
        post: jest.fn().mockResolvedValue({ data: { success: true } })
      }));

      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: 'Goal updated.',
              tool_calls: null
            }
          }]
        }
      });

      const res = { write: jest.fn(), end: jest.fn() };
      await runAgentLoop('Set my goal to 5.5', res, 'http://localhost');
      expect(res.end).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      axios.post.mockRejectedValueOnce(new Error('Network error'));
      
      const res = { write: jest.fn(), end: jest.fn() };
      await runAgentLoop('Fail me', res, 'http://localhost');
      
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('error'));
      expect(res.end).toHaveBeenCalled();
    });
  });
});