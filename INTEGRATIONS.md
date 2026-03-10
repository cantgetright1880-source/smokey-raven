# BotForge Integration Configuration

## To enable integrations, fill in the values below and redeploy

---

## SLACK (Notifications)

1. Go to https://api.slack.com/messaging/webhooks
2. Create a new app → Enable Incoming Webhooks
3. Create webhook for your channel
4. Copy the URL below:

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

---

## TWILIO WHATSAPP

1. Go to https://console.twilio.com
2. Create account, get Account SID and Auth Token
3. Enable WhatsApp in Twilio

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+14155238886
```

---

## HUBSPOT (CRM)

1. Go to https://app.hubspot.com
2. Create private app → Get API Key

```
HUBSPOT_API_KEY=...
```

---

## Current Status

- Slack: Needs webhook URL from you
- WhatsApp: Needs Twilio credentials
- HubSpot: Needs API key
- Meta (Instagram/Messenger): Needs Facebook Developer account

**Quickest to set up:** Slack webhook - takes 2 minutes!
