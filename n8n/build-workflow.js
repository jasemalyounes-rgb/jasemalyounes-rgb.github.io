// Builds portfolio-chatbot.json (importable n8n workflow) from system-prompt.md.
// Run: node n8n/build-workflow.js
const fs = require('fs'), path = require('path');
const here = __dirname;
const systemMessage = fs.readFileSync(path.join(here, 'system-prompt.md'), 'utf8').trim();

const WEBHOOK_ID = '3a9c9ab7-8f8d-4c99-9e07-56a3f1fa0a65';
const ORIGINS = 'https://jasemalyounes-rgb.github.io';

const workflow = {
  name: 'Portfolio site — chatbot',
  nodes: [
    {
      id: 'c1b6c1a0-0001-4c55-9a51-000000000001',
      name: 'When chat message received',
      type: '@n8n/n8n-nodes-langchain.chatTrigger',
      typeVersion: 1.5,
      position: [0, 0],
      webhookId: WEBHOOK_ID,
      parameters: {
        public: true,
        mode: 'webhook',
        authentication: 'none',
        options: { allowedOrigins: ORIGINS, responseMode: 'lastNode' },
      },
    },
    {
      id: 'c1b6c1a0-0002-4c55-9a51-000000000002',
      name: 'Portfolio assistant',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 3.1,
      position: [260, 0],
      parameters: { options: { systemMessage, maxIterations: 4 } },
    },
    {
      id: 'c1b6c1a0-0003-4c55-9a51-000000000003',
      name: 'Google Gemini Chat Model',
      type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
      typeVersion: 1,
      position: [180, 220],
      parameters: { modelName: 'models/gemini-2.5-flash', options: { temperature: 0.4, maxOutputTokens: 600 } },
    },
    {
      id: 'c1b6c1a0-0004-4c55-9a51-000000000004',
      name: 'Conversation memory',
      type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
      typeVersion: 1.3,
      position: [360, 220],
      parameters: { contextWindowLength: 8 },
    },
  ],
  connections: {
    'When chat message received': { main: [[{ node: 'Portfolio assistant', type: 'main', index: 0 }]] },
    'Google Gemini Chat Model': { ai_languageModel: [[{ node: 'Portfolio assistant', type: 'ai_languageModel', index: 0 }]] },
    'Conversation memory': { ai_memory: [[{ node: 'Portfolio assistant', type: 'ai_memory', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
  pinData: {},
};

fs.writeFileSync(path.join(here, 'portfolio-chatbot.json'), JSON.stringify(workflow, null, 2) + '\n');
console.log('wrote portfolio-chatbot.json,', systemMessage.length, 'chars of system prompt');
