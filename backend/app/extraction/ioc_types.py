"""
Comprehensive IOC (Indicator of Compromise) Types Definition for Cybersecurity.

This file serves as the authoritative guardrail for IOC extraction across the entire
HuntSphere platform - both manual and automated extraction processes.

Categories:
1. Network Indicators
2. Host-Based Indicators  
3. File Indicators
4. Email Indicators
5. Cryptographic Indicators
6. Identity & Authentication Indicators
7. Cloud & Infrastructure Indicators
8. Behavioral Indicators
9. Threat Intelligence Identifiers
"""

from enum import Enum
from typing import Dict, List, Optional
from dataclasses import dataclass


class IOCCategory(str, Enum):
    """High-level IOC categories."""
    NETWORK = "NETWORK"
    HOST = "HOST"
    FILE = "FILE"
    EMAIL = "EMAIL"
    CRYPTOGRAPHIC = "CRYPTOGRAPHIC"
    IDENTITY = "IDENTITY"
    CLOUD = "CLOUD"
    BEHAVIORAL = "BEHAVIORAL"
    THREAT_INTEL = "THREAT_INTEL"


class IOCType(str, Enum):
    """
    Comprehensive enumeration of all IOC types supported in cybersecurity.
    This serves as the guardrail for all extraction across the platform.
    """
    
    # =========================================================================
    # NETWORK INDICATORS
    # =========================================================================
    IP_ADDRESS = "IP_ADDRESS"              # IPv4 address
    IPV6_ADDRESS = "IPV6_ADDRESS"          # IPv6 address
    CIDR_BLOCK = "CIDR_BLOCK"              # IP range in CIDR notation
    DOMAIN = "DOMAIN"                       # Domain name
    SUBDOMAIN = "SUBDOMAIN"                 # Subdomain
    URL = "URL"                             # Full URL
    URI = "URI"                             # URI path
    HOSTNAME = "HOSTNAME"                   # Hostname
    PORT = "PORT"                           # Network port
    PROTOCOL = "PROTOCOL"                   # Network protocol
    ASN = "ASN"                             # Autonomous System Number
    NETWORK_RANGE = "NETWORK_RANGE"         # Network range
    MAC_ADDRESS = "MAC_ADDRESS"             # MAC address
    USER_AGENT = "USER_AGENT"               # HTTP User-Agent string
    HTTP_HEADER = "HTTP_HEADER"             # HTTP header
    DNS_RECORD = "DNS_RECORD"               # DNS record
    
    # TLS/SSL Indicators
    JA3_FINGERPRINT = "JA3_FINGERPRINT"     # TLS client fingerprint
    JA3S_FINGERPRINT = "JA3S_FINGERPRINT"   # TLS server fingerprint
    JARM_FINGERPRINT = "JARM_FINGERPRINT"   # Active TLS fingerprint
    SSL_CERT_SERIAL = "SSL_CERT_SERIAL"     # SSL certificate serial number
    SSL_CERT_SHA1 = "SSL_CERT_SHA1"         # SSL cert SHA1 thumbprint
    SSL_CERT_SHA256 = "SSL_CERT_SHA256"     # SSL cert SHA256 thumbprint
    SSL_ISSUER = "SSL_ISSUER"               # SSL certificate issuer
    SSL_SUBJECT = "SSL_SUBJECT"             # SSL certificate subject
    SSH_FINGERPRINT = "SSH_FINGERPRINT"     # SSH key fingerprint
    
    # =========================================================================
    # HOST-BASED INDICATORS
    # =========================================================================
    FILE_PATH = "FILE_PATH"                 # Full file path
    DIRECTORY_PATH = "DIRECTORY_PATH"       # Directory path
    FILENAME = "FILENAME"                   # File name
    FILE_EXTENSION = "FILE_EXTENSION"       # File extension
    PROCESS_NAME = "PROCESS_NAME"           # Process name
    PROCESS_CMDLINE = "PROCESS_CMDLINE"     # Process command line
    SERVICE_NAME = "SERVICE_NAME"           # Windows/Linux service name
    
    # Windows-specific
    REGISTRY_KEY = "REGISTRY_KEY"           # Windows registry key
    REGISTRY_VALUE = "REGISTRY_VALUE"       # Windows registry value
    MUTEX = "MUTEX"                         # Mutex name
    NAMED_PIPE = "NAMED_PIPE"               # Named pipe
    SCHEDULED_TASK = "SCHEDULED_TASK"       # Scheduled task name
    WMI_QUERY = "WMI_QUERY"                 # WMI query
    COM_OBJECT = "COM_OBJECT"               # COM object CLSID
    DRIVER_NAME = "DRIVER_NAME"             # Kernel driver name
    
    # Unix/Linux-specific
    CRON_JOB = "CRON_JOB"                   # Cron job entry
    SYSTEMD_UNIT = "SYSTEMD_UNIT"           # Systemd unit name
    
    # =========================================================================
    # FILE INDICATORS (HASHES & SIGNATURES)
    # =========================================================================
    MD5_HASH = "MD5_HASH"                   # MD5 file hash
    SHA1_HASH = "SHA1_HASH"                 # SHA1 file hash
    SHA256_HASH = "SHA256_HASH"             # SHA256 file hash
    SHA512_HASH = "SHA512_HASH"             # SHA512 file hash
    SSDEEP_HASH = "SSDEEP_HASH"             # Fuzzy hash
    IMPHASH = "IMPHASH"                     # Import hash
    AUTHENTIHASH = "AUTHENTIHASH"           # Authenticode hash
    PEHASH = "PEHASH"                       # PE structural hash
    TLSH = "TLSH"                           # Trend Locality Sensitive Hash
    VHASH = "VHASH"                         # VirusTotal hash
    
    # File metadata
    FILE_SIZE = "FILE_SIZE"                 # File size
    FILE_TYPE = "FILE_TYPE"                 # MIME type / file type
    MAGIC_BYTES = "MAGIC_BYTES"             # File magic bytes
    COMPILE_TIME = "COMPILE_TIME"           # PE compile timestamp
    PDB_PATH = "PDB_PATH"                   # PDB debug path
    VERSION_INFO = "VERSION_INFO"           # PE version info
    DIGITAL_SIGNATURE = "DIGITAL_SIGNATURE" # Code signing info
    
    # =========================================================================
    # EMAIL INDICATORS
    # =========================================================================
    EMAIL_ADDRESS = "EMAIL_ADDRESS"         # Email address
    EMAIL_SUBJECT = "EMAIL_SUBJECT"         # Email subject line
    EMAIL_SENDER = "EMAIL_SENDER"           # Email sender
    EMAIL_HEADER = "EMAIL_HEADER"           # Email header
    EMAIL_BODY_HASH = "EMAIL_BODY_HASH"     # Hash of email body
    ATTACHMENT_NAME = "ATTACHMENT_NAME"     # Attachment filename
    ATTACHMENT_HASH = "ATTACHMENT_HASH"     # Attachment hash
    SPF_RECORD = "SPF_RECORD"               # SPF record
    DKIM_SIGNATURE = "DKIM_SIGNATURE"       # DKIM signature
    DMARC_RECORD = "DMARC_RECORD"           # DMARC record
    MESSAGE_ID = "MESSAGE_ID"               # Email Message-ID
    REPLY_TO = "REPLY_TO"                   # Reply-To address
    RETURN_PATH = "RETURN_PATH"             # Return-Path
    X_ORIGINATING_IP = "X_ORIGINATING_IP"   # X-Originating-IP
    
    # =========================================================================
    # CRYPTOGRAPHIC INDICATORS
    # =========================================================================
    ENCRYPTION_KEY = "ENCRYPTION_KEY"       # Encryption key
    PUBLIC_KEY = "PUBLIC_KEY"               # Public key
    PRIVATE_KEY = "PRIVATE_KEY"             # Private key (leaked)
    CERTIFICATE = "CERTIFICATE"             # X.509 certificate
    CRYPTO_WALLET = "CRYPTO_WALLET"         # Cryptocurrency wallet
    BITCOIN_ADDRESS = "BITCOIN_ADDRESS"     # Bitcoin address
    ETHEREUM_ADDRESS = "ETHEREUM_ADDRESS"   # Ethereum address
    MONERO_ADDRESS = "MONERO_ADDRESS"       # Monero address
    RANSOMWARE_NOTE = "RANSOMWARE_NOTE"     # Ransomware note hash/content
    
    # =========================================================================
    # IDENTITY & AUTHENTICATION INDICATORS
    # =========================================================================
    USERNAME = "USERNAME"                   # Username
    PASSWORD_HASH = "PASSWORD_HASH"         # Password hash
    API_KEY = "API_KEY"                     # API key (exposed)
    ACCESS_TOKEN = "ACCESS_TOKEN"           # Access token
    SESSION_ID = "SESSION_ID"               # Session ID
    OAUTH_TOKEN = "OAUTH_TOKEN"             # OAuth token
    JWT_TOKEN = "JWT_TOKEN"                 # JWT token
    SSH_KEY = "SSH_KEY"                     # SSH key
    GPG_KEY = "GPG_KEY"                     # GPG key
    
    # =========================================================================
    # CLOUD & INFRASTRUCTURE INDICATORS
    # =========================================================================
    AWS_ACCESS_KEY = "AWS_ACCESS_KEY"       # AWS access key
    AWS_SECRET_KEY = "AWS_SECRET_KEY"       # AWS secret key
    AWS_ARN = "AWS_ARN"                     # AWS ARN
    AWS_S3_BUCKET = "AWS_S3_BUCKET"         # S3 bucket name
    AZURE_TENANT_ID = "AZURE_TENANT_ID"     # Azure tenant ID
    AZURE_CLIENT_ID = "AZURE_CLIENT_ID"     # Azure client ID
    GCP_PROJECT_ID = "GCP_PROJECT_ID"       # GCP project ID
    GCP_SERVICE_ACCOUNT = "GCP_SERVICE_ACCOUNT"  # GCP service account
    DOCKER_IMAGE = "DOCKER_IMAGE"           # Docker image reference
    CONTAINER_ID = "CONTAINER_ID"           # Container ID
    K8S_POD = "K8S_POD"                     # Kubernetes pod name
    
    # =========================================================================
    # BEHAVIORAL INDICATORS
    # =========================================================================
    YARA_RULE = "YARA_RULE"                 # YARA rule name
    SIGMA_RULE = "SIGMA_RULE"               # Sigma rule name
    SNORT_RULE = "SNORT_RULE"               # Snort rule
    SURICATA_RULE = "SURICATA_RULE"         # Suricata rule
    POWERSHELL_COMMAND = "POWERSHELL_COMMAND"  # PowerShell command
    BASH_COMMAND = "BASH_COMMAND"           # Bash command
    CMD_COMMAND = "CMD_COMMAND"             # CMD command
    ENCODED_PAYLOAD = "ENCODED_PAYLOAD"     # Base64/encoded payload
    WEBSHELL_SIGNATURE = "WEBSHELL_SIGNATURE"  # Webshell signature
    MALWARE_CONFIG = "MALWARE_CONFIG"       # Malware configuration
    C2_BEACON = "C2_BEACON"                 # C2 beacon pattern
    
    # =========================================================================
    # THREAT INTELLIGENCE IDENTIFIERS
    # =========================================================================
    CVE = "CVE"                             # CVE identifier
    CWE = "CWE"                             # CWE identifier
    CAPEC = "CAPEC"                         # CAPEC identifier
    MITRE_TECHNIQUE = "MITRE_TECHNIQUE"     # MITRE ATT&CK technique
    MITRE_TACTIC = "MITRE_TACTIC"           # MITRE ATT&CK tactic
    MITRE_GROUP = "MITRE_GROUP"             # MITRE threat group
    MITRE_SOFTWARE = "MITRE_SOFTWARE"       # MITRE software ID
    MITRE_ATLAS = "MITRE_ATLAS"             # MITRE ATLAS technique
    THREAT_ACTOR = "THREAT_ACTOR"           # Threat actor name
    CAMPAIGN = "CAMPAIGN"                   # Campaign name
    MALWARE_FAMILY = "MALWARE_FAMILY"       # Malware family name
    TOOL_NAME = "TOOL_NAME"                 # Attack tool name


