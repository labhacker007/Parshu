"""
Web Crawler for Knowledge Base.

Crawls websites with configurable depth and extracts content
for the RAG knowledge base. Also supports GitHub repository crawling.
"""

import asyncio
import os
import re
from typing import Dict, List, Set, Optional, Tuple
from urllib.parse import urljoin, urlparse
from datetime import datetime
import httpx
from bs4 import BeautifulSoup

from app.core.logging import logger
from app.core.fetch import safe_fetch_text_async, FetchError
from app.core.ssrf import ssrf_policy_from_settings


class WebCrawler:
    """Crawls websites and extracts content for knowledge base."""
    
    def __init__(
        self,
        max_depth: int = 2,
        max_pages: int = 50,
        timeout: int = 30,
        same_domain_only: bool = True,
        exclude_patterns: List[str] = None,
        auth_type: str = None,  # None, 'basic', 'bearer', 'session'
        auth_username: str = None,
        auth_password: str = None,
        auth_token: str = None,
        session_cookies: Dict[str, str] = None
    ):
        """
        Initialize the web crawler.
        
        Args:
            max_depth: Maximum depth to crawl (0 = only the provided URL)
            max_pages: Maximum number of pages to crawl
            timeout: Request timeout in seconds
            same_domain_only: Only crawl pages on the same domain
            exclude_patterns: URL patterns to exclude (regex)
            auth_type: Authentication type (None, 'basic', 'bearer', 'session')
            auth_username: Username for basic auth
            auth_password: Password for basic auth
            auth_token: Bearer token for token auth
            session_cookies: Dictionary of cookies for session-based auth
        """
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.timeout = timeout
        self.same_domain_only = same_domain_only
        self.exclude_patterns = exclude_patterns or [
            r'/login', r'/logout', r'/signup', r'/register',
            r'/auth/', r'/api/', r'\.pdf$', r'\.zip$', r'\.exe$',
            r'\.jpg$', r'\.png$', r'\.gif$', r'\.svg$',
            r'/search\?', r'/tag/', r'/category/', r'/page/\d+',
            r'#', r'\?utm_', r'/share/', r'/print/'
        ]
        
        # Authentication settings
        self.auth_type = auth_type
        self.auth_username = auth_username
        self.auth_password = auth_password
        self.auth_token = auth_token
        self.session_cookies = session_cookies or {}
        
        self.visited_urls: Set[str] = set()
        self.crawled_pages: List[Dict] = []
        self.errors: List[Dict] = []
        self.base_domain: str = ""
    
    def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers based on auth type."""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        if self.auth_type == 'bearer' and self.auth_token:
            headers['Authorization'] = f'Bearer {self.auth_token}'
        
        return headers
    
    def _get_auth(self):
        """Get httpx auth object for basic auth."""
        if self.auth_type == 'basic' and self.auth_username and self.auth_password:
            return httpx.BasicAuth(self.auth_username, self.auth_password)
        return None
    
    def _normalize_url(self, url: str) -> str:
        """Normalize URL for consistency."""
        # Remove fragments and trailing slashes
        parsed = urlparse(url)
        normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"
        if parsed.query:
            normalized += f"?{parsed.query}"
        return normalized
    
    def _is_valid_url(self, url: str) -> bool:
        """Check if URL should be crawled."""
        try:
            parsed = urlparse(url)
            
            # Must be HTTP(S)
            if parsed.scheme not in ('http', 'https'):
                return False
            
            # Same domain check
            if self.same_domain_only and parsed.netloc != self.base_domain:
                return False
            
            # Exclude patterns
            for pattern in self.exclude_patterns:
                if re.search(pattern, url, re.IGNORECASE):
                    return False
            
            return True
        except Exception:
            return False
    
    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extract valid links from a page."""
        links = []
        
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            
            # Skip empty, javascript, mailto links
            if not href or href.startswith(('javascript:', 'mailto:', 'tel:')):
                continue
            
            # Resolve relative URLs
            full_url = urljoin(base_url, href)
            normalized = self._normalize_url(full_url)
            
            if self._is_valid_url(normalized) and normalized not in self.visited_urls:
                links.append(normalized)
        
        return list(set(links))
    
    def _extract_content(self, soup: BeautifulSoup, url: str) -> Dict:
        """Extract structured content from a page."""
        # Get title
        title = ""
        if soup.title:
            title = soup.title.string or ""
        if not title:
            h1 = soup.find('h1')
            if h1:
                title = h1.get_text(strip=True)
        
        # Get meta description
        description = ""
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            description = meta_desc.get('content', '')
        
        # Remove non-content elements
        for element in soup(['script', 'style', 'nav', 'footer', 'header', 
                            'aside', 'form', 'noscript', 'iframe']):
            element.decompose()
        
        # Try to find main content area
        main_content = (
            soup.find('main') or 
            soup.find('article') or 
            soup.find('div', class_=re.compile(r'content|main|article|post', re.I)) or
            soup.find('div', id=re.compile(r'content|main|article|post', re.I)) or
            soup.body
        )
        
        # Extract text
        if main_content:
            text = main_content.get_text(separator='\n')
        else:
            text = soup.get_text(separator='\n')
        
        # Clean up whitespace
        lines = []
        for line in text.splitlines():
            line = line.strip()
            if line and len(line) > 3:  # Skip very short lines
                lines.append(line)
        
        clean_text = '\n'.join(lines)
        
        # Extract headings for structure
        headings = []
        for h in soup.find_all(['h1', 'h2', 'h3']):
            heading_text = h.get_text(strip=True)
            if heading_text:
                headings.append({
                    'level': h.name,
                    'text': heading_text
                })
        
        return {
            'url': url,
            'title': title.strip(),
            'description': description.strip(),
            'content': clean_text,
            'headings': headings,
            'word_count': len(clean_text.split()),
            'crawled_at': datetime.utcnow().isoformat()
        }
    
    async def _fetch_page(self, url: str, client: httpx.AsyncClient) -> Optional[Tuple[str, BeautifulSoup]]:
        """Fetch and parse a single page with authentication support."""
        try:
            policy = ssrf_policy_from_settings()

            auth = self._get_auth()
            result = await safe_fetch_text_async(
                url,
                policy=policy,
                client=client,
                headers=self._get_auth_headers(),
                cookies=self.session_cookies or None,
                auth=auth,
                timeout_seconds=float(self.timeout),
                max_bytes=4_000_000,
            )

            content_type = result.headers.get('content-type', '')
            if 'text/html' not in content_type:
                return None
            
            soup = BeautifulSoup(result.text, 'html.parser')
            return (result.final_url, soup)
             
        except (FetchError, Exception) as e:
            self.errors.append({
                'url': url,
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            })
            logger.warning("crawl_fetch_failed", url=url, error=str(e))
            return None
    
    async def crawl(self, start_url: str) -> Dict:
        """
        Crawl a website starting from the given URL.
        
        Returns:
            Dict with crawled pages, stats, and any errors
        """
        self.visited_urls.clear()
        self.crawled_pages.clear()
        self.errors.clear()
        
        # Set base domain
        parsed = urlparse(start_url)
        self.base_domain = parsed.netloc
        
        # Queue: (url, depth)
        queue: List[Tuple[str, int]] = [(self._normalize_url(start_url), 0)]
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            while queue and len(self.crawled_pages) < self.max_pages:
                # Get next URL
                current_url, depth = queue.pop(0)
                
                if current_url in self.visited_urls:
                    continue
                
                self.visited_urls.add(current_url)
                
                logger.info("crawling_page", url=current_url, depth=depth)
                
                # Fetch page
                result = await self._fetch_page(current_url, client)
                if not result:
                    continue
                
                final_url, soup = result
                
                # Extract content
                page_data = self._extract_content(soup, str(final_url))
                page_data['depth'] = depth
                
                # Only save if meaningful content
                if page_data['word_count'] > 50:
                    self.crawled_pages.append(page_data)
                
                # Extract links for next level
                if depth < self.max_depth:
                    links = self._extract_links(soup, str(final_url))
                    for link in links[:20]:  # Limit links per page
                        if link not in self.visited_urls:
                            queue.append((link, depth + 1))
                
                # Small delay to be respectful
                await asyncio.sleep(0.5)
        
        return {
            'start_url': start_url,
            'pages_crawled': len(self.crawled_pages),
            'pages_visited': len(self.visited_urls),
            'errors_count': len(self.errors),
            'max_depth': self.max_depth,
            'pages': self.crawled_pages,
            'errors': self.errors
        }
    
    def get_combined_content(self) -> str:
        """Get all crawled content as a single text blob."""
        parts = []
        for page in self.crawled_pages:
            parts.append(f"""
=== {page['title']} ===
URL: {page['url']}
{page['content']}
""")
        return "\n\n".join(parts)


