"""
Article summarization service using GenAI.
Provides executive, technical, and brief summaries for news articles.
"""
import json
from typing import Dict, Optional
from app.core.logging import logger
from app.genai.prompts import get_summary_prompt, get_ioc_extraction_prompt, SummaryType
from app.genai.provider import get_model_manager


class SummarizationService:
    """Service for generating article summaries using GenAI."""

    async def summarize_article(
        self,
        title: str,
        content: str,
        summary_type: SummaryType = SummaryType.BRIEF,
        persona: str = "analyst",
        preferred_model: Optional[str] = None
    ) -> Dict:
        """
        Generate a summary of an article.

        Args:
            title: Article title
            content: Article content
            summary_type: Type of summary (executive, technical, brief)
            persona: Persona to use (executive, technical, analyst)
            preferred_model: Preferred GenAI model to use

        Returns:
            Dict with summary and metadata
        """
        try:
            # Build prompt
            prompt = get_summary_prompt(
                summary_type=summary_type,
                title=title,
                content=content,
                persona_key=persona
            )

            # Generate using model manager with fallback
            model_manager = get_model_manager()
            result = await model_manager.generate_with_fallback(
                system_prompt="",  # Prompt already includes system context
                user_prompt=prompt,
                preferred_model=preferred_model,
                temperature=0.7,
                max_tokens=500 if summary_type == SummaryType.BRIEF else 800
            )

            return {
                "summary": result["response"],
                "summary_type": summary_type,
                "model_used": result["model_used"],
                "fallback_used": result.get("fallback", False)
            }

        except Exception as e:
            logger.error(
                "summarization_failed",
                title=title[:100],
                summary_type=summary_type,
                error=str(e)
            )
            raise Exception(f"Failed to generate summary: {str(e)}")

    async def extract_iocs(
        self,
        title: str,
        content: str,
        preferred_model: Optional[str] = None
    ) -> Dict:
        """
        Extract IOCs (Indicators of Compromise) from an article.

        Args:
            title: Article title
            content: Article content
            preferred_model: Preferred GenAI model

        Returns:
            Dict with extracted IOCs
        """
        try:
            # Build IOC extraction prompt
            prompt = get_ioc_extraction_prompt(title=title, content=content)

            # Generate using model manager
            model_manager = get_model_manager()
            result = await model_manager.generate_with_fallback(
                system_prompt="",
                user_prompt=prompt,
                preferred_model=preferred_model,
                temperature=0.1,  # Low temperature for accurate extraction
                max_tokens=1000
            )

            # Parse JSON response
            response_text = result["response"]

            # Extract JSON from markdown code blocks if present
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]

            try:
                iocs = json.loads(response_text.strip())
            except json.JSONDecodeError:
                logger.warning("ioc_json_parse_failed", response=response_text[:500])
                # Return empty structure if parsing fails
                iocs = {
                    "ips": [],
                    "domains": [],
                    "urls": [],
                    "hashes": {"md5": [], "sha256": []},
                    "emails": [],
                    "cves": [],
                    "context": "Failed to parse IOCs from response"
                }

            return {
                "iocs": iocs,
                "model_used": result["model_used"],
                "fallback_used": result.get("fallback", False)
            }

        except Exception as e:
            logger.error("ioc_extraction_failed", title=title[:100], error=str(e))
            raise Exception(f"Failed to extract IOCs: {str(e)}")

    async def generate_all_summaries(
        self,
        title: str,
        content: str,
        include_iocs: bool = False,
        preferred_model: Optional[str] = None
    ) -> Dict:
        """
        Generate all summary types for an article.

        Args:
            title: Article title
            content: Article content
            include_iocs: Whether to extract IOCs
            preferred_model: Preferred GenAI model

        Returns:
            Dict with all summaries and IOCs (if requested)
        """
        results = {}

        try:
            # Generate executive summary
            exec_summary = await self.summarize_article(
                title=title,
                content=content,
                summary_type=SummaryType.EXECUTIVE,
                persona="executive",
                preferred_model=preferred_model
            )
            results["executive_summary"] = exec_summary["summary"]

            # Generate technical summary
            tech_summary = await self.summarize_article(
                title=title,
                content=content,
                summary_type=SummaryType.TECHNICAL,
                persona="technical",
                preferred_model=preferred_model
            )
            results["technical_summary"] = tech_summary["summary"]

            # Generate brief summary
            brief_summary = await self.summarize_article(
                title=title,
                content=content,
                summary_type=SummaryType.BRIEF,
                persona="analyst",
                preferred_model=preferred_model
            )
            results["brief_summary"] = brief_summary["summary"]

            # Extract IOCs if requested
            if include_iocs:
                ioc_result = await self.extract_iocs(
                    title=title,
                    content=content,
                    preferred_model=preferred_model
                )
                results["iocs"] = ioc_result["iocs"]

            results["success"] = True
            results["model_used"] = tech_summary.get("model_used")

        except Exception as e:
            logger.error("generate_all_summaries_failed", title=title[:100], error=str(e))
            results["success"] = False
            results["error"] = str(e)

        return results


# Singleton instance
_summarization_service: Optional[SummarizationService] = None


def get_summarization_service() -> SummarizationService:
    """Get or create the summarization service."""
    global _summarization_service

    if _summarization_service is None:
        _summarization_service = SummarizationService()

    return _summarization_service