@dataclass
class IOCTypeDefinition:
    """Detailed definition for an IOC type."""
    type: IOCType
    category: IOCCategory
    name: str
    description: str
    pattern: Optional[str] = None  # Regex pattern for extraction
    examples: Optional[List[str]] = None
    stix_type: Optional[str] = None  # STIX 2.1 mapping


# Comprehensive IOC type definitions with metadata
IOC_TYPE_DEFINITIONS: Dict[IOCType, IOCTypeDefinition] = {
    # Network indicators
    IOCType.IP_ADDRESS: IOCTypeDefinition(
        type=IOCType.IP_ADDRESS,
        category=IOCCategory.NETWORK,
        name="IPv4 Address",
        description="Internet Protocol version 4 address",
        pattern=r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b',
        examples=["192.168.1.1", "8.8.8.8", "10.0.0.1"],
        stix_type="ipv4-addr"
    ),
    IOCType.IPV6_ADDRESS: IOCTypeDefinition(
        type=IOCType.IPV6_ADDRESS,
        category=IOCCategory.NETWORK,
        name="IPv6 Address",
        description="Internet Protocol version 6 address",
        pattern=r'\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b|\b(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}\b',
        examples=["2001:0db8:85a3:0000:0000:8a2e:0370:7334"],
        stix_type="ipv6-addr"
    ),
    IOCType.DOMAIN: IOCTypeDefinition(
        type=IOCType.DOMAIN,
        category=IOCCategory.NETWORK,
        name="Domain Name",
        description="Fully qualified domain name",
        pattern=r'(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}',
        examples=["example.com", "malicious-domain.ru", "c2.badactor.net"],
        stix_type="domain-name"
    ),
    IOCType.URL: IOCTypeDefinition(
        type=IOCType.URL,
        category=IOCCategory.NETWORK,
        name="URL",
        description="Uniform Resource Locator",
        pattern=r'https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&/=]*)',
        examples=["https://malware.com/payload.exe", "http://192.168.1.1/shell.php"],
        stix_type="url"
    ),
    IOCType.EMAIL_ADDRESS: IOCTypeDefinition(
        type=IOCType.EMAIL_ADDRESS,
        category=IOCCategory.EMAIL,
        name="Email Address",
        description="Electronic mail address",
        pattern=r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        examples=["attacker@malicious.com", "phishing@fake-bank.com"],
        stix_type="email-addr"
    ),
    IOCType.MD5_HASH: IOCTypeDefinition(
        type=IOCType.MD5_HASH,
        category=IOCCategory.FILE,
        name="MD5 Hash",
        description="MD5 message-digest algorithm hash",
        pattern=r'\b[a-fA-F0-9]{32}\b',
        examples=["d41d8cd98f00b204e9800998ecf8427e"],
        stix_type="file:hashes.MD5"
    ),
    IOCType.SHA1_HASH: IOCTypeDefinition(
        type=IOCType.SHA1_HASH,
        category=IOCCategory.FILE,
        name="SHA1 Hash",
        description="SHA-1 cryptographic hash",
        pattern=r'\b[a-fA-F0-9]{40}\b',
        examples=["da39a3ee5e6b4b0d3255bfef95601890afd80709"],
        stix_type="file:hashes.SHA-1"
    ),
    IOCType.SHA256_HASH: IOCTypeDefinition(
        type=IOCType.SHA256_HASH,
        category=IOCCategory.FILE,
        name="SHA256 Hash",
        description="SHA-256 cryptographic hash",
        pattern=r'\b[a-fA-F0-9]{64}\b',
        examples=["e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
        stix_type="file:hashes.SHA-256"
    ),
    IOCType.CVE: IOCTypeDefinition(
        type=IOCType.CVE,
        category=IOCCategory.THREAT_INTEL,
        name="CVE Identifier",
        description="Common Vulnerabilities and Exposures identifier",
        pattern=r'CVE-\d{4}-\d{4,7}',
        examples=["CVE-2021-44228", "CVE-2023-12345"],
        stix_type="vulnerability"
    ),
    IOCType.MITRE_TECHNIQUE: IOCTypeDefinition(
        type=IOCType.MITRE_TECHNIQUE,
        category=IOCCategory.THREAT_INTEL,
        name="MITRE ATT&CK Technique",
        description="MITRE ATT&CK technique identifier",
        pattern=r'T\d{4}(?:\.\d{3})?',
        examples=["T1059", "T1059.001", "T1566.001"],
        stix_type="attack-pattern"
    ),
    IOCType.REGISTRY_KEY: IOCTypeDefinition(
        type=IOCType.REGISTRY_KEY,
        category=IOCCategory.HOST,
        name="Windows Registry Key",
        description="Windows registry path",
        pattern=r'(?:HKEY_LOCAL_MACHINE|HKLM|HKEY_CURRENT_USER|HKCU|HKEY_CLASSES_ROOT|HKCR|HKEY_USERS|HKU|HKEY_CURRENT_CONFIG|HKCC)\\[^\s<>"|?*]+',
        examples=["HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run"],
        stix_type="windows-registry-key"
    ),
    IOCType.BITCOIN_ADDRESS: IOCTypeDefinition(
        type=IOCType.BITCOIN_ADDRESS,
        category=IOCCategory.CRYPTOGRAPHIC,
        name="Bitcoin Address",
        description="Bitcoin cryptocurrency wallet address",
        pattern=r'\b(?:1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}\b',
        examples=["1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2"],
        stix_type="cryptocurrency-wallet"
    ),
    IOCType.FILE_PATH: IOCTypeDefinition(
        type=IOCType.FILE_PATH,
        category=IOCCategory.HOST,
        name="File Path",
        description="Full filesystem path to a file",
        pattern=r'(?:[A-Z]:\\(?:[^\s<>"|?*\r\n]+\\)*[^\s<>"|?*\r\n]+|/(?:usr|var|etc|tmp|home|root|opt|bin|sbin|lib|mnt|media|srv|proc|sys)/[^\s<>"|?*\r\n]+)',
        examples=["C:\\Windows\\System32\\cmd.exe", "/etc/passwd", "/tmp/malware.sh"],
        stix_type="file:path"
    ),
    IOCType.FILENAME: IOCTypeDefinition(
        type=IOCType.FILENAME,
        category=IOCCategory.FILE,
        name="Filename",
        description="Name of a file including extension",
        pattern=r'\b[\w\-\.]+\.(?:exe|dll|bat|cmd|ps1|vbs|vba|js|hta|msi|scr|pif|jar|wsf|wsh|iso|img|vhd|lnk|chm|inf|reg|doc[xm]?|xls[xmb]?|ppt[xm]?|pdf|rtf|html?|sh|py|pl|rb|php|asp[x]?|jsp)\b',
        examples=["malware.exe", "payload.dll", "script.ps1"],
        stix_type="file:name"
    ),
    IOCType.USER_AGENT: IOCTypeDefinition(
        type=IOCType.USER_AGENT,
        category=IOCCategory.NETWORK,
        name="User Agent",
        description="HTTP User-Agent string",
        pattern=r'User-Agent:\s*([^\r\n]+)',
        examples=["Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)"],
        stix_type="network-traffic:extensions.'http-request-ext'.request_header.'User-Agent'"
    ),
    IOCType.JA3_FINGERPRINT: IOCTypeDefinition(
        type=IOCType.JA3_FINGERPRINT,
        category=IOCCategory.NETWORK,
        name="JA3 Fingerprint",
        description="TLS client fingerprint for malware detection",
        pattern=r'\b[a-f0-9]{32}\b',
        examples=["e7d705a3286e19ea42f587b344ee6865"],
        stix_type="x-ja3-fingerprint"
    ),
    IOCType.YARA_RULE: IOCTypeDefinition(
        type=IOCType.YARA_RULE,
        category=IOCCategory.BEHAVIORAL,
        name="YARA Rule",
        description="YARA rule for pattern matching",
        pattern=r'\brule\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\{|:)',
        examples=["rule Emotet_Dropper", "rule APT29_Loader"],
        stix_type="indicator"
    ),
}


def get_all_ioc_types() -> List[Dict]:
    """Get all IOC types as a list of dictionaries for API responses."""
    return [
        {
            "type": ioc_type.value,
            "category": IOC_TYPE_DEFINITIONS.get(ioc_type, IOCTypeDefinition(
                type=ioc_type, 
                category=IOCCategory.THREAT_INTEL, 
                name=ioc_type.value.replace("_", " ").title(),
                description=f"IOC type: {ioc_type.value}"
            )).category.value,
            "name": IOC_TYPE_DEFINITIONS.get(ioc_type, IOCTypeDefinition(
                type=ioc_type,
                category=IOCCategory.THREAT_INTEL,
                name=ioc_type.value.replace("_", " ").title(),
                description=""
            )).name,
            "description": IOC_TYPE_DEFINITIONS.get(ioc_type, IOCTypeDefinition(
                type=ioc_type,
                category=IOCCategory.THREAT_INTEL,
                name="",
                description=f"IOC type: {ioc_type.value}"
            )).description
        }
        for ioc_type in IOCType
    ]


def get_ioc_types_by_category(category: IOCCategory) -> List[IOCType]:
    """Get all IOC types for a specific category."""
    return [
        ioc_type for ioc_type, defn in IOC_TYPE_DEFINITIONS.items()
        if defn.category == category
    ]


def validate_ioc_type(ioc_type: str) -> bool:
    """Validate if a string is a valid IOC type."""
    try:
        IOCType(ioc_type)
        return True
    except ValueError:
        return False


def get_ioc_pattern(ioc_type: IOCType) -> Optional[str]:
    """Get the regex pattern for an IOC type."""
    defn = IOC_TYPE_DEFINITIONS.get(ioc_type)
    return defn.pattern if defn else None


# Export all types for easy import
__all__ = [
    'IOCCategory',
    'IOCType', 
    'IOCTypeDefinition',
    'IOC_TYPE_DEFINITIONS',
    'get_all_ioc_types',
    'get_ioc_types_by_category',
    'validate_ioc_type',
    'get_ioc_pattern'
]
