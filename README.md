# 🥗 Family Meal Planner

A mobile-friendly web application designed to help families plan weekly meals, accommodate picky eaters, and generate consolidated weekend grocery lists. Built with **Python (FastAPI)**, **React (Vite + Tailwind CSS)**, **SQLite**, and **Google Gemini AI**.

---

## ✨ Features

- **📅 Weekly Meal Scheduler**: Schedule delicious meals on an interactive calendar.
- **👶 Diner Picky Food Warning**: Warns you instantly on the planner calendar or recipe card if a meal contains ingredients disliked by picky kids or family members.
- **🛒 Smart Grocery List**: Sunday/Saturday consolidated shopping list that aggregates all required ingredients across scheduled meals, normalization, and parsed quantities. You can also add custom items!
- **📷 Gemini AI Recipe Scanner**: Take a picture of any cookbook page or physical card, and Gemini will automatically extract instructions, cooking times, and structured ingredients.
- **🐳 Dockerized & Unraid Ready**: Packaged into a single lightweight multi-stage Docker container serving both UI and API.

---

## 🛠️ Tech Stack

- **Backend**: FastAPI, SQLAlchemy, SQLite, Pydantic, google-generativeai SDK
- **Frontend**: React (Vite), Tailwind CSS (Mobile responsive bottom navigation layout)
- **Deployment**: Multi-stage Dockerfile, Docker Compose

---

## 🚀 How to Run Locally

### Option A: Running via Docker Compose (Recommended)
This is the closest environment to your final hosting on Unraid. It builds the React static files and copies them directly into FastAPI to be served together on port `8000`.

1. Ensure you have [Docker](https://www.docker.com/) installed.
2. In the root directory (`family-meal-planner`), run:
   ```bash
   docker compose up --build
   ```
3. Open your browser on your phone or PC and visit:
   `http://localhost:8000`

---

### Option B: Running for Active Development (Separate Front & Back)
If you want to edit the code with instant hot-reloading:

#### 1. Start Backend API
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create and activate a python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Verify your Gemini Key is configured in `backend/.env`.
5. Start the API Server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   The backend API will run at `http://localhost:8000`.

#### 2. Start React Frontend
1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the Vite server:
   ```bash
   npm run dev
   ```
4. Open the development UI at `http://localhost:3000`. It will automatically proxy API requests to your backend on port `8000`!

---

## 🐳 Unraid Setup Guide

To host this on your Unraid server:

1. Copy the `family-meal-planner` directory to your Unraid host machine or push the built image to a private registry (like Docker Hub or GitHub Packages).
2. Alternatively, use Unraid's **Docker -> Add Container** screen:
   - **Name**: `family-meal-planner`
   - **Repository**: Build the image locally on Unraid or use your registry image.
   - **Network Type**: `Bridge`
   - **Port**: `8000` (Container Port `8000` -> Host Port of your choice, e.g. `8080`)
   - **Environment Variable**: `GEMINI_API_KEY` with your official key value.
   - **Path (Storage)**: Map container path `/app/mealplanner.db` to `/mnt/user/appdata/family-meal-planner/mealplanner.db` to persist your data when the container updates!

---

## 🧪 Testing the Gemini Scanner
When accessing the website from your mobile web browser, tapping the **📷 Scan with Gemini** button will automatically trigger your smartphone's camera. Take a well-lit photo of a recipe from a cookbook, click "Analyze", and watch Gemini populate the recipe form instantly for you to review and save!
