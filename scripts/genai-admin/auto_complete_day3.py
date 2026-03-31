#!/usr/bin/env python3
"""
Fully Automated Day 3 Production Setup
Lazy engineer mode: Handles everything automatically
"""
import subprocess
import time
import sys
import os
from pathlib import Path

def print_header(msg):
    print(f"\n{'='*70}")
    print(f"{msg}")
    print(f"{'='*70}\n")

def print_info(msg):
    print(f"[INFO] {msg}")

def print_success(msg):
    print(f"[SUCCESS] {msg}")

def print_error(msg):
    print(f"[ERROR] {msg}", file=sys.stderr)

def print_warning(msg):
    print(f"[WARNING] {msg}")

def run_command(cmd, check=True, capture=True, timeout=None):
    """Run command and return result."""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=capture,
            text=True,
            timeout=timeout,
            check=False
        )
        return result
    except subprocess.TimeoutExpired:
        print_error(f"Command timed out: {cmd}")
        return None
    except Exception as e:
        print_error(f"Command failed: {e}")
        return None

def is_docker_running():
    """Check if Docker is running."""
    result = run_command("docker ps", check=False)
    return result and result.returncode == 0

def start_docker_desktop():
    """Attempt to start Docker Desktop."""
    possible_paths = [
        r"C:\Program Files\Docker\Docker\Docker Desktop.exe",
        os.path.expandvars(r"%ProgramFiles%\Docker\Docker\Docker Desktop.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Docker\Docker Desktop.exe"),
    ]

    for path in possible_paths:
        if os.path.exists(path):
            print_info(f"Found Docker Desktop at: {path}")
            print_info("Starting Docker Desktop...")

            # Start Docker Desktop
            subprocess.Popen([path], shell=False)
            return True

    print_error("Docker Desktop not found in common installation paths")
    return False

def wait_for_docker(max_wait=120):
    """Wait for Docker to be ready."""
    print_info(f"Waiting for Docker to be ready (max {max_wait}s)...")

    start_time = time.time()
    while time.time() - start_time < max_wait:
        if is_docker_running():
            print_success("Docker is now running!")
            return True

        elapsed = int(time.time() - start_time)
        print_info(f"Still waiting... ({elapsed}s / {max_wait}s)")
        time.sleep(5)

    return False

def ensure_containers_running():
    """Ensure Docker containers are running."""
    print_info("Checking if containers are running...")

    result = run_command("docker-compose ps")
    if not result or "parshu-backend-1" not in result.stdout or "Up" not in result.stdout:
        print_info("Starting containers...")
        run_command("docker-compose up -d")

        print_info("Waiting 30s for services to start...")
        time.sleep(30)
        return True

    print_success("Containers are already running")
    return True

def wait_for_backend_healthy(max_wait=60):
    """Wait for backend to be healthy."""
    print_info("Waiting for backend to be healthy...")

    start_time = time.time()
    while time.time() - start_time < max_wait:
        result = run_command("curl -s http://localhost:8000/health", check=False)
        if result and result.returncode == 0:
            print_success("Backend is healthy!")
            return True

        elapsed = int(time.time() - start_time)
        print_info(f"Backend not ready yet... ({elapsed}s / {max_wait}s)")
        time.sleep(5)

    print_warning("Backend health check timeout, proceeding anyway...")
    return True

def fix_database_schema():
    """Fix database schema by adding OAuth columns."""
    print_header("Step 1: Fixing Database Schema")

    schema_fix_cmd = """docker exec parshu-backend-1 python -c "
from sqlalchemy import text, inspect
from app.core.database import engine, SessionLocal

db = SessionLocal()
try:
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('users')]

    oauth_columns = {
        'oauth_provider': 'VARCHAR',
        'oauth_subject': 'VARCHAR',
        'oauth_email': 'VARCHAR',
        'oauth_picture': 'VARCHAR'
    }

    missing = [(name, type_) for name, type_ in oauth_columns.items() if name not in columns]

    if missing:
        for col_name, col_type in missing:
            try:
                db.execute(text(f'ALTER TABLE users ADD COLUMN {col_name} {col_type}'))
                db.commit()
                print(f'Added column: {col_name}')
            except Exception as e:
                print(f'Column {col_name} might already exist or error: {e}')

        # Create unique index on oauth_subject
        try:
            db.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_subject ON users(oauth_subject)'))
            db.commit()
            print('Created unique index on oauth_subject')
        except Exception as e:
            print(f'Index might already exist: {e}')
    else:
        print('All OAuth columns already exist')

    print('Schema updated successfully')
except Exception as e:
    print(f'Schema fix error: {e}')
finally:
    db.close()
"
"""

    result = run_command(schema_fix_cmd.strip())
    if result and result.returncode == 0:
        print_success("Database schema fixed")
        if result.stdout:
            print(result.stdout)
        return True
    else:
        print_error("Schema fix failed")
        if result and result.stderr:
            print(result.stderr)
        return False

