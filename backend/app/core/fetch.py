from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional
from urllib.parse import urljoin

import httpx

from app.core.logging import logger
from app.core.ssrf import SSRFError, SSRFPolicy, validate_outbound_url


class FetchError(RuntimeError):
    """Raised for safe fetch failures (network, size limit, or policy)."""


@dataclass(frozen=True)
class FetchResult:
    url: str
    final_url: str
    status_code: int
    headers: Dict[str, str]
    text: str
    content: bytes


async def safe_fetch_text_async(
    url: str,
    *,
    policy: SSRFPolicy,
    client: Optional[httpx.AsyncClient] = None,
    headers: Optional[Dict[str, str]] = None,
    cookies: Optional[Dict[str, str]] = None,
    auth: Optional[httpx.Auth] = None,
    timeout_seconds: float = 15.0,
    max_bytes: int = 2_000_000,
) -> FetchResult:
    validate_outbound_url(url, policy=policy)

    request_headers = headers or {}
    redirects = 0
    current_url = url

    async def _run(active_client: httpx.AsyncClient) -> FetchResult:
        nonlocal redirects, current_url
        while True:
            try:
                response = await active_client.get(current_url, headers=request_headers, cookies=cookies, auth=auth)
            except Exception as e:
                logger.warning("safe_fetch_failed", url=current_url, error=str(e))
                raise FetchError("Failed to fetch URL") from e

            if response.status_code in (301, 302, 303, 307, 308) and response.headers.get("location"):
                redirects += 1
                if redirects > policy.max_redirects:
                    raise FetchError("Too many redirects")

                next_url = urljoin(str(response.url), response.headers["location"])
                validate_outbound_url(next_url, policy=policy)
                current_url = next_url
                continue

            if response.status_code >= 400:
                raise FetchError(f"Upstream returned status {response.status_code}")

            content = b""
            async for chunk in response.aiter_bytes():
                content += chunk
                if len(content) > max_bytes:
                    raise FetchError("Response too large")

            return FetchResult(
                url=url,
                final_url=str(response.url),
                status_code=response.status_code,
                headers=dict(response.headers),
                text=content.decode(response.encoding or "utf-8", errors="replace"),
                content=content,
            )

    if client is not None:
        return await _run(client)

    async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=False) as new_client:
        return await _run(new_client)


def safe_fetch_text_sync(
    url: str,
    *,
    policy: SSRFPolicy,
    client: Optional[httpx.Client] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout_seconds: float = 15.0,
    max_bytes: int = 2_000_000,
) -> FetchResult:
    validate_outbound_url(url, policy=policy)

    request_headers = headers or {}
    redirects = 0
    current_url = url

    def _run(active_client: httpx.Client) -> FetchResult:
        nonlocal redirects, current_url
        while True:
            try:
                response = active_client.get(current_url, headers=request_headers)
            except Exception as e:
                logger.warning("safe_fetch_failed", url=current_url, error=str(e))
                raise FetchError("Failed to fetch URL") from e

            if response.status_code in (301, 302, 303, 307, 308) and response.headers.get("location"):
                redirects += 1
                if redirects > policy.max_redirects:
                    raise FetchError("Too many redirects")

                next_url = urljoin(str(response.url), response.headers["location"])
                validate_outbound_url(next_url, policy=policy)
                current_url = next_url
                continue

            if response.status_code >= 400:
                raise FetchError(f"Upstream returned status {response.status_code}")

            content = response.content
            if len(content) > max_bytes:
                raise FetchError("Response too large")

            return FetchResult(
                url=url,
                final_url=str(response.url),
                status_code=response.status_code,
                headers=dict(response.headers),
                text=response.text,
                content=response.content,
            )

    if client is not None:
        return _run(client)

    with httpx.Client(timeout=timeout_seconds, follow_redirects=False) as new_client:
        return _run(new_client)
