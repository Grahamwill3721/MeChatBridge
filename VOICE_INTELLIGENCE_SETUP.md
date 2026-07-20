# MeChatBridge Voice Intelligence v1.1.0

## What this release does

- English speech becomes editable English text.
- Nepali speech is recognised as Devanagari by the browser.
- The Devanagari transcript is sent to a dedicated n8n webhook.
- n8n returns natural conversational Jhapa-style Roman Nepali.
- Roman Nepali is placed in the message box for review and editing.
- The user must press **Send** manually.

## Import the n8n workflow

1. Open n8n.
2. Choose **Import from File**.
3. Import `n8n/MeChatBridge-Voice-Roman-Nepali-v1.json`.
4. Open the **Romanise with OpenAI** node.
5. Create or select an **HTTP Header Auth** credential.
6. Set the header name to `Authorization`.
7. Set the value to `Bearer YOUR_OPENAI_API_KEY`.
8. Save and activate the workflow.
9. Confirm the production webhook ends with `/webhook/mechatbridge-voice-romanv1`.

## Frontend configuration

`config.js` already contains:

```js
voiceRomanWebhookUrl:
  "https://n8n.meaiecosystem.com/webhook/mechatbridge-voice-romanv1"
```

Change it only if your n8n domain or webhook path differs.

## Testing

1. Open Fulmaya's MeChatBridge page.
2. Ensure the source language is Nepali.
3. Tap the microphone and speak a short Nepali sentence.
4. Stop speaking.
5. Confirm natural Roman Nepali appears in the editable textbox.
6. Correct it if needed.
7. Press Send.

## Important

The original file named `MeChat_n8n_Prototype_Workflow.json` was not a valid n8n export; it contained HTML. It has been preserved unchanged. The new workflow in the `n8n` folder is a separate, valid JSON workflow template for voice Romanisation.
