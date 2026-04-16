import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.APP_URL ? `${process.env.APP_URL}/auth/callback` : `http://localhost:${PORT}/auth/callback`
  );

  let tokensStore: any = null;

  app.get("/api/auth/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/calendar",
      ],
    });
    res.json({ url });
  });

  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const code = req.query.code as string;
    if (code) {
      try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        tokensStore = tokens;
      } catch (err) {
        console.error(err);
      }
    }

    res.send(`
      <html>
        <body>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              }
            } catch(e) {
              console.error("Opener cross-origin blockage", e);
            }
            // Auto-close fallback
            setTimeout(function() { window.close(); }, 1500);
          </script>
          <div style="font-family: system-ui, sans-serif; text-align: center; margin-top: 50px;">
            <p style="font-weight: 600; font-size: 20px; color: #111;">Authentication Successful!</p>
            <p style="color: #666; font-size: 15px;">You can safely close this window and return to your application.</p>
            <button onclick="window.close()" style="margin-top: 20px; padding: 12px 24px; font-weight: 600; font-size: 15px; border-radius: 99px; border: none; background: #000; color: #fff; cursor: pointer;">Close Window</button>
          </div>
        </body>
      </html>
    `);
  });

  app.get("/api/auth/status", (req, res) => {
    res.json({ connected: !!tokensStore });
  });

  app.post("/api/auth/disconnect", (req, res) => {
    tokensStore = null;
    res.json({ success: true });
  });

  app.get("/api/emails", async (req, res) => {
    if (!tokensStore) return res.status(401).json({ error: "Not authenticated" });
    oauth2Client.setCredentials(tokensStore);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    
    try {
      const response = await gmail.users.messages.list({ userId: "me", maxResults: 15 });
      const messages = response.data.messages || [];

      // Stage 1: Async fetching of metadata only to greatly improve speed
      const emailPromises = messages.map(async (msg) => {
        if (!msg.id) return null;
        const msgDetails = await gmail.users.messages.get({ 
          userId: "me", 
          id: msg.id, 
          format: "full", 
        });
        const payload = msgDetails.data.payload;
        const headers = payload?.headers || [];
        const subject = headers.find((h: any) => h.name === "Subject")?.value || "No Subject";
        const from = headers.find((h: any) => h.name === "From")?.value || "Unknown";
        const date = headers.find((h: any) => h.name === "Date")?.value || "";
        const snippet = msgDetails.data.snippet || "";
        
        let bodyText = "";
        if (payload?.parts) {
          const part = payload.parts.find(p => p.mimeType === "text/plain");
          if (part && part.body?.data) {
            bodyText = Buffer.from(part.body.data, "base64").toString("utf-8");
          } else if (payload.parts.find(p => p.mimeType === "text/html")) {
            const htmlPart = payload.parts.find(p => p.mimeType === "text/html");
            if (htmlPart && htmlPart.body?.data) {
              bodyText = Buffer.from(htmlPart.body.data, "base64").toString("utf-8").replace(/<[^>]+>/g, ''); // strip html
            }
          }
        } else if (payload?.body?.data) {
           bodyText = Buffer.from(payload.body.data, "base64").toString("utf-8").replace(/<[^>]+>/g, '');
        }
        
        return { id: msg.id, subject, from, date, snippet, body: bodyText, threadId: msgDetails.data.threadId };
      });

      const emails = (await Promise.all(emailPromises)).filter(Boolean);
      res.json({ emails });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/emails/analyze", async (req, res) => {
    try {
      const { emails } = req.body;
      if (!emails || !emails.length) return res.json({ analysis: {} });
      if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Analyze these emails. Return a strict JSON object mapping each email ID to its analysis. Do NOT wrap in markdown \`\`\`json blocks.
Format:
{
  "email_id_here": {
    "categoryId": "Income" | "Financial" | "Important" | "Low Priority",
    "isPaycheck": boolean,
    "expectedAmount": "$1234.00" | null,
    "summary": "1-2 sentence brief summary highlighting action items."
  }
}
Emails:
${JSON.stringify(emails)}
`;
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let rawText = aiResponse.text || "{}";
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      let analysis = {};
      try {
        analysis = JSON.parse(rawText);
      } catch(e) {
        console.error("Failed to parse Gemini JSON:", rawText);
      }
      res.json({ analysis });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/calendar/events", async (req, res) => {
    if (!tokensStore) return res.status(401).json({ error: "Not authenticated" });
    oauth2Client.setCredentials(tokensStore);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 5,
        singleEvents: true,
        orderBy: 'startTime',
      });
      res.json({ events: response.data.items || [] });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/emails/draft", async (req, res) => {
    try {
      const { emailSubject, emailBody, tone } = req.body;
      if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Draft a ${tone || 'professional'} email reply to the following email. Only output the exact body of the email reply, ready to be sent. No introductory or concluding chatter (e.g. don't say "Here is your draft:").
Email Subject: ${emailSubject}
Email Body:
${emailBody}
`;
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      res.json({ draft: aiResponse.text?.trim() || "" });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/emails/send", async (req, res) => {
    try {
      if (!tokensStore) return res.status(401).json({ error: "Not authenticated" });
      const { text, to, subject, threadId } = req.body;
      oauth2Client.setCredentials(tokensStore);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const emailLines = [];
      emailLines.push(`To: ${to}`);
      emailLines.push(`Subject: Re: ${subject.replace(/^Re: /i, '')}`);
      // Using basic references without full headers for a simple reply
      emailLines.push(`Content-Type: text/plain; charset="UTF-8"`);
      emailLines.push('');
      emailLines.push(text);

      const emailParts = emailLines.join('\r\n');
      const encodedMessage = Buffer.from(emailParts).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: threadId
        }
      });

      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