async def crawl_url(
    url: str, 
    depth: int = 1, 
    max_pages: int = 20,
    same_domain_only: bool = True
) -> Dict:
    """
    Convenience function to crawl a URL.
    
    Args:
        url: Starting URL
        depth: How deep to crawl (0 = single page, 1 = page + links, etc.)
        max_pages: Maximum pages to crawl
        same_domain_only: Only crawl same domain
    
    Returns:
        Crawl results dictionary
    """
    crawler = WebCrawler(
        max_depth=depth,
        max_pages=max_pages,
        same_domain_only=same_domain_only
    )
    return await crawler.crawl(url)


class GitHubRepoCrawler:
    """Crawls GitHub repositories and extracts code/documentation for knowledge base."""
    
    # File extensions to include
    INCLUDE_EXTENSIONS = {
        '.py', '.js', '.ts', '.jsx', '.tsx', '.md', '.txt', '.rst',
        '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg',
        '.html', '.css', '.scss', '.sql', '.sh', '.bash',
        '.java', '.go', '.rs', '.rb', '.php', '.c', '.cpp', '.h',
        '.dockerfile', '.env.example', '.gitignore'
    }
    
    # Directories to exclude
    EXCLUDE_DIRS = {
        'node_modules', '__pycache__', '.git', 'venv', 'env',
        'dist', 'build', '.idea', '.vscode', 'coverage',
        'test_data', 'fixtures', '.pytest_cache', '.mypy_cache'
    }
    
    def __init__(
        self,
        include_code: bool = True,
        include_docs: bool = True,
        max_file_size: int = 100000,  # 100KB max per file
        max_files: int = 200
    ):
        self.include_code = include_code
        self.include_docs = include_docs
        self.max_file_size = max_file_size
        self.max_files = max_files
        self.files_processed: List[Dict] = []
        self.errors: List[Dict] = []
    
    def _parse_github_url(self, url: str) -> Optional[Dict]:
        """Parse GitHub URL to extract owner, repo, and optional path."""
        patterns = [
            r'github\.com/([^/]+)/([^/]+)(?:/tree/([^/]+)(?:/(.*))?)?',
            r'github\.com/([^/]+)/([^/]+)(?:/blob/([^/]+)(?:/(.*))?)?',
            r'github\.com/([^/]+)/([^/]+)/?$'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                groups = match.groups()
                return {
                    'owner': groups[0],
                    'repo': groups[1].rstrip('.git'),
                    'branch': groups[2] if len(groups) > 2 and groups[2] else 'main',
                    'path': groups[3] if len(groups) > 3 else ''
                }
        return None
    
    def _should_include_file(self, path: str) -> bool:
        """Check if file should be included based on extension and path."""
        # Check directory exclusions
        path_parts = path.split('/')
        for part in path_parts[:-1]:  # Exclude filename
            if part in self.EXCLUDE_DIRS:
                return False
        
        # Check file extension
        _, ext = os.path.splitext(path.lower())
        filename = path_parts[-1].lower()
        
        # Always include README, LICENSE, etc.
        if filename in {'readme.md', 'readme', 'license', 'license.md', 'contributing.md', 'changelog.md'}:
            return True
        
        # Include based on extension
        if ext in self.INCLUDE_EXTENSIONS:
            return True
        
        # Include common config files without extensions
        if filename in {'makefile', 'dockerfile', 'procfile', 'requirements.txt', 'package.json'}:
            return True
        
        return False
    
    async def crawl(self, github_url: str) -> Dict:
        """
        Crawl a GitHub repository.
        
        Args:
            github_url: GitHub repository URL
        
        Returns:
            Dict with crawled files and stats
        """
        self.files_processed.clear()
        self.errors.clear()
        
        parsed = self._parse_github_url(github_url)
        if not parsed:
            raise ValueError(f"Invalid GitHub URL: {github_url}")
        
        owner = parsed['owner']
        repo = parsed['repo']
        branch = parsed['branch']
        base_path = parsed['path']
        
        # Use GitHub API to get repository contents
        api_base = f"https://api.github.com/repos/{owner}/{repo}"
        
        async with httpx.AsyncClient(timeout=30) as client:
            # First, try to get the default branch if 'main' fails
            try:
                tree_url = f"{api_base}/git/trees/{branch}?recursive=1"
                response = await client.get(tree_url)
                
                if response.status_code == 404:
                    # Try 'master' branch
                    branch = 'master'
                    tree_url = f"{api_base}/git/trees/{branch}?recursive=1"
                    response = await client.get(tree_url)
                
                response.raise_for_status()
                tree_data = response.json()
                
            except httpx.HTTPError as e:
                self.errors.append({'url': github_url, 'error': str(e)})
                return {
                    'repo_url': github_url,
                    'owner': owner,
                    'repo': repo,
                    'branch': branch,
                    'files_processed': 0,
                    'errors_count': 1,
                    'files': [],
                    'errors': self.errors
                }
            
            # Filter files to process
            files_to_process = []
            for item in tree_data.get('tree', []):
                if item['type'] != 'blob':
                    continue
                
                path = item['path']
                
                # Filter by base_path if specified
                if base_path and not path.startswith(base_path):
                    continue
                
                if not self._should_include_file(path):
                    continue
                
                # Check file size (GitHub API provides size)
                if item.get('size', 0) > self.max_file_size:
                    continue
                
                files_to_process.append(item)
                
                if len(files_to_process) >= self.max_files:
                    break
            
            logger.info("github_crawl_starting", 
                       repo=f"{owner}/{repo}", 
                       branch=branch,
                       files_count=len(files_to_process))
            
            # Fetch file contents
            for item in files_to_process:
                path = item['path']
                
                try:
                    # Get raw content
                    raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
                    response = await client.get(raw_url)
                    response.raise_for_status()
                    
                    content = response.text
                    
                    # Determine file type
                    _, ext = os.path.splitext(path.lower())
                    is_doc = ext in {'.md', '.txt', '.rst'}
                    is_code = not is_doc
                    
                    # Skip based on settings
                    if is_code and not self.include_code:
                        continue
                    if is_doc and not self.include_docs:
                        continue
                    
                    self.files_processed.append({
                        'path': path,
                        'content': content,
                        'size': len(content),
                        'is_code': is_code,
                        'is_doc': is_doc,
                        'url': f"https://github.com/{owner}/{repo}/blob/{branch}/{path}"
                    })
                    
                    # Rate limiting
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    self.errors.append({'path': path, 'error': str(e)})
                    logger.warning("github_file_fetch_failed", path=path, error=str(e))
        
        logger.info("github_crawl_complete",
                   repo=f"{owner}/{repo}",
                   files_processed=len(self.files_processed),
                   errors=len(self.errors))
        
        return {
            'repo_url': github_url,
            'owner': owner,
            'repo': repo,
            'branch': branch,
            'files_processed': len(self.files_processed),
            'errors_count': len(self.errors),
            'files': self.files_processed,
            'errors': self.errors
        }
    
    def get_combined_content(self) -> str:
        """Get all crawled content as a single text blob."""
        parts = []
        
        # Add documentation files first
        for file in sorted(self.files_processed, key=lambda x: (not x['is_doc'], x['path'])):
            file_type = 'Documentation' if file['is_doc'] else 'Code'
            parts.append(f"""
=== [{file_type}] {file['path']} ===
URL: {file['url']}

{file['content']}
""")
        
        return "\n\n".join(parts)


async def crawl_github_repo(
    github_url: str,
    include_code: bool = True,
    include_docs: bool = True,
    max_files: int = 200
) -> Dict:
    """
    Convenience function to crawl a GitHub repository.
    
    Args:
        github_url: GitHub repository URL
        include_code: Include source code files
        include_docs: Include documentation files
        max_files: Maximum files to crawl
    
    Returns:
        Crawl results dictionary
    """
    crawler = GitHubRepoCrawler(
        include_code=include_code,
        include_docs=include_docs,
        max_files=max_files
    )
    return await crawler.crawl(github_url)
