"""
Ollama Installation & Management API

Provides one-click Ollama installation with Docker detection and model management.

Features:
- Check Ollama installation status
- One-click installation (platform-specific)
- Pull models directly from UI
- List available models
- Docker integration detection

Context:
- Used in GenAI Admin UI (Day 2)
- Supports Linux auto-install, macOS/Windows manual download
- Integrates with existing genai/provider.py
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from app.auth.dependencies import require_permission
from app.auth.rbac import Permission
from app.models import User
import subprocess
import platform
import os
import httpx
from datetime import datetime

router = APIRouter(prefix="/admin/ollama", tags=["admin-ollama"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class OllamaStatus(BaseModel):
    """Current Ollama installation status."""
    installed: bool = Field(..., description="Whether Ollama is installed")
    version: Optional[str] = Field(None, description="Ollama version string")
    running: bool = Field(False, description="Whether Ollama service is running")
    docker_available: bool = Field(False, description="Whether Docker is available")
    platform: str = Field(..., description="Operating system platform")
    models: List[str] = Field(default_factory=list, description="Installed model names")
    base_url: Optional[str] = Field(None, description="Ollama API base URL")


class ModelInfo(BaseModel):
    """Information about an Ollama model."""
    name: str
    size: Optional[str] = None
    modified: Optional[datetime] = None
    digest: Optional[str] = None


class InstallResponse(BaseModel):
    """Response from installation endpoint."""
    success: bool
    message: str
    manual: bool = False
    download_url: Optional[str] = None


class PullProgress(BaseModel):
    """Progress of model pull operation."""
    model: str
    status: str
    progress: Optional[float] = None
    message: str


# ============================================================================
# Helper Functions
# ============================================================================

def check_docker_available() -> bool:
    """Check if Docker is available."""
    try:
        result = subprocess.run(
            ["docker", "ps"],
            capture_output=True,
            timeout=5,
            text=True
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def check_ollama_installed() -> tuple[bool, Optional[str]]:
    """Check if Ollama is installed and get version."""
    try:
        result = subprocess.run(
            ["ollama", "version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            version = result.stdout.strip()
            return True, version
        return False, None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False, None


def check_ollama_running() -> bool:
    """Check if Ollama service is running."""
    # Try HTTP API
    try:
        import httpx
        response = httpx.get("http://localhost:11434/api/tags", timeout=2.0)
        return response.status_code == 200
    except:
        pass

    # Fallback: try ollama list command
    try:
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except:
        return False


def get_installed_models() -> List[str]:
    """Get list of installed Ollama models."""
    try:
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode != 0:
            return []

        # Parse output
        lines = result.stdout.strip().split('\n')
        if len(lines) <= 1:  # Only header or empty
            return []

        # Skip header, extract model names
        models = []
        for line in lines[1:]:
            if line.strip():
                # Model name is first column
                model_name = line.split()[0]
                models.append(model_name)

        return models

    except (subprocess.TimeoutExpired, FileNotFoundError):
        return []


# ============================================================================
# API Routes
# ============================================================================

@router.get("/status", response_model=OllamaStatus)
async def get_ollama_status(
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    Check Ollama installation and service status.

    Returns:
    - Installation status
    - Version information
    - Service running status
    - Docker availability
    - Installed models list

    Permissions: ADMIN_GENAI_VIEW
    """
    installed, version = check_ollama_installed()
    running = check_ollama_running() if installed else False
    docker_available = check_docker_available()
    models = get_installed_models() if running else []

    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    return OllamaStatus(
        installed=installed,
        version=version,
        running=running,
        docker_available=docker_available,
        platform=platform.system().lower(),
        models=models,
        base_url=base_url
    )