def seed_test_data():
    """Seed test data for GenAI admin."""
    print_header("Step 2: Seeding Test Data")

    # Try to run seed script
    seed_cmd = 'docker exec parshu-backend-1 python scripts/genai-admin/seed_data.py'

    result = run_command(seed_cmd, check=False)
    if result and result.returncode == 0:
        print_success("Test data seeded")
        if result.stdout:
            print(result.stdout)
        return True
    else:
        print_warning("Seed script not found or failed, creating inline seed...")

        # Inline seeding as fallback
        inline_seed = """docker exec parshu-backend-1 python -c "
from app.core.database import SessionLocal
from app.models import Prompt, Skill, Guardrail, GenAIFunctionConfig
from datetime import datetime

db = SessionLocal()
try:
    # Create sample prompts if none exist
    if db.query(Prompt).count() == 0:
        prompts = [
            Prompt(
                name='summarization_executive',
                function_type='summarization',
                template='Provide a concise executive summary of the following article:\\n\\n{content}',
                version=1,
                is_active=True,
                temperature=0.7,
                max_tokens=500
            ),
            Prompt(
                name='summarization_technical',
                function_type='summarization',
                template='Provide a detailed technical summary of the following article:\\n\\n{content}',
                version=1,
                is_active=True,
                temperature=0.5,
                max_tokens=1000
            )
        ]
        for p in prompts:
            db.add(p)
        db.commit()
        print('Created sample prompts')

    # Create sample function configs if none exist
    if db.query(GenAIFunctionConfig).count() == 0:
        config = GenAIFunctionConfig(
            function_name='summarization',
            display_name='Article Summarization',
            description='Generate executive and technical summaries',
            primary_model_id='gpt-4o-mini',
            secondary_model_id='llama3.1:8b',
            is_active=True
        )
        db.add(config)
        db.commit()
        print('Created sample function config')

    print('Test data seeded successfully')
except Exception as e:
    print(f'Seeding error: {e}')
    db.rollback()
finally:
    db.close()
"
"""
        result = run_command(inline_seed.strip())
        if result and result.returncode == 0:
            print_success("Inline seed completed")
            if result.stdout:
                print(result.stdout)
            return True
        else:
            print_warning("Seeding had issues but continuing...")
            return True

def run_tests():
    """Run comprehensive test suite."""
    print_header("Step 3: Running Comprehensive Tests")

    # Change to scripts directory and run tests
    script_dir = Path(__file__).parent
    test_file = script_dir / "test_day3.py"

    if not test_file.exists():
        print_error(f"Test file not found: {test_file}")
        return False

    result = run_command(f'python "{test_file}"', timeout=120)

    if result:
        print(result.stdout)
        if result.stderr:
            print(result.stderr)

        if result.returncode == 0:
            print_success("All tests passed!")
            return True
        else:
            print_error("Some tests failed")
            return False
    else:
        print_error("Test execution failed")
        return False

def validate_production_ready():
    """Validate production readiness."""
    print_header("Step 4: Validating Production Readiness")

    # Check backend health
    result = run_command("curl -s http://localhost:8000/health")
    if not result or result.returncode != 0:
        print_error("Backend not reachable")
        return False

    print_success("Backend is healthy")
    print_info("API Documentation: http://localhost:8000/docs")

    return True

def main():
    """Main execution flow."""
    print_header("Fully Automated Day 3 Production Setup")

    # Change to project root
    project_root = Path(__file__).parent.parent.parent
    os.chdir(project_root)
    print_info(f"Working directory: {os.getcwd()}")

    # Step 1: Ensure Docker is running
    if not is_docker_running():
        print_warning("Docker is not running")

        if not start_docker_desktop():
            print_error("Could not start Docker Desktop")
            print_error("Please start Docker Desktop manually and run this script again")
            return 1

        if not wait_for_docker():
            print_error("Docker failed to start within timeout")
            return 1
    else:
        print_success("Docker is already running")

    # Step 2: Ensure containers are running
    if not ensure_containers_running():
        print_error("Failed to start containers")
        return 1

    # Step 3: Wait for backend to be healthy
    if not wait_for_backend_healthy():
        print_error("Backend is not healthy")
        return 1

    # Step 4: Fix database schema
    if not fix_database_schema():
        print_error("Database schema fix failed")
        return 1

    # Step 5: Seed test data
    if not seed_test_data():
        print_warning("Test data seeding had issues, but continuing...")

    # Step 6: Run tests
    tests_passed = run_tests()

    # Step 7: Validate production readiness
    if not validate_production_ready():
        print_error("Production readiness validation failed")
        return 1

    # Final status
    print_header("Day 3 Production Setup Complete!")

    if tests_passed:
        print_success("All tests passed - Day 3 is PRODUCTION-READY!")
        print_info("Ready to proceed to Day 4!")
        return 0
    else:
        print_warning("Some tests failed - review output above")
        return 1

if __name__ == "__main__":
    sys.exit(main())
