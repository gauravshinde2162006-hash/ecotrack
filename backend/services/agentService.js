/**
 * Agentic AI Service — Multi-step autonomous agent with tool calling
 *
 * The agent has access to 5 tools that call your own backend:
 *   1. get_footprint(days)       — dashboard stats
 *   2. get_transport_options(from, to) — distance + CO2 comparison
 *   3. log_activity(category, subtype, quantity) — submit a log entry
 *   4. set_goal(kg)              — update daily goal
 *   5. get_category_breakdown(days) — pie chart data
 *
 * Agent loop:
 *   1. Send user message + tools definition to Groq
 *   2. If model returns tool_calls → execute each tool → feed result back
 *   3. Repeat until model returns a plain text answer (no more tool calls)
 *   4. Stream each step as a Server-Sent Event so UI shows "thinking"
 */

const axios = require('axios');

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// ── Tool definitions (OpenAI function-calling format, supported by Groq) ──────
const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_footprint',
      description: 'Get the user\'s carbon footprint statistics for the last N days. Returns total CO2e, daily average, streak, goal, and top emission category.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'Number of past days to analyse (7, 14, or 30)', default: 7 },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_category_breakdown',
      description: 'Get a breakdown of carbon emissions by category (transport, diet, electricity, lpg, waste) for the last N days.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'Number of days to look back', default: 7 },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_transport_options',
      description: 'Calculate the distance and CO2 emissions for a journey between two places across all transport modes (car, bus, train, bike, walk, flight).',
      parameters: {
        type: 'object',
        properties: {
          origin:      { type: 'string', description: 'Starting location, e.g. "Mumbai, Maharashtra"' },
          destination: { type: 'string', description: 'Destination location, e.g. "Pune, Maharashtra"' },
        },
        required: ['origin', 'destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_activity',
      description: 'Log a carbon-emitting activity on behalf of the user. Use this when the user asks to log something or when confirming an action.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['transport', 'diet', 'electricity', 'lpg', 'waste'], description: 'Emission category' },
          subtype:  { type: 'string', description: 'Specific subtype e.g. car_petrol, vegetarian, india_grid, cylinder, landfill' },
          quantity: { type: 'number', description: 'Amount in the category\'s natural unit (km for transport, kWh for electricity, days for diet, fraction for lpg)' },
        },
        required: ['category', 'subtype', 'quantity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_goal',
      description: 'Update the user\'s daily carbon footprint goal in kg CO2e.',
      parameters: {
        type: 'object',
        properties: {
          dailyGoalKg: { type: 'number', description: 'New daily goal in kg CO2e (e.g. 4.5)' },
        },
        required: ['dailyGoalKg'],
      },
    },
  },
];

