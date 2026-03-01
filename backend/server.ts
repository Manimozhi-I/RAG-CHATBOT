import express, { type Request, type Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import pdf from 'pdf-parse-fork'; 

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// --- AI CONFIGURATION (2026 STABLE) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const CHAT_MODEL = "gemini-3-flash-preview"; 
const EMBED_MODEL = "gemini-embedding-001"; 

interface VectorRecord {
    textChunk: string;
    embedding: number[];
}
const vectorStore = new Map<string, VectorRecord[]>();

// --- MATH HELPERS ---
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + chunkSize));
        i += chunkSize - overlap;
    }
    return chunks;
}

function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += (vecA[i] || 0) * (vecB[i] || 0);
        normA += (vecA[i] || 0) ** 2;
        normB += (vecB[i] || 0) ** 2;
    }
    return normA === 0 || normB === 0 ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- API ENDPOINTS ---

app.get('/api/session', (req: Request, res: Response) => {
    const sessionId = crypto.randomUUID();
    vectorStore.set(sessionId, []);
    res.status(200).json({ sessionId });
});

app.post('/api/upload', upload.single('document'), async (req: Request, res: Response): Promise<void> => {
    try {
        const file = req.file;
        const sessionId = req.body.sessionId;
        if (!file || !sessionId) {
            res.status(400).json({ error: "Missing file or session ID." });
            return;
        }

        const text = file.mimetype === 'application/pdf' 
            ? (await (pdf as any)(file.buffer)).text 
            : file.buffer.toString('utf-8');

        const chunks = chunkText(text, 1000, 200);
        const sessionMemory: VectorRecord[] = [];
        const model = genAI.getGenerativeModel({ model: EMBED_MODEL });

        for (const chunk of chunks) {
            const result = await model.embedContent({
                content: { role: "user", parts: [{ text: chunk }]},
                taskType: TaskType.RETRIEVAL_DOCUMENT
            });
            sessionMemory.push({ textChunk: chunk, embedding: result.embedding.values });
        }

        vectorStore.set(sessionId, sessionMemory);
        res.status(200).json({ message: "Success!", totalChunks: chunks.length });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ask', async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId, question } = req.body;
        const memory = vectorStore.get(sessionId);

        if (!memory || memory.length === 0) {
            res.status(400).json({ error: "No documents found for this session." });
            return;
        }

        const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
        const result = await model.embedContent({
            content: { role: "user", parts: [{ text: question }]},
            taskType: TaskType.RETRIEVAL_QUERY
        });
        const qEmbedding = result.embedding.values;

        // Calculate scores
        const scored = memory.map(m => ({
            text: m.textChunk,
            score: calculateCosineSimilarity(qEmbedding, m.embedding)
        })).sort((a, b) => b.score - a.score).slice(0, 3);

        // --- THE TS FIX: Check length and existence before accessing [0] ---
        if (scored.length === 0 || !scored[0] || scored[0].score < 0.5) {
            res.json({ 
                answer: "This is outside the scope of uploaded documents.", 
                retrievedChunks: [] 
            });
            return;
        }

        const context = scored.map(s => s.text).join("\n\n");
        const chatModel = genAI.getGenerativeModel({ model: CHAT_MODEL });
        const response = await chatModel.generateContent(`Use ONLY this context: ${context}\n\nQuestion: ${question}`);
        
        res.json({ answer: response.response.text(), retrievedChunks: scored });

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));