#!/usr/bin/env python3
"""
Comprehensive Test Suite for Day 4: Prompts Management API

Tests all endpoints with authentication, validation, and error cases.

Usage:
    python test_day4.py

Requirements:
    - Backend running at http://localhost:8000
    - Admin credentials in .env file
"""

import requests
import sys
from typing import Dict, Any

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
        self.created_prompt_id = None
        self.created_variable_id = None

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

    def test_list_prompts_empty(self) -> bool:
        """Test: GET /admin/prompts/ (should be empty initially)"""
        print_test("List all prompts (should be empty)")

        try:
            response = self.session.get(f"{BASE_URL}/admin/prompts/")

            if response.status_code == 200:
                prompts = response.json()
                print_pass(f"Retrieved {len(prompts)} prompt(s)")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_create_prompt(self) -> bool:
        """Test: POST /admin/prompts/"""
        print_test("Create new prompt with variables")

        payload = {
            "name": "test_summarization",
            "function_type": "summarization",
            "template": "Summarize the following article:\n\nTitle: {title}\nContent: {content}\n\nProvide a {style} summary.",
            "temperature": 0.7,
            "max_tokens": 500,
            "variables": [
                {
                    "name": "title",
                    "description": "Article title",
                    "is_required": True
                },
                {
                    "name": "content",
                    "description": "Article content",
                    "is_required": True
                },
                {
                    "name": "style",
                    "description": "Summary style",
                    "default_value": "concise",
                    "is_required": False
                }
            ]
        }

        try:
            response = self.session.post(
                f"{BASE_URL}/admin/prompts/",
                json=payload
            )

            if response.status_code == 201:
                data = response.json()
                self.created_prompt_id = data.get("id")
                print_pass(f"Created prompt: {data['name']} (ID: {self.created_prompt_id})")
                print_info(f"Version: {data['version']}")
                print_info(f"Variables: {len(data['variables'])}")
                return True
            elif response.status_code == 409:
                print_info("Prompt already exists (conflict)")
                # Try to get existing prompt
                list_response = self.session.get(f"{BASE_URL}/admin/prompts/")
                if list_response.status_code == 200:
                    prompts = list_response.json()
                    if prompts:
                        self.created_prompt_id = prompts[0]["id"]
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_get_prompt(self) -> bool:
        """Test: GET /admin/prompts/{prompt_id}"""
        print_test("Get specific prompt")

        if not self.created_prompt_id:
            print_fail("No prompt ID available (create test failed)")
            return False

        try:
            response = self.session.get(
                f"{BASE_URL}/admin/prompts/{self.created_prompt_id}"
            )

            if response.status_code == 200:
                data = response.json()
                print_pass(f"Retrieved: {data['name']}")
                print_info(f"Template length: {len(data['template'])} chars")
                print_info(f"Variables: {len(data['variables'])}")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_update_prompt(self) -> bool:
        """Test: PATCH /admin/prompts/{prompt_id}"""
        print_test("Update prompt (should increment version)")

        if not self.created_prompt_id:
            print_fail("No prompt ID available")
            return False

        payload = {
            "template": "UPDATED: Summarize the following article:\n\nTitle: {title}\nContent: {content}\n\nProvide a {style} summary with key points.",
            "max_tokens": 800
        }

        try:
            response = self.session.patch(
                f"{BASE_URL}/admin/prompts/{self.created_prompt_id}",
                json=payload
            )

            if response.status_code == 200:
                data = response.json()
                print_pass(f"Updated: {data['name']}")
                print_info(f"New version: {data['version']}")
                print_info(f"Max tokens: {data['max_tokens']}")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_list_prompts_with_results(self) -> bool:
        """Test: GET /admin/prompts/ (should have results now)"""
        print_test("List all prompts (should have results)")

        try:
            response = self.session.get(f"{BASE_URL}/admin/prompts/")

            if response.status_code == 200:
                prompts = response.json()
                print_pass(f"Retrieved {len(prompts)} prompt(s)")
                if prompts:
                    print_info(f"First prompt: {prompts[0]['name']}")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_list_prompt_variables(self) -> bool:
        """Test: GET /admin/prompts/{prompt_id}/variables"""
        print_test("List prompt variables")

        if not self.created_prompt_id:
            print_fail("No prompt ID available")
            return False

        try:
            response = self.session.get(
                f"{BASE_URL}/admin/prompts/{self.created_prompt_id}/variables"
            )

            if response.status_code == 200:
                variables = response.json()
                print_pass(f"Retrieved {len(variables)} variable(s)")
                for var in variables:
                    print_info(f"- {var['name']}: {var['description']}")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_add_variable(self) -> bool:
        """Test: POST /admin/prompts/{prompt_id}/variables"""
        print_test("Add new variable to prompt")

        if not self.created_prompt_id:
            print_fail("No prompt ID available")
            return False

        # First update the template to include a new variable
        update_payload = {
            "template": "Summarize the following article:\n\nTitle: {title}\nContent: {content}\n\nProvide a {style} summary with {detail_level} detail.",
        }

        update_response = self.session.patch(
            f"{BASE_URL}/admin/prompts/{self.created_prompt_id}",
            json=update_payload
        )

        if update_response.status_code != 200:
            print_fail(f"Failed to update template: {update_response.text}")
            return False

        # Now add the variable
        payload = {
            "name": "detail_level",
            "description": "Level of detail (high/medium/low)",
            "default_value": "medium",
            "is_required": False
        }

        try:
            response = self.session.post(
                f"{BASE_URL}/admin/prompts/{self.created_prompt_id}/variables",
                json=payload
            )

            if response.status_code == 201:
                data = response.json()
                self.created_variable_id = data.get("id")
                print_pass(f"Added variable: {data['name']}")
                return True
            elif response.status_code == 409:
                print_info("Variable already exists")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_update_variable(self) -> bool:
        """Test: PATCH /admin/prompts/{prompt_id}/variables/{variable_id}"""
        print_test("Update variable")

        if not self.created_prompt_id or not self.created_variable_id:
            print_fail("No prompt/variable ID available")
            return False

        payload = {
            "description": "Updated: Level of detail for the summary",
            "default_value": "high"
        }

        try:
            response = self.session.patch(
                f"{BASE_URL}/admin/prompts/{self.created_prompt_id}/variables/{self.created_variable_id}",
                json=payload
            )

            if response.status_code == 200:
                data = response.json()
                print_pass(f"Updated variable: {data['name']}")
                print_info(f"New default: {data['default_value']}")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_preview_prompt(self) -> bool:
        """Test: POST /admin/prompts/preview"""
        print_test("Preview prompt with variable substitution")

        payload = {
            "template": "Hello {name}, your order total is ${amount}. Thank you for shopping with {store}!",
            "variables": {
                "name": "John",
                "amount": "99.99",
                "store": "TestStore"
            }
        }

        try:
            response = self.session.post(
                f"{BASE_URL}/admin/prompts/preview",
                json=payload
            )

            if response.status_code == 200:
                data = response.json()
                print_pass("Preview generated successfully")
                print_info(f"Variable count: {data['variable_count']}")
                print_info(f"Missing variables: {data['missing_variables']}")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_list_versions(self) -> bool:
        """Test: GET /admin/prompts/{prompt_id}/versions"""
        print_test("List prompt versions")

        if not self.created_prompt_id:
            print_fail("No prompt ID available")
            return False

        try:
            response = self.session.get(
                f"{BASE_URL}/admin/prompts/{self.created_prompt_id}/versions"
            )

            if response.status_code == 200:
                versions = response.json()
                print_pass(f"Retrieved {len(versions)} version(s)")
                for v in versions:
                    print_info(f"Version {v['version']}: {v['name']}")
                return True
            else:
                print_fail(f"Failed: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_delete_variable(self) -> bool:
        """Test: DELETE /admin/prompts/{prompt_id}/variables/{variable_id}"""
        print_test("Delete variable")

        if not self.created_prompt_id or not self.created_variable_id:
            print_fail("No prompt/variable ID available")
            return False

        try:
            response = self.session.delete(
                f"{BASE_URL}/admin/prompts/{self.created_prompt_id}/variables/{self.created_variable_id}"
            )

            if response.status_code == 200:
                data = response.json()
                print_pass(f"Deleted variable: {data['message']}")
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
                f"{BASE_URL}/admin/prompts/99999"
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
            response = requests.get(f"{BASE_URL}/admin/prompts/")

            if response.status_code in [401, 403]:
                print_pass(f"Unauthorized access blocked correctly ({response.status_code})")
                return True
            else:
                print_fail(f"Expected 401 or 403, got {response.status_code}")
                return False

        except Exception as e:
            print_fail(f"Error: {e}")
            return False

    def test_delete_prompt(self) -> bool:
        """Test: DELETE /admin/prompts/{prompt_id}"""
        print_test("Delete prompt")

        if not self.created_prompt_id:
            print_fail("No prompt ID available")
            return False

        try:
            response = self.session.delete(
                f"{BASE_URL}/admin/prompts/{self.created_prompt_id}"
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

    def run_all_tests(self):
        """Run all tests."""
        print(f"\n{'='*60}")
        print(f"{Colors.BLUE}Prompts Management API Test Suite (Day 4){Colors.END}")
        print(f"{'='*60}")

        tests = [
            ("Login", self.login),
            ("List Prompts (Empty)", self.test_list_prompts_empty),
            ("Create Prompt", self.test_create_prompt),
            ("Get Prompt", self.test_get_prompt),
            ("Update Prompt", self.test_update_prompt),
            ("List Prompts (With Results)", self.test_list_prompts_with_results),
            ("List Variables", self.test_list_prompt_variables),
            ("Add Variable", self.test_add_variable),
            ("Update Variable", self.test_update_variable),
            ("Preview Prompt", self.test_preview_prompt),
            ("List Versions", self.test_list_versions),
            ("Delete Variable", self.test_delete_variable),
            ("404 Error Handling", self.test_404_error),
            ("Unauthorized Access", self.test_unauthorized),
            ("Delete Prompt", self.test_delete_prompt),
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
