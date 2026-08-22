# RailMind Deployment Guide

This guide provides instructions for deploying the RailMind application, which is configured as a unified application where the FastAPI backend serves the React frontend production assets.

## Deployment Strategy
We compile the React frontend into static assets and run them directly inside the FastAPI Python container. This provides a unified single-port architecture (`8001`), which eliminates CORS issues, simplifies websocket configurations, and makes it possible to deploy the app with a single service.

---

## 1. Local Deployment (using Docker Compose)

The easiest way to run the entire stack locally in production mode is using Docker Compose.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed and running.

### Instructions
1. Run the following command in the root directory:
   ```bash
   docker compose up --build
   ```
2. Once the build is complete and the container starts, open your browser and navigate to:
   **[http://localhost:8001](http://localhost:8001)**
3. To stop the application:
   ```bash
   docker compose down
   ```

---

## 2. Cloud Hosting Deployments

Since the application is containerized, it can be deployed to any platform that supports Docker.

### Option A: Railway (Easiest)
Railway detects `Dockerfile` automatically and deploys it on a single service.
1. Create an account on [Railway](https://railway.app/).
2. Click **New Project** -> **Deploy from GitHub repo** and select `RAILMIND`.
3. Railway will build and deploy the `Dockerfile` automatically.
4. Set the `PORT` environment variable to `8001` (or let Railway inject its default port, and our Dockerfile will automatically bind to it).
5. Generate a domain under the service settings to access your app.

### Option B: Render (Free Tier Friendly)
1. Go to [Render](https://render.com/).
2. Create a new **Web Service** and link your GitHub repository.
3. In the service configuration:
   - **Runtime**: `Docker`
   - **Build Command**: (Leave blank, it uses the Dockerfile)
   - **Start Command**: (Leave blank, it uses the CMD in Dockerfile)
4. Under **Environment Variables**, Render will automatically bind the required port.
5. Save and deploy.

### Option C: Fly.io
1. Install the `flyctl` CLI tool and authenticate.
2. Initialize the application config by running:
   ```bash
   fly launch
   ```
3. Set the internal port mapping in the generated `fly.toml` to `8001`.
4. Deploy the application:
   ```bash
   fly deploy
   ```

---

## 3. Manual Build & Run (No Docker)

If you wish to run the app without Docker, follow these steps:

### Step 1: Build the Frontend
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies and build:
   ```bash
   npm install
   ```
   ```bash
   npm run build
   ```
3. This creates the static assets under `frontend/dist`.

### Step 2: Run the Backend
1. Navigate back to the backend directory:
   ```bash
   cd ../backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI server on port 8001:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8001
   ```
4. Access the application at **[http://localhost:8001](http://localhost:8001)**.
