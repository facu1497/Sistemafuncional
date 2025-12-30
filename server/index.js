const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const multer = require('multer');
const OpenAI = require('openai');

// Configurar subida de archivos en memoria
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Endpoint de Transcripción con OpenAI Whisper
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo.' });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey.includes('PEGAR_TU_CLAVE')) {
            return res.status(500).json({ error: 'Servidor: Falta configurar OPENAI_API_KEY en el archivo .env' });
        }

        const openai = new OpenAI({ apiKey });

        // Create a File object from the buffer
        const file = new File([req.file.buffer], req.file.originalname, {
            type: req.file.mimetype
        });

        const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: "whisper-1",
            language: "es", // Spanish
            response_format: "text"
        });

        res.json({ text: transcription });

    } catch (error) {
        console.error("Error en transcripción:", error);
        res.status(500).json({ error: 'Error al procesar con OpenAI Whisper: ' + error.message });
    }
});

// Rutas base (Ejemplo: obtener casos desde el backend)
app.get('/api/casos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('casos')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
