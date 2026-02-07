"""RSS/Atom feed ingestion and HTML parsing."""
import feedparser
import hashlib
import json
import re
import requests
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from bleach import clean as sanitize_html
from app.core.logging import logger
from app.core.config import settings


class FeedParser:
    """Parse RSS/Atom feeds and extract normalized article data."""
    
    # Common placeholder/tracking images to filter out
    IMAGE_BLACKLIST_PATTERNS = [
        r'pixel\.', r'tracking\.', r'beacon\.', r'spacer\.',
        r'1x1\.', r'blank\.', r'transparent\.', r'ad\.', r'ads\.',
        r'doubleclick', r'googlesyndication', r'googleadservices',
        r'facebook\.com/tr', r'twitter\.com/i/adsct',
        r'feedburner', r'feedsportal', r'pheedo\.com',
    ]
    
    # Minimum dimensions for valid images
    MIN_IMAGE_WIDTH = 100
    MIN_IMAGE_HEIGHT = 100
    
    @staticmethod
    def parse_feed(url: str, timeout: int = 30) -> Dict:
        """Parse an RSS/Atom feed."""
        try:
            from app.core.fetch import safe_fetch_text_sync, FetchError
            from app.core.ssrf import ssrf_policy_from_settings

            policy = ssrf_policy_from_settings(enforce_allowlist=getattr(settings, "SSRF_ENFORCE_ALLOWLIST", None))
            result = safe_fetch_text_sync(
                url,
                policy=policy,
                headers={
                    "User-Agent": "Parshu Feed Reader/1.0",
                    "Accept": "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.8",
                },
                timeout_seconds=float(timeout),
                max_bytes=5_000_000,
            )

            feed = feedparser.parse(result.text.encode("utf-8", errors="ignore"))
            if feed.bozo:
                logger.warning("feed_parse_error", url=url, error=str(feed.bozo_exception))
            return feed
        except Exception as e:
            logger.error("feed_fetch_failed", url=url, error=str(e))
            raise
    
    @staticmethod
    def extract_entries(feed: Dict) -> List[Dict]:
        """Extract article entries from a parsed feed."""
        entries = []
        for entry in feed.get("entries", []):
            try:
                # Safely get raw content
                raw_content = ""
                if entry.get("content"):
                    content_list = entry.get("content", [])
                    if isinstance(content_list, list) and len(content_list) > 0:
                        raw_content = content_list[0].get("value", "") if isinstance(content_list[0], dict) else str(content_list[0])
                    elif isinstance(content_list, str):
                        raw_content = content_list
                if not raw_content:
                    raw_content = entry.get("summary", "") or ""
                
                # Ensure raw_content is a string
                if not isinstance(raw_content, str):
                    raw_content = str(raw_content) if raw_content else ""
                
                # Extract image from feed entry
                image_url = FeedParser._extract_image_from_entry(entry, raw_content)
                
                # Safely get summary
                summary = entry.get("summary", "") or ""
                if not isinstance(summary, str):
                    summary = str(summary) if summary else ""
                summary = summary[:500] if len(summary) > 500 else summary
                
                # Safely get title
                title = entry.get("title", "") or ""
                if not isinstance(title, str):
                    title = str(title) if title else ""
                
                article_data = {
                    "external_id": entry.get("id") or entry.get("link", ""),
                    "title": title,
                    "url": entry.get("link", "") or "",
                    "published_at": FeedParser._parse_date(entry.get("published") or entry.get("updated", "")),
                    "raw_content": raw_content,
                    "summary": summary,
                    "image_url": image_url,
                }
                entries.append(article_data)
            except Exception as e:
                logger.warning("entry_parse_error", error=str(e), entry_title=entry.get("title", "unknown"))
                continue

        return entries
    
    @staticmethod
    def _extract_image_from_entry(entry: Dict, content: str = "") -> Optional[str]:
        """
        Extract the best image from a feed entry.
        Priority:
        1. media:content or media:thumbnail (RSS media namespace)
        2. enclosure (RSS standard for media)
        3. image tag in entry
        4. First valid image from content HTML
        """
        try:
            # 1. Check media:content or media:thumbnail (feedparser normalizes these)
            media_content = entry.get("media_content", [])
            if media_content:
                for media in media_content:
                    if media.get("medium") == "image" or media.get("type", "").startswith("image/"):
                        url = media.get("url")
                        if url and FeedParser._is_valid_image_url(url):
                            return url
                # Check first media content even without explicit type
                if media_content[0].get("url"):
                    url = media_content[0]["url"]
                    if FeedParser._is_valid_image_url(url):
                        return url
            
            # Check media_thumbnail
            media_thumbnail = entry.get("media_thumbnail", [])
            if media_thumbnail:
                url = media_thumbnail[0].get("url")
                if url and FeedParser._is_valid_image_url(url):
                    return url
            
            # 2. Check enclosures (RSS standard)
            enclosures = entry.get("enclosures", [])
            for enclosure in enclosures:
                if enclosure.get("type", "").startswith("image/"):
                    url = enclosure.get("href") or enclosure.get("url")
                    if url and FeedParser._is_valid_image_url(url):
                        return url
            
            # Also check 'links' for enclosure type
            links = entry.get("links", [])
            for link in links:
                if link.get("rel") == "enclosure" and link.get("type", "").startswith("image/"):
                    url = link.get("href")
                    if url and FeedParser._is_valid_image_url(url):
                        return url
            
            # 3. Check for image element in entry
            if entry.get("image"):
                if isinstance(entry["image"], dict):
                    url = entry["image"].get("href") or entry["image"].get("url")
                else:
                    url = str(entry["image"])
                if url and FeedParser._is_valid_image_url(url):
                    return url
            
            # 4. Extract from content HTML
            if content:
                url = FeedParser._extract_image_from_html(content, entry.get("link", ""))
                if url:
                    return url
            
            return None
            
        except Exception as e:
            logger.debug("image_extraction_failed", error=str(e))
            return None
    
    @staticmethod
    def _extract_image_from_html(html_content: str, base_url: str = "") -> Optional[str]:
        """Extract the first valid image from HTML content."""
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            
            # Priority order for finding images
            # 1. Look for og:image meta tag if this is a full page
            og_image = soup.find("meta", property="og:image")
            if og_image and og_image.get("content"):
                url = og_image["content"]
                if FeedParser._is_valid_image_url(url):
                    return FeedParser._resolve_url(url, base_url)
            
            # 2. Look for twitter:image
            twitter_image = soup.find("meta", {"name": "twitter:image"})
            if twitter_image and twitter_image.get("content"):
                url = twitter_image["content"]
                if FeedParser._is_valid_image_url(url):
                    return FeedParser._resolve_url(url, base_url)
            
            # 3. Look for figure > img (common in articles)
            figure_img = soup.select_one("figure img, .featured-image img, .post-image img, .article-image img")
            if figure_img and figure_img.get("src"):
                url = figure_img["src"]
                if FeedParser._is_valid_image_url(url):
                    return FeedParser._resolve_url(url, base_url)
            
            # 4. Find all images and pick the best one
            images = soup.find_all("img")
            best_image = None
            best_score = 0
            
            for img in images:
                src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
                if not src:
                    continue
                
                if not FeedParser._is_valid_image_url(src):
                    continue
                
                # Calculate score based on attributes
                score = 0
                
                # Prefer larger images
                width = img.get("width")
                height = img.get("height")
                if width and height:
                    try:
                        w, h = int(str(width).replace("px", "")), int(str(height).replace("px", ""))
                        if w >= FeedParser.MIN_IMAGE_WIDTH and h >= FeedParser.MIN_IMAGE_HEIGHT:
                            score += min(w * h / 10000, 100)  # Cap at 100
                    except ValueError:
                        pass
                
                # Prefer images with alt text (more likely to be content images)
                if img.get("alt") and len(img.get("alt", "")) > 5:
                    score += 20
                
                # Prefer images in article/post containers
                parent = img.parent
                for _ in range(5):
                    if parent:
                        parent_class = " ".join(parent.get("class", []))
                        if any(x in parent_class.lower() for x in ["article", "post", "content", "entry", "main"]):
                            score += 30
                            break
                        parent = parent.parent
                
                # Penalize small inline images
                if width and height:
                    try:
                        w, h = int(str(width).replace("px", "")), int(str(height).replace("px", ""))
                        if w < 50 or h < 50:
                            score -= 50
                    except ValueError:
                        pass
                
                if score > best_score:
                    best_score = score
                    best_image = src
            
            if best_image:
                return FeedParser._resolve_url(best_image, base_url)
            
            # 5. Fallback: just get the first valid image
            for img in images[:5]:  # Check first 5 images
                src = img.get("src") or img.get("data-src")
                if src and FeedParser._is_valid_image_url(src):
                    return FeedParser._resolve_url(src, base_url)
            
            return None
            
        except Exception as e:
            logger.debug("html_image_extraction_failed", error=str(e))
            return None
    
    @staticmethod
    def _is_valid_image_url(url: str) -> bool:
        """Check if URL is a valid image URL (not a tracker/placeholder)."""
        if not url:
            return False
        
        url_lower = url.lower()
        
        # Check against blacklist patterns
        for pattern in FeedParser.IMAGE_BLACKLIST_PATTERNS:
            if re.search(pattern, url_lower):
                return False
        
        # Check for common image extensions or image-related paths
        valid_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp')
        parsed = urlparse(url)
        path = parsed.path.lower()
        
        # Allow if has image extension
        if any(path.endswith(ext) for ext in valid_extensions):
            return True
        
        # Allow if appears to be an image service URL
        image_services = ['imgur.com', 'cloudinary', 'imgix', 'unsplash', 'pexels', 'wp-content/uploads']
        if any(svc in url_lower for svc in image_services):
            return True
        
        # Allow URLs with image-related query params or paths
        if 'image' in url_lower or 'photo' in url_lower or 'thumb' in url_lower:
            return True
        
        # For other URLs, be lenient - might still be valid image
        # Only reject if clearly not an image
        non_image_extensions = ('.html', '.htm', '.php', '.asp', '.aspx', '.js', '.css', '.json', '.xml')
        if any(path.endswith(ext) for ext in non_image_extensions):
            return False
        
        return True
    
    @staticmethod
    def _resolve_url(url: str, base_url: str) -> str:
        """Resolve relative URLs to absolute."""
        if not url:
            return ""
        if url.startswith(('http://', 'https://', '//')):
            if url.startswith('//'):
                return 'https:' + url
            return url
        if base_url:
            return urljoin(base_url, url)
        return url
    
    @staticmethod
    def fetch_og_image(url: str, timeout: int = 10) -> Optional[str]:
        """Fetch the og:image from an article URL (for articles without embedded images)."""
        try:
            from app.core.fetch import safe_fetch_text_sync
            from app.core.ssrf import ssrf_policy_from_settings

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
            policy = ssrf_policy_from_settings(enforce_allowlist=None)
            result = safe_fetch_text_sync(
                url,
                policy=policy,
                headers=headers,
                timeout_seconds=float(timeout),
                max_bytes=2_000_000,
            )

            soup = BeautifulSoup(result.text, 'html.parser')
            
            # Try og:image first
            og_image = soup.find('meta', property='og:image')
            if og_image and og_image.get('content'):
                return FeedParser._resolve_url(og_image['content'], url)
            
            # Try twitter:image
            twitter_image = soup.find('meta', {'name': 'twitter:image'})
            if twitter_image and twitter_image.get('content'):
                return FeedParser._resolve_url(twitter_image['content'], url)
            
            # Try to find main article image
            return FeedParser._extract_image_from_html(result.text, url)
            
        except Exception as e:
            logger.debug("og_image_fetch_failed", url=url, error=str(e))
            return None

    # Common date format patterns found in RSS/web pages
    DATE_FORMATS = [
        # ISO formats
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%S",
        # RFC 2822 (common in RSS)
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%a, %d %b %Y %H:%M:%S",
        # Common web formats
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d %b %Y %H:%M:%S",
        "%d %b %Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y",
        # Additional formats
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y",
        "%Y%m%d",
    ]
    
    @staticmethod
    def _parse_date(date_str) -> Optional[datetime]:
        """Parse various date formats from RSS feeds and web pages.
        
        This method handles:
        - struct_time from feedparser
        - ISO 8601 formats
        - RFC 2822 (RSS standard)
        - Common human-readable formats
        - Timezone-aware and naive datetimes
        """
        if not date_str:
            return None
        
        try:
            # Handle feedparser's struct_time directly
            from time import struct_time, mktime
            if isinstance(date_str, struct_time):
                return datetime.fromtimestamp(mktime(date_str))
            
            # Convert to string if not already
            if not isinstance(date_str, str):
                date_str = str(date_str)
            
            # Clean up the string
            date_str = date_str.strip()
            
            # Handle timezone abbreviations by removing them
            # (Python's strptime doesn't handle all TZ abbreviations)
            import re
            date_str = re.sub(r'\s+(EST|EDT|CST|CDT|MST|MDT|PST|PDT|UTC|GMT)\s*$', '', date_str)
            
            # Try ISO format with fromisoformat (handles most ISO variants)
            try:
                # Handle 'Z' suffix
                clean = date_str.replace("Z", "+00:00")
                # Handle space instead of T
                if " " in clean and "T" not in clean:
                    parts = clean.split(" ")
                    if len(parts) >= 2 and "-" in parts[0]:
                        clean = parts[0] + "T" + " ".join(parts[1:])
                result = datetime.fromisoformat(clean)
                # Return naive datetime for consistency
                if result.tzinfo:
                    return result.replace(tzinfo=None)
                return result
            except (ValueError, AttributeError):
                pass
            
            # Try each format pattern
            for fmt in FeedParser.DATE_FORMATS:
                try:
                    result = datetime.strptime(date_str, fmt)
                    # Return naive datetime for consistency
                    if result.tzinfo:
                        return result.replace(tzinfo=None)
                    return result
                except ValueError:
                    continue
            
            # Try dateutil parser as fallback (more flexible)
            try:
                from dateutil import parser as dateutil_parser
                result = dateutil_parser.parse(date_str, fuzzy=True)
                if result.tzinfo:
                    return result.replace(tzinfo=None)
                return result
            except Exception:
                pass
            
            logger.debug("date_parse_failed", date_str=date_str[:100])
            return None
            
        except Exception as e:
            logger.debug("date_parse_error", error=str(e), date_str=str(date_str)[:100])
            return None
    
    @staticmethod
    def fetch_published_date(url: str, timeout: int = 10) -> Optional[datetime]:
        """Fetch the published date from the original article page.
        
        Checks:
        1. article:published_time (Open Graph)
        2. datePublished (JSON-LD/Schema.org)
        3. <time> element with datetime attribute
        4. meta tags with date-related names
        5. Common date patterns in page content
        """
        try:
            from app.core.fetch import safe_fetch_text_sync
            from app.core.ssrf import ssrf_policy_from_settings

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
            }
            policy = ssrf_policy_from_settings(enforce_allowlist=None)
            result = safe_fetch_text_sync(
                url,
                policy=policy,
                headers=headers,
                timeout_seconds=float(timeout),
                max_bytes=2_000_000,
            )

            soup = BeautifulSoup(result.text, 'html.parser')
            
            # 1. Check Open Graph article:published_time
            og_date = soup.find('meta', property='article:published_time')
            if og_date and og_date.get('content'):
                parsed = FeedParser._parse_date(og_date['content'])
                if parsed:
                    return parsed
            
            # Also check og:published_time (alternate)
            og_date2 = soup.find('meta', property='og:published_time')
            if og_date2 and og_date2.get('content'):
                parsed = FeedParser._parse_date(og_date2['content'])
                if parsed:
                    return parsed
            
            # 2. Check JSON-LD structured data
            scripts = soup.find_all('script', type='application/ld+json')
            for script in scripts:
                try:
                    import json
                    data = json.loads(script.string)
                    
                    # Handle both single object and array
                    items = data if isinstance(data, list) else [data]
                    for item in items:
                        if isinstance(item, dict):
                            # Check for datePublished
                            date_published = item.get('datePublished') or item.get('dateCreated')
                            if date_published:
                                parsed = FeedParser._parse_date(date_published)
                                if parsed:
                                    return parsed
                            
                            # Check @graph if present
                            if '@graph' in item:
                                for graph_item in item['@graph']:
                                    if isinstance(graph_item, dict):
                                        dp = graph_item.get('datePublished') or graph_item.get('dateCreated')
                                        if dp:
                                            parsed = FeedParser._parse_date(dp)
                                            if parsed:
                                                return parsed
                except Exception:
                    continue
            
            # 3. Check <time> elements
            time_elements = soup.find_all('time')
            for time_el in time_elements:
                # Prefer datetime attribute
                dt = time_el.get('datetime')
                if dt:
                    parsed = FeedParser._parse_date(dt)
                    if parsed:
                        return parsed
                # Fallback to content
                if time_el.string:
                    parsed = FeedParser._parse_date(time_el.string.strip())
                    if parsed:
                        return parsed
            
            # 4. Check various meta tags
            meta_date_attrs = [
                ('name', 'date'),
                ('name', 'DC.date'),
                ('name', 'DC.date.issued'),
                ('name', 'dcterms.created'),
                ('name', 'publish-date'),
                ('name', 'pubdate'),
                ('name', 'sailthru.date'),
                ('property', 'dc:created'),
                ('itemprop', 'datePublished'),
            ]
            
            for attr_name, attr_value in meta_date_attrs:
                meta = soup.find('meta', {attr_name: attr_value})
                if meta and meta.get('content'):
                    parsed = FeedParser._parse_date(meta['content'])
                    if parsed:
                        return parsed
            
            # 5. Look for common date patterns in specific elements
            date_classes = [
                '.date', '.post-date', '.published', '.entry-date', 
                '.article-date', '.timestamp', '.byline-date', '.meta-date'
            ]
            
            for selector in date_classes:
                date_el = soup.select_one(selector)
                if date_el and date_el.get_text():
                    text = date_el.get_text().strip()
                    if len(text) < 50:  # Avoid parsing long text blocks
                        parsed = FeedParser._parse_date(text)
                        if parsed:
                            return parsed
            
            return None
            
        except Exception as e:
            logger.debug("fetch_published_date_failed", url=url, error=str(e))
            return None

    @staticmethod
    def normalize_content(raw_html: str) -> str:
        """Sanitize and normalize HTML content."""
        allowed_tags = ["p", "br", "strong", "em", "ul", "li", "ol", "a", "code", "pre", "blockquote"]
        allowed_attrs = {"a": ["href", "title"]}
        
        cleaned = sanitize_html(
            raw_html,
            tags=allowed_tags,
            attributes=allowed_attrs,
            strip=True
        )
        return cleaned
    
    @staticmethod
    def compute_content_hash(content: str) -> str:
        """Compute SHA256 hash of content for deduplication."""
        return hashlib.sha256(content.encode()).hexdigest()
