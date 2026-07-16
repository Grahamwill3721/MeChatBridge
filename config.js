{
  "name": "MeChat Bridge - Translation Prototype v1.0.0",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "mechat-bridge",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "webhook-node",
      "name": "Receive MeChat Message",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [
        -720,
        0
      ],
      "webhookId": "mechat-bridge"
    },
    {
      "parameters": {
        "jsCode": "const input = $json.body ?? $json;\nconst mode = input.mode === 'improve' ? 'improve' : 'translate';\nconst systemPrompt = mode === 'improve'\n  ? `Improve wording in the same language. Preserve meaning, intent, emotional intensity, respect and relationship. Do not add promises, affection, criticism or certainty. Return strict JSON only.`\n  : `You are the MeChat Bridge cross-cultural communication capability. Translate meaning rather than words. Preserve intent, tone, respect, relationship context, names and cultural conventions. Produce natural target-language wording. Do not add, remove, intensify or weaken meaning. Request clarification only when material ambiguity could change the message. Return strict JSON only.`;\nconst outputSchema = { originalText: input.originalText, improvedText: mode === 'improve' ? 'string' : '', translatedText: mode === 'translate' ? 'string' : '', sourceLanguage: input.sourceLanguage, targetLanguage: mode === 'improve' ? input.sourceLanguage : input.targetLanguage, confidence: 0.0, ambiguityDetected: false, needsClarification: false, clarificationQuestion: '' };\nreturn [{json:{...input,mode,systemPrompt,userPrompt:JSON.stringify({task:mode,sourceLanguage:input.sourceLanguage,targetLanguage:input.targetLanguage,originalText:input.originalText,relationshipContext:input.relationshipContext ?? {},recentMessages:input.recentMessages ?? [],requiredOutput:outputSchema})}}];"
      },
      "id": "prepare-node",
      "name": "Prepare Capability Request",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -470,
        0
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.openai.com/v1/chat/completions",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{$env.OPENAI_API_KEY}}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "contentType": "raw",
        "rawContentType": "application/json",
        "body": "={{ JSON.stringify({ model: 'gpt-4.1-mini', temperature: 0.2, response_format: { type: 'json_object' }, messages: [ { role: 'system', content: $json.systemPrompt }, { role: 'user', content: $json.userPrompt } ] }) }}",
        "options": {}
      },
      "id": "openai-node",
      "name": "Translate with OpenAI",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        -200,
        0
      ]
    },
    {
      "parameters": {
        "jsCode": "const content = $json.choices?.[0]?.message?.content;\nif (!content) throw new Error('The language model returned no message content.');\nlet parsed;\ntry { parsed = JSON.parse(content); } catch { throw new Error('The language model did not return valid JSON.'); }\nreturn [{json:parsed}];"
      },
      "id": "parse-node",
      "name": "Parse and Validate Response",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        70,
        0
      ]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json }}",
        "options": {
          "responseHeaders": {
            "entries": [
              {
                "name": "Access-Control-Allow-Origin",
                "value": "*"
              },
              {
                "name": "Access-Control-Allow-Headers",
                "value": "Content-Type"
              }
            ]
          }
        }
      },
      "id": "respond-node",
      "name": "Return Bridge Result",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.4,
      "position": [
        330,
        0
      ]
    }
  ],
  "connections": {
    "Receive MeChat Message": {
      "main": [
        [
          {
            "node": "Prepare Capability Request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Prepare Capability Request": {
      "main": [
        [
          {
            "node": "Translate with OpenAI",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Translate with OpenAI": {
      "main": [
        [
          {
            "node": "Parse and Validate Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Parse and Validate Response": {
      "main": [
        [
          {
            "node": "Return Bridge Result",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {},
  "settings": {
    "executionOrder": "v1"
  },
  "staticData": null,
  "tags": []
}