// ── Tool executor — maps tool names to real backend API calls ─────────────────
async function executeTool(toolName, args, baseUrl) {
  const api = axios.create({ baseURL: `${baseUrl}/api`, timeout: 10000 });

  switch (toolName) {
    case 'get_footprint': {
      const res = await api.get('/dashboard');
      const d = res.data;
      return {
        totalCO2e: d.totalCO2e,
        last7Days: d.last7DaysCO2e,
        dailyAverage: d.rollingAverage,
        todayCO2e: d.todayCO2e,
        streak: d.currentStreak,
        goal: d.dailyGoal,
        goalProgress: d.goalProgress,
        topCategory: d.topEmissionCategory,
        treeEquivalent: d.treeEquivalent,
      };
    }

    case 'get_category_breakdown': {
      const days = args.days || 7;
      const res = await api.get(`/dashboard/pie?days=${days}`);
      return {
        breakdown: res.data.breakdown,
        total: res.data.total,
        period: `Last ${days} days`,
      };
    }

    case 'get_transport_options': {
      const res = await api.post('/transport/distance', {
        origin: args.origin,
        destination: args.destination,
        mode: 'car_petrol',
      });
      return {
        distanceKm: res.data.distanceKm,
        allModes: res.data.allModes,
        fromTo: `${args.origin} → ${args.destination}`,
      };
    }

    case 'log_activity': {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.post('/logs', {
        date: today,
        category: args.category,
        subtype: args.subtype,
        quantity: args.quantity,
      });
      return {
        success: true,
        co2e: res.data.co2e,
        message: `Logged ${args.quantity} ${args.category} (${args.subtype}) → ${res.data.co2e?.toFixed(3)} kg CO2e`,
      };
    }

    case 'set_goal': {
      const res = await api.post('/goals', { dailyGoal: args.dailyGoalKg });
      return { success: true, newGoal: args.dailyGoalKg, message: `Daily goal updated to ${args.dailyGoalKg} kg CO2e` };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Run the agentic loop and stream steps via Server-Sent Events.
 * Each SSE event is a JSON line with { type, content } where type is:
 *   'thinking' — agent decided to call a tool
 *   'tool_result' — tool executed, returning data
 *   'answer' — final text answer from agent
 *   'error' — something went wrong
 *
 * @param {string} userMessage
 * @param {object} res  Express response (SSE stream)
 * @param {string} baseUrl  e.g. 'http://localhost:3001'
 */
async function runAgentLoop(userMessage, res, baseUrl = `http://localhost:${process.env.PORT || 3001}`) {
  // SSE helpers
  const send = (type, content) => {
    res.write(`data: ${JSON.stringify({ type, content })}\n\n`);
  };

  const systemPrompt = `You are EcoCoach — an autonomous AI agent helping users understand and reduce their carbon footprint.

You have access to tools that let you:
- Fetch the user's real emission data
- Compare transport options with actual CO2 calculations
- Log activities and update goals on their behalf

IMPORTANT RULES:
1. Always use tools to get real data before answering questions about the user's footprint.
2. When asked about transport, use get_transport_options to get real distances and emissions.
3. When the user asks to log something, use log_activity (ask for confirmation first if unclear).
4. Give specific, data-driven advice based on what the tools return.
5. Be concise but warm. Speak like a personal coach, not a chatbot.
6. Format numbers clearly: always include units (kg CO2e, km, kWh).`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  let iteration = 0;
  const MAX_ITERATIONS = 5; // Safety limit

  try {
    while (iteration < MAX_ITERATIONS) {
      iteration++;

      const response = await axios.post(GROQ_BASE, {
        model: GROQ_MODEL,
        messages,
        tools: AGENT_TOOLS,
        tool_choice: 'auto',
        max_tokens: 1024,
        temperature: 0.3,
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      });

      const choice = response.data.choices[0];
      const assistantMsg = choice.message;
      messages.push(assistantMsg);

      // ── No tool calls → final answer ──────────────────────────────────
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        send('answer', assistantMsg.content);
        break;
      }

      // ── Tool calls → execute each, send step updates ───────────────────
      const toolResults = [];

      for (const tc of assistantMsg.tool_calls) {
        const toolName = tc.function.name;
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}

        // Tell frontend the agent is thinking / calling a tool
        send('thinking', {
          tool: toolName,
          args,
          label: TOOL_LABELS[toolName] ?? toolName,
        });

        // Execute the tool
        let result;
        try {
          result = await executeTool(toolName, args, baseUrl);
          send('tool_result', { tool: toolName, result });
        } catch (err) {
          result = { error: err.message };
          send('tool_result', { tool: toolName, error: err.message });
        }

        toolResults.push({
          tool_call_id: tc.id,
          role: 'tool',
          content: JSON.stringify(result),
        });
      }

      // Feed all tool results back to the model
      messages.push(...toolResults);
    }

    if (iteration >= MAX_ITERATIONS) {
      send('answer', 'I checked your data across multiple sources. Please see the tool results above for your carbon footprint details.');
    }

  } catch (err) {
    console.error('[Agent] Error:', err.response?.data ?? err.message);
    send('error', err.response?.data?.error?.message ?? err.message);
  }

  res.end();
}

// Human-readable labels for the "thinking" UI
const TOOL_LABELS = {
  get_footprint:           '📊 Fetching your carbon footprint data...',
  get_category_breakdown:  '🗂️ Analysing your emission categories...',
  get_transport_options:   '🗺️ Calculating route & transport emissions...',
  log_activity:            '📝 Logging your activity...',
  set_goal:                '🎯 Updating your daily goal...',
};

module.exports = { runAgentLoop, AGENT_TOOLS };
