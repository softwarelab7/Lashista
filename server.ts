import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Helper for Google Authentication
  const getGoogleAuth = () => {
    const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;

    if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return null;
    }

    let formattedKey = GOOGLE_PRIVATE_KEY;
    
    try {
      const parsed = JSON.parse(formattedKey);
      if (parsed.private_key) {
        formattedKey = parsed.private_key;
      }
    } catch(e) {}

    if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
      formattedKey = formattedKey.slice(1, -1);
    }
    
    formattedKey = formattedKey.replace(/\\n/g, '\n');

    if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
      // If headers are missing, assume it's just the base64 payload
      formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey.trim()}\n-----END PRIVATE KEY-----\n`;
    }

    return new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: formattedKey,
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events"
      ],
    });
  };

  // API Route to create Google Calendar Event
  app.post("/api/create-calendar-event", async (req, res) => {
    try {
      const auth = getGoogleAuth();
      if (!auth) {
        return res.status(500).json({ error: "Falta configuración de credenciales de Google." });
      }

      const { nombreCompleto, telefono, fecha, servicio, fichaId } = req.body;
      if (!nombreCompleto || !fecha) {
        return res.status(400).json({ error: "Faltan datos obligatorios de la cita." });
      }

      const calendar = google.calendar({ version: "v3", auth });
      const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

      // Formatear fecha AAAA-MM-DD
      const dateStr = fecha.includes('T') ? fecha.split('T')[0] : fecha;

      const event = {
        summary: `✨ Cita Pestañas: ${nombreCompleto}`,
        description: `Servicio: ${servicio || 'Extensiones / Lifting'}\nTeléfono: ${telefono || 'No especificado'}\nCódigo Ficha: ${fichaId || 'N/A'}`,
        start: {
          date: dateStr,
        },
        end: {
          date: dateStr,
        },
      };

      const createdEvent = await calendar.events.insert({
        calendarId: calendarId,
        requestBody: event,
      });

      res.json({
        success: true,
        eventId: createdEvent.data.id,
        htmlLink: createdEvent.data.htmlLink,
      });
    } catch (error: any) {
      console.error("Error agendando en Google Calendar:", error);
      res.status(500).json({ error: "Error al agendar en Google Calendar: " + error.message });
    }
  });

  // API Route to upload PDF to Google Drive
  app.post("/api/upload-pdf", async (req, res) => {
    try {
      const auth = getGoogleAuth();
      if (!auth) {
        return res.status(500).json({ error: "Falta configuración de credenciales de Google." });
      }

      const { pdfBase64, fileName, folderId } = req.body;
      if (!pdfBase64 || !fileName) {
        return res.status(400).json({ error: "Faltan datos del archivo PDF" });
      }

      const drive = google.drive({ version: "v3", auth });
      const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

      // Clean base64 header if present
      const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      const fileBuffer = Buffer.from(base64Data, "base64");

      const { Readable } = await import("stream");
      const media = {
        mimeType: "application/pdf",
        body: Readable.from(fileBuffer),
      };

      const fileMetadata: any = {
        name: fileName,
      };

      if (targetFolderId) {
        fileMetadata.parents = [targetFolderId];
      }

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, webViewLink, webContentLink",
      });

      // Make file accessible via link
      await drive.permissions.create({
        fileId: file.data.id!,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      }).catch(e => console.log("Permission notice:", e.message));

      res.json({
        success: true,
        fileId: file.data.id,
        webViewLink: file.data.webViewLink,
        webContentLink: file.data.webContentLink,
      });
    } catch (error: any) {
      console.error("Error uploading PDF to Drive:", error);
      res.status(500).json({ error: "Error al subir PDF a Google Drive: " + error.message });
    }
  });

  // API Route to submit form data to Google Sheets
  app.post("/api/submit-form", async (req, res) => {
    try {
      const auth = getGoogleAuth();
      const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

      if (!auth || !SPREADSHEET_ID) {
        return res.status(500).json({ 
          error: "Falta configuración de credenciales (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, SPREADSHEET_ID)." 
        });
      }

      const sheets = google.sheets({ version: "v4", auth });
      const { rowData } = req.body;

      if (!rowData || !Array.isArray(rowData)) {
        return res.status(400).json({ error: "Datos inválidos" });
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "A:AK",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowData],
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error submitting to sheets:", error);
      res.status(500).json({ error: "Error al guardar en Google Sheets: " + error.message });
    }
  });

  // Vite middleware for development
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

