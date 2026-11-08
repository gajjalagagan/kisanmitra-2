
import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// OpenAI setup
const client = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL })
    : null;

// Language names
const languageNames = {
    en: "English",
    te: "Telugu",
    hi: "Hindi",
    kn: "Kannada",
    ta: "Tamil",
    mr: "Marathi",
    bn: "Bengali"
};

// ------------------------------------
// 1. LOCATION API
// ------------------------------------

app.get("/api/location", async (req, res) => {
    try {
        const name = req.query.name;

        if (!name) {
            return res.status(400).json({
                error: "Please enter a location."
            });
        }

        const url =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            return res.status(404).json({
                error: "Location not found."
            });
        }

        res.json(data.results);

    } catch (error) {
        console.error("Location error:", error);

        res.status(500).json({
            error: "Unable to find location."
        });
    }
});

// ------------------------------------
// 2. WEATHER API
// ------------------------------------

app.get("/api/weather", async (req, res) => {
    try {
        const lat = Number(req.query.lat);
        const lon = Number(req.query.lon);

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 || lat > 90 ||
            lon < -180 || lon > 180
        ) {
            return res.status(400).json({
                error: "Valid latitude and longitude are required."
            });
        }

        const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&daily=precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min&timezone=auto`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            return res.status(502).json({
                error: "Weather service is unavailable."
            });
        }

        res.json(data);

    } catch (error) {
        console.error("Weather error:", error);

        res.status(500).json({
            error: "Unable to retrieve weather information."
        });
    }
});

// ------------------------------------
// 3. AI FARMING ASSISTANT
// ------------------------------------

app.post("/api/ai", async (req, res) => {
    try {
        // Get question and selected language
        const { question, language } = req.body;

        const replyLanguage = languageNames[language] || "English";

        // Check question
        if (
            typeof question !== "string" ||
            question.trim().length === 0
        ) {
            return res.status(400).json({
                error: "Please enter your farming question."
            });
        }

        if (question.length > 3000) {
            return res.status(400).json({
                error: "Your question is too long. Please shorten it."
            });
        }

        // Check API key
        if (!client) {
            return res.status(503).json({
                error: "AI is not configured. Please add your API key to the server .env file."
            });
        }

        // AI instructions
        const instructions = `
You are KisanMitra AI, a helpful agricultural information assistant.

Your job is to help farmers understand:
- Crop cultivation
- Irrigation and water management
- Weather-related farming precautions
- Common crop pests and diseases
- Soil health
- Sustainable farming
- Integrated pest management

LANGUAGE RULE:
Always reply in ${replyLanguage}.
Use simple, easy-to-understand language.
If the user asks in another language, still reply in ${replyLanguage}.

IMPORTANT ACCURACY RULES:
1. Do not invent agricultural statistics or official recommendations.
2. Explain when information is an estimate rather than a confirmed fact.
3. Consider the user's crop, location, weather and crop growth stage if provided.
4. Do not claim that a pest or disease is confirmed from symptoms alone.
5. Recommend safe practices such as field monitoring, removing affected plant parts where appropriate, crop rotation and seeking local agricultural advice.
6. Do not provide pesticide mixing instructions, chemical doses or unsafe chemical-use directions.
7. For serious crop problems, recommend contacting a local Krishi Vigyan Kendra (KVK) or agriculture officer.
8. Keep answers practical, clear and organized.

Use headings and numbered steps when helpful.
`;

        // Send request to OpenAI
        const response = await client.responses.create({
            model: process.env.OPENAI_MODEL || "gpt-5.5",
            instructions: instructions,
            input: question.trim()
        });

        // Send AI answer to website
        res.json({
            answer: response.output_text || "Sorry, I could not generate an answer.",
            language: replyLanguage
        });

    } catch (error) {
        console.error("AI error:", error);

        res.status(500).json({
            error: "The AI assistant could not respond. Please try again."
        });
    }
});

// ------------------------------------
// 4. START SERVER
// ------------------------------------

app.listen(PORT, () => {
    console.log(`KisanMitra AI running at http://localhost:${PORT}`);
});
