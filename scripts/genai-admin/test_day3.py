#!/usr/bin/env python3
"""
Comprehensive Test Suite for Day 3: GenAI Functions API

Tests all endpoints with authentication, validation, and error cases.

Usage:
    python test_day3.py

Requirements:
    - Backend running at http://localhost:8000
    - Admin credentials in .env file
    - Sample data seeded (prompts)
"""

import requests
import sys
from typing import Dict, Any
import json

# Configuration
BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@huntsphere.local"
ADMIN_PASSWORD = "Admin123!@2026"

# Color codes
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'


def print_test(name: str):
    """Print test name."""
    print(f"\n{Colors.BLUE}[TEST]{Colors.END} {name}")


def print_pass(message: str):
    """Print success message."""
    print(f"{Colors.GREEN}+{Colors.END} {message}")


def print_fail(message: str):
    """Print failure message."""
    print(f"{Colors.RED}-{Colors.END} {message}")


def print_info(message: str):
    """Print info message."""
    print(f"{Colors.YELLOW}*{Colors.END} {message}")


class TestSession:
    """Test session with authentication."""

    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.test_function_name = "test_summarization"
        self.created_function_id = None

    def login(self) -> bool:
        """Login as admin."""
        print_test("Logging in as admin")

        try:
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json={
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD
                }
            )

            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.session.headers.update({
                    "Authorization": f"Bearer {self.token}"
                })
                print_pass(f"Logged in successfully")
                return True
            else:
                print_fail(f"Login failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Login error: {e}")
            return False

    def test_list_functions(self) -> bool:
        """Test: GET /admin/genai/functions/"""
        print_test("List all function configurations")

        try:
            response = self.session.get(f"{BASE_URL}/admin/genai/functions/")

            if response.status_code == 200:
                functions = response.json()
                print_pass(f"Retrieved {len(functions)} function(s)")

                if functions:
                    print_info(f"Sample function: {functions[0]['function_name']}")

                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_create_function(self) -> bool:
        """Test: POST /admin/genai/functions/"""
        print_test("Create new function configuration")

        payload = {
            "function_name": self.test_function_name,
            "display_name": "Test Summarization",
            "description": "Test function for article summarization",
            "primary_model_id": "gpt-4o-mini",
            "secondary_model_id": "llama3.1:8b"
        }

        try:
            response = self.session.post(
                f"{BASE_URL}/admin/genai/functions/",
                json=payload
            )

            if response.status_code == 201:
                data = response.json()
                self.created_function_id = data.get("id")
                print_pass(f"Created function: {data['function_name']} (ID: {self.created_function_id})")
                print_info(f"Primary model: {data['primary_model_id']}")
                print_info(f"Secondary model: {data['secondary_model_id']}")
                return True
            elif response.status_code == 409:
                print_info("Function already exists (conflict)")
                return True  # Not a failure, just already exists
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_get_function(self) -> bool:
        """Test: GET /admin/genai/functions/{function_name}"""
        print_test("Get specific function configuration")

        try:
            response = self.session.get(
                f"{BASE_URL}/admin/genai/functions/{self.test_function_name}"
            )

            if response.status_code == 200:
                data = response.json()
                print_pass(f"Retrieved: {data['display_name']}")
                print_info(f"Total requests: {data['total_requests']}")
                print_info(f"Total cost: ${data['total_cost']:.4f}")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_update_function(self) -> bool:
        """Test: PATCH /admin/genai/functions/{function_name}"""
        print_test("Update function configuration")

        payload = {
            "display_name": "Updated Test Summarization",
            "primary_model_id": "gpt-4o"
        }

        try:
            response = self.session.patch(
                f"{BASE_URL}/admin/genai/functions/{self.test_function_name}",
                json=payload
            )

            if response.status_code == 200:
                data = response.json()
                print_pass(f"Updated: {data['display_name']}")
                print_info(f"New primary model: {data['primary_model_id']}")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_get_stats(self) -> bool:
        """Test: GET /admin/genai/functions/{function_name}/stats"""
        print_test("Get function usage statistics")

        try:
            response = self.session.get(
                f"{BASE_URL}/admin/genai/functions/{self.test_function_name}/stats?days=30"
            )

            if response.status_code == 200:
                stats = response.json()
                print_pass("Retrieved statistics")
                print_info(f"Requests (24h): {stats['requests_last_24h']}")
                print_info(f"Requests (7d): {stats['requests_last_7d']}")
                print_info(f"Requests (30d): {stats['requests_last_30d']}")
                print_info(f"Success rate: {stats['success_rate']:.1f}%")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_get_recommendations(self) -> bool:
        """Test: GET /admin/genai/functions/{function_name}/recommendations"""
        print_test("Get model recommendations")

        try:
            response = self.session.get(
                f"{BASE_URL}/admin/genai/functions/{self.test_function_name}/recommendations"
            )

            if response.status_code == 200:
                recommendations = response.json()
                print_pass(f"Retrieved {len(recommendations)} recommendation(s)")

                for i, rec in enumerate(recommendations, 1):
                    print_info(f"{i}. {rec['model_id']} ({rec['speed']}/{rec['quality']}) - ${rec['estimated_cost_per_1k']:.2f}/1k")

                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_reset_stats(self) -> bool:
        """Test: POST /admin/genai/functions/{function_name}/reset-stats"""
        print_test("Reset function statistics")

        try:
            response = self.session.post(
                f"{BASE_URL}/admin/genai/functions/{self.test_function_name}/reset-stats"
            )

            if response.status_code == 200:
                data = response.json()
                print_pass(f"Stats reset: {data['message']}")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_delete_function(self) -> bool:
        """Test: DELETE /admin/genai/functions/{function_name}"""
        print_test("Delete function configuration")

        try:
            response = self.session.delete(
                f"{BASE_URL}/admin/genai/functions/{self.test_function_name}"
            )

            if response.status_code == 200:
                data = response.json()
                print_pass(f"Deleted: {data['message']}")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_404_error(self) -> bool:
        """Test: 404 error handling"""
        print_test("Test 404 error handling")

        try:
            response = self.session.get(
                f"{BASE_URL}/admin/genai/functions/nonexistent_function"
            )

            if response.status_code == 404:
                print_pass("404 error handled correctly")
                return True
            else:
                print_fail(f"Expected 404, got {response.status_code}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_unauthorized(self) -> bool:
        """Test: Unauthorized access (no token)"""
        print_test("Test unauthorized access")

        try:
            response = requests.get(f"{BASE_URL}/admin/genai/functions/")

            if response.status_code in [401, 403]:
                print_pass(f"Unauthorized access blocked correctly ({response.status_code})")
                return True
            else:
                print_fail(f"Expected 401 or 403, got {response.status_code}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def run_all_tests(self):
        """Run all tests."""
        print(f"\n{'='*60}")
        print(f"{Colors.BLUE}GenAI Functions API Test Suite (Day 3){Colors.END}")
        print(f"{'='*60}")

        tests = [
            ("Login", self.login),
            ("List Functions", self.test_list_functions),
            ("Create Function", self.test_create_function),
            ("Get Function", self.test_get_function),
            ("Update Function", self.test_update_function),
            ("Get Statistics", self.test_get_stats),
            ("Get Recommendations", self.test_get_recommendations),
            ("Reset Statistics", self.test_reset_stats),
            ("404 Error Handling", self.test_404_error),
            ("Unauthorized Access", self.test_unauthorized),
            ("Delete Function", self.test_delete_function),
        ]

        passed = 0
        failed = 0

        for name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print_fail(f"Test '{name}' crashed: {e}")
                failed += 1

        # Summary
        print(f"\n{'='*60}")
        print(f"{Colors.BLUE}Test Summary{Colors.END}")
        print(f"{'='*60}")
        print(f"{Colors.GREEN}Passed:{Colors.END} {passed}/{len(tests)}")
        print(f"{Colors.RED}Failed:{Colors.END} {failed}/{len(tests)}")

        if failed == 0:
            print(f"\n{Colors.GREEN}+ All tests passed!{Colors.END}")
            return 0
        else:
            print(f"\n{Colors.RED}- Some tests failed{Colors.END}")
            return 1


if __name__ == "__main__":
    test_session = TestSession()
    exit_code = test_session.run_all_tests()
    sys.exit(exit_code)
