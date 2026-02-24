**Incident Knowledge Management Platform**
An AI-powered platform that transforms unstructured IT/DevOps incident ticket data into structured, searchable, and actionable knowledge — using supervised ML, semantic search, clustering, LLM-based generation, and a RAG chat assistant.

**Project Overview**
IT and DevOps teams repeatedly face the same incidents with no structured way to capture, reuse, or learn from past resolutions. This platform solves that by:

- Automatically classifying incoming tickets by service, severity, and type
- Matching new incidents to similar past ones using semantic search
- Detecting patterns in resolved tickets through clustering
- Generating runbooks and postmortems automatically using LLMs
- Providing a RAG-powered chat assistant for querying historical knowledge
- Visualizing trends and metrics on an analytics dashboard

---

**Backend Setup**
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

---

**Frontend Setup**
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

---

Frontend runs at http://localhost:5173 and proxies API calls to http://localhost:8000.