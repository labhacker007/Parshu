"""Celery tasks for asynchronous ingestion and processing."""
from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.ingestion.parser import FeedParser
from app.models import FeedSource, Article
from app.core.logging import logger
from datetime import datetime

# Setup DB for Celery tasks
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


@shared_task(bind=True, max_retries=3)
def ingest_feed_source(self, source_id: int):
    """Ingest articles from a single feed source."""
    db = SessionLocal()
    try:
        source = db.query(FeedSource).filter(FeedSource.id == source_id).first()
        if not source or not source.is_active:
            logger.warning("feed_source_not_active", source_id=source_id)
            return
        
        logger.info("ingesting_feed", source_id=source_id, url=source.url)
        
        # Parse feed
        feed = FeedParser.parse_feed(source.url)
        entries = FeedParser.extract_entries(feed)
        
        # Store articles
        article_count = 0
        duplicate_count = 0
        
        for entry in entries:
            # Check for duplicates
            existing = db.query(Article).filter(
                Article.source_id == source_id,
                Article.external_id == entry["external_id"]
            ).first()
            
            if existing:
                duplicate_count += 1
                continue
            
            # Create article with image
            image_url = entry.get("image_url")
            published_at = entry.get("published_at")
            
            # If no image from feed or no published date, fetch from article URL
            if entry.get("url"):
                try:
                    if not image_url:
                        image_url = FeedParser.fetch_og_image(entry["url"], timeout=5)
                except Exception:
                    pass  # Don't fail article creation if image fetch fails
                
                # Try to get published date from original article if missing or suspiciously close to now
                try:
                    if not published_at:
                        published_at = FeedParser.fetch_published_date(entry["url"], timeout=5)
                        if published_at:
                            logger.debug("fetched_published_date_from_page", url=entry["url"], date=str(published_at))
                except Exception:
                    pass  # Don't fail article creation if date fetch fails
            
            # Current time for ingestion
            ingestion_time = datetime.utcnow()
            
            article = Article(
                source_id=source_id,
                external_id=entry["external_id"],
                title=entry["title"],
                raw_content=entry["raw_content"],
                normalized_content=FeedParser.normalize_content(entry["raw_content"]),
                summary=entry["summary"],
                url=entry["url"],
                image_url=image_url,
                published_at=published_at,  # Original publication date from source/page
                ingested_at=ingestion_time,  # When Jyoti ingested the article
                status="NEW"
            )
            
            db.add(article)
            article_count += 1
        
        # Update source
        source.last_fetched = datetime.utcnow()
        source.next_fetch = datetime.utcnow()  # Schedule next fetch immediately (will be updated by scheduler)
        source.fetch_error = None
        
        db.commit()
        
        logger.info(
            "feed_ingestion_complete",
            source_id=source_id,
            new_articles=article_count,
            duplicates=duplicate_count
        )
        
        return {"new_articles": article_count, "duplicates": duplicate_count}
        
    except Exception as e:
        logger.error("feed_ingestion_failed", source_id=source_id, error=str(e))
        source.fetch_error = str(e)
        db.commit()
        
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task
def apply_watchlist_filters():
    """Apply keyword watchlists to filter high-priority articles."""
    db = SessionLocal()
    try:
        from app.models import WatchListKeyword
        
        keywords = db.query(WatchListKeyword).filter(WatchListKeyword.is_active == True).all()
        if not keywords:
            return
        
        keyword_list = [kw.keyword.lower() for kw in keywords]
        
        # Find unfiltered NEW articles
        articles = db.query(Article).filter(
            Article.status == "NEW",
            Article.is_high_priority == False
        ).all()
        
        updated_count = 0
        for article in articles:
            content = (article.title + " " + article.summary).lower()
            matched = [kw for kw in keyword_list if kw in content]
            
            if matched:
                article.is_high_priority = True
                article.watchlist_match_keywords = matched
                updated_count += 1
        
        db.commit()
        logger.info("watchlist_filtering_complete", high_priority_articles=updated_count)
        
    finally:
        db.close()
