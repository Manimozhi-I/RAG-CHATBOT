**Session-Based RAG Application**

This project is a Retrieval-Augmented Generation (RAG) based chatbot that allows users to upload documents (PDF/TXT), generate embeddings from the content, and ask contextual questions strictly based on the uploaded files.

The system ensures that responses are generated only from document content and rejects out-of-scope questions using similarity-based guardrails.

**Setup Instructions**
1) *Backend Setup*

   *Navigate to the backend folder: cd backend.

   *Install dependencies: npm install.

   *Create a .env file and add your API key: GEMINI_API_KEY=your_api_key_here

   *Start the server: npx ts-node server.ts. (Runs on http://localhost:3001

2. *Frontend Setup*

   *Navigate to the frontend folder: cd frontend.

   *Install dependencies: npm install.
   
   *Start the development server: npm run dev. (Runs on http://localhost:5173)

**Architecture Overview**

The application follows a modular RAG architecture:

* Frontend: React + Vite UI for document management and chat.

* Ingestion: Backend extracts text from PDFs and splits it into manageable chunks.

* Embedding: Google Gemini (text-embedding-004) converts text chunks into high-dimensional vectors.

* Retrieval: An In-Memory Vector Store uses manual Cosine Similarity to find relevant context.

* Generation: Gemini 1.5 Flash generates answers based only on retrieved context.

**Chunking Strategy**


I utilize a Fixed-Size Sliding Window approach:

* Chunk Size: 1000 characters.

* Overlap: 200 characters.

 This ensures that semantic context isn't lost at the edges of a chunk, allowing the model to understand sentences that might otherwise be cut in half.

**Retrieval Flow**

Instead of using a heavy external database, I implemented a lightweight Manual Cosine Similarity engine:

* Convert the user's query into an embedding vector.

* Calculate the Dot Product of the query vector against all stored document vectors.


* Divide by the product of their magnitudes to get the similarity score.

* Sort and retrieve the top-K most relevant chunks.

**Guardrail Logic**

To prevent AI hallucinations, I implemented a strict Similarity Threshold:

* Threshold: $0.5$.Logic: If no document chunks meet the $0.5$ similarity score, the system triggers a "Hard Guardrail."

* Result: The chatbot returns a standardized message: "I'm sorry, I couldn't find relevant information in the uploaded documents to answer that.".

📦 **Third-Party Packages**

Google Generative AI - Accessing Gemini models for embeddings and text generation.

Pdf-parse - Extracting raw text from uploaded PDF files.

Express - Lightweight Node.js server for handling API requests.

Multer - Handling multipart/form-data for PDF file uploads.

**Future improvement** :

* Implement ChromaDB or Pinecone for persistent vector storage.

* Add support for multi-modal files (images/tables inside PDFs).

Demo video : https://drive.google.com/drive/u/0/folders/1oBAr7KyYWbtjvPjlTeXBjrjsEOib5JFZ?ths=true







   