@router.post("/install", response_model=InstallResponse)
async def install_ollama(
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    One-click Ollama installation (Linux only).

    For macOS/Windows, returns manual installation instructions.

    Permissions: ADMIN_GENAI_EDIT
    """
    system = platform.system().lower()

    if system == "linux":
        # Linux: Automated installation via official script
        try:
            install_cmd = "curl -fsSL https://ollama.com/install.sh | sh"

            result = subprocess.run(
                install_cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes max
            )

            if result.returncode == 0:
                return InstallResponse(
                    success=True,
                    message="Ollama installed successfully! Run 'ollama serve' to start the service.",
                    manual=False
                )
            else:
                return InstallResponse(
                    success=False,
                    message=f"Installation failed: {result.stderr}",
                    manual=False
                )

        except subprocess.TimeoutExpired:
            return InstallResponse(
                success=False,
                message="Installation timed out. Please try manual installation.",
                manual=True,
                download_url="https://ollama.com/download/linux"
            )

    elif system == "darwin":
        # macOS: Manual download
        return InstallResponse(
            success=False,
            message="Please download and install Ollama for macOS.",
            manual=True,
            download_url="https://ollama.com/download/mac"
        )

    elif system == "windows":
        # Windows: Manual download
        return InstallResponse(
            success=False,
            message="Please download and install Ollama for Windows.",
            manual=True,
            download_url="https://ollama.com/download/windows"
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported platform: {system}"
        )


@router.post("/pull/{model_name}", response_model=PullProgress)
async def pull_model(
    model_name: str,
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Pull an Ollama model from the registry.

    Common models:
    - llama3.1:8b (recommended for general use)
    - llama3.1:70b (high quality, requires more RAM)
    - mistral:7b (fast, good for coding)
    - codellama:13b (specialized for code)
    - phi3:mini (lightweight, 3.8GB)

    Permissions: ADMIN_GENAI_EDIT

    Note: Large models may take 10+ minutes to download.
    """
    # Check if Ollama is installed and running
    if not check_ollama_running():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama service is not running. Please start Ollama first."
        )

    try:
        # Start pull process
        process = subprocess.Popen(
            ["ollama", "pull", model_name],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # Wait for completion (with timeout)
        stdout, stderr = process.communicate(timeout=600)  # 10 minute timeout

        if process.returncode == 0:
            return PullProgress(
                model=model_name,
                status="completed",
                progress=100.0,
                message=f"Model {model_name} pulled successfully!"
            )
        else:
            error_msg = stderr.strip() if stderr else "Unknown error"
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to pull model: {error_msg}"
            )

    except subprocess.TimeoutExpired:
        process.kill()
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Model pull timed out. Large models may take longer. Please try again or use 'ollama pull' from terminal."
        )

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama command not found. Please ensure Ollama is installed."
        )


@router.get("/models", response_model=List[str])
async def list_models(
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    List all installed Ollama models.

    Permissions: ADMIN_GENAI_VIEW
    """
    if not check_ollama_running():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama service is not running"
        )

    models = get_installed_models()
    return models


@router.delete("/models/{model_name}")
async def delete_model(
    model_name: str,
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Remove an installed Ollama model.

    Permissions: ADMIN_GENAI_EDIT
    """
    if not check_ollama_running():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama service is not running"
        )

    try:
        result = subprocess.run(
            ["ollama", "rm", model_name],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            return {"message": f"Model {model_name} removed successfully"}
        else:
            error_msg = result.stderr.strip() if result.stderr else "Unknown error"
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to remove model: {error_msg}"
            )

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Model removal timed out"
        )


@router.get("/recommended-models")
async def get_recommended_models(
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    Get list of recommended models for different use cases.

    Permissions: ADMIN_GENAI_VIEW
    """
    return {
        "general": [
            {
                "name": "llama3.1:8b",
                "description": "Meta's Llama 3.1 8B - Best all-around model",
                "size": "4.7GB",
                "use_cases": ["General chat", "Summarization", "Q&A"]
            },
            {
                "name": "phi3:mini",
                "description": "Microsoft Phi-3 Mini - Lightweight and fast",
                "size": "2.3GB",
                "use_cases": ["Quick responses", "Low-resource environments"]
            }
        ],
        "coding": [
            {
                "name": "codellama:13b",
                "description": "Meta's Code Llama 13B - Code generation specialist",
                "size": "7.4GB",
                "use_cases": ["Code generation", "Code review", "Documentation"]
            },
            {
                "name": "mistral:7b",
                "description": "Mistral 7B - Fast and accurate for code",
                "size": "4.1GB",
                "use_cases": ["Code completion", "Refactoring suggestions"]
            }
        ],
        "analysis": [
            {
                "name": "llama3.1:70b",
                "description": "Meta's Llama 3.1 70B - Highest quality",
                "size": "40GB",
                "use_cases": ["Deep analysis", "Complex reasoning", "Research"],
                "note": "Requires 64GB+ RAM"
            }
        ]
    }


@router.post("/test-connection")
async def test_ollama_connection(
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_TEST.value))
):
    """
    Test connection to Ollama API.

    Permissions: ADMIN_GENAI_TEST
    """
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/api/tags", timeout=5.0)

            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "message": "Successfully connected to Ollama",
                    "base_url": base_url,
                    "models_count": len(data.get("models", []))
                }
            else:
                return {
                    "success": False,
                    "message": f"Ollama responded with status {response.status_code}",
                    "base_url": base_url
                }

    except httpx.TimeoutException:
        return {
            "success": False,
            "message": "Connection timed out. Ollama may not be running.",
            "base_url": base_url
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}",
            "base_url": base_url
        }
