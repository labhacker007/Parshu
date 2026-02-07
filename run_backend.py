#!/usr/bin/env python3
"""
Simple script to run the HuntSphere backend server.
Run this from the project root: python3 run_backend.py
"""
import os
import sys
import subprocess

# Change to the script's directory
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

# Set environment variables for SQLite (no PostgreSQL needed)
os.environ["DATABASE_URL"] = "sqlite:///./backend/huntsphere_dev.db"
os.environ["SECRET_KEY"] = "dev-secret-key-change-in-production"
os.environ["CORS_ORIGINS"] = "http://localhost:3000,http://localhost:8000"
os.environ["DEBUG"] = "true"
os.environ["ENABLE_OTP"] = "false"
os.environ["GENAI_PROVIDER"] = "ollama"
os.environ["OLLAMA_BASE_URL"] = "http://localhost:11434"

print("=" * 50)
print("  Starting HuntSphere Backend Server")
print("=" * 50)
print()
print(f"  Working directory: {script_dir}")
print(f"  Database: SQLite (./backend/huntsphere_dev.db)")
print(f"  Server URL: http://localhost:8000")
print(f"  API Docs: http://localhost:8000/docs")
print()
print("  Login credentials:")
print("    Username: admin")
print("    Password: Admin@123")
print()
print("  Press Ctrl+C to stop")
print("=" * 50)
print()

# Change to backend directory and run uvicorn
os.chdir("backend")

# Add backend to Python path
sys.path.insert(0, os.getcwd())

try:
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
except ImportError:
    print("Installing required packages...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
