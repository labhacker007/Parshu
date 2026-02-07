from __future__ import annotations

import ipaddress
import re
import socket
from dataclasses import dataclass
from typing import Optional, Sequence
from urllib.parse import urlparse

from app.core.config import settings


_DEFAULT_ALLOWED_PORTS = {80, 443}
_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-"
    r"[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{12}$"
)


class SSRFError(ValueError):
    """Raised when an outbound URL fails SSRF validation."""


@dataclass(frozen=True)
class SSRFPolicy:
    allow_private_ips: bool = False
    allow_loopback_ips: bool = False
    enforce_domain_allowlist: bool = False
    allowlist_domains: Sequence[str] = ()
    allowed_ports: Optional[set[int]] = None
    max_redirects: int = 5

    def normalized_allowlist(self) -> tuple[str, ...]:
        return tuple(_normalize_domain(d) for d in self.allowlist_domains if d and d.strip())

    def ports(self) -> set[int]:
        return set(self.allowed_ports) if self.allowed_ports is not None else set(_DEFAULT_ALLOWED_PORTS)


def _normalize_domain(domain: str) -> str:
    domain = domain.strip().lower()
    if domain.startswith("."):
        domain = domain[1:]
    return domain


def _host_in_allowlist(host: str, allowlist_domains: Sequence[str]) -> bool:
    host = _normalize_domain(host)
    for allowed in allowlist_domains:
        allowed = _normalize_domain(allowed)
        if not allowed:
            continue
        if host == allowed or host.endswith(f".{allowed}"):
            return True
    return False


def resolve_host_ips(host: str) -> list[ipaddress._BaseAddress]:
    """Resolve a hostname to IP addresses (IPv4/IPv6)."""
    # Avoid resolving empty/None
    if not host:
        return []
    infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    ips: list[ipaddress._BaseAddress] = []
    for family, _, _, _, sockaddr in infos:
        if family == socket.AF_INET:
            ips.append(ipaddress.ip_address(sockaddr[0]))
        elif family == socket.AF_INET6:
            ips.append(ipaddress.ip_address(sockaddr[0]))
    return ips


def is_ip_allowed(ip: ipaddress._BaseAddress, *, allow_private: bool, allow_loopback: bool) -> bool:
    # Always deny clearly unsafe targets
    if ip.is_loopback and not allow_loopback:
        return False
    if ip.is_link_local or ip.is_multicast or ip.is_unspecified:
        return False
    # is_private covers RFC1918 (v4) and ULA (v6). Some environments may choose to allow this explicitly.
    if ip.is_private and not allow_private:
        return False
    # is_reserved: includes various special-use ranges; default deny.
    if getattr(ip, "is_reserved", False):
        return False
    return True


def validate_outbound_url(url: str, *, policy: SSRFPolicy) -> None:
    """Validate a URL against SSRF policy. Raises SSRFError on failure."""
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise SSRFError("Only http/https URLs are allowed")

    if not parsed.hostname:
        raise SSRFError("URL host is missing")

    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port not in policy.ports():
        raise SSRFError("URL port is not allowed")

    allowlist = policy.normalized_allowlist()
    if policy.enforce_domain_allowlist and allowlist:
        if not _host_in_allowlist(parsed.hostname, allowlist):
            raise SSRFError("URL host is not in allowlist")

    # IP literal: validate directly
    try:
        ip = ipaddress.ip_address(parsed.hostname)
        if not is_ip_allowed(ip, allow_private=policy.allow_private_ips, allow_loopback=policy.allow_loopback_ips):
            raise SSRFError("URL host resolves to a blocked IP range")
        return
    except ValueError:
        pass

    # Hostname: resolve and validate all A/AAAA records (basic DNS rebinding mitigation)
    ips = resolve_host_ips(parsed.hostname)
    if not ips:
        raise SSRFError("URL host could not be resolved")
    for ip in ips:
        if not is_ip_allowed(ip, allow_private=policy.allow_private_ips, allow_loopback=policy.allow_loopback_ips):
            raise SSRFError("URL host resolves to a blocked IP range")


def normalize_path_for_rate_limit(path: str) -> str:
    """
    Reduce path cardinality for rate limiting (mitigates memory DoS).
    Replaces UUID and numeric path segments with placeholders.
    """
    parts = [p for p in path.split("/") if p]
    normalized: list[str] = []
    for part in parts:
        if _UUID_RE.match(part):
            normalized.append("{uuid}")
        elif part.isdigit():
            normalized.append("{id}")
        else:
            normalized.append(part)
    return "/" + "/".join(normalized)


def ssrf_policy_from_settings(
    *,
    allow_private_ips: Optional[bool] = None,
    enforce_allowlist: Optional[bool] = None,
) -> SSRFPolicy:
    if allow_private_ips is None:
        allow_private_ips = bool(getattr(settings, "SSRF_ALLOW_PRIVATE_IPS", False))
    allowlist = [d.strip() for d in (settings.SSRF_ALLOWLIST_DOMAINS or "").split(",") if d.strip()]
    enforce = enforce_allowlist
    if enforce is None:
        # Default: enforce allowlist in production-like mode only if allowlist is provided.
        enforce = (settings.ENV == "prod") and bool(allowlist)

    ports: set[int] = set()
    for p in (settings.SSRF_ALLOWED_PORTS or "80,443").split(","):
        p = p.strip()
        if not p:
            continue
        try:
            ports.add(int(p))
        except ValueError:
            continue
    if not ports:
        ports = set(_DEFAULT_ALLOWED_PORTS)

    return SSRFPolicy(
        allow_private_ips=allow_private_ips,
        allow_loopback_ips=False,
        enforce_domain_allowlist=enforce,
        allowlist_domains=tuple(allowlist),
        allowed_ports=ports,
    )
