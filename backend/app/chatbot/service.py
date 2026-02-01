"""Chatbot service using Ollama for AI-powered assistance with RAG and Guardrails."""
import os
import json
import hashlib
from typing import List, Dict, Optional, Any
from datetime import datetime
from pathlib import Path
import structlog

from app.genai.provider import get_model_manager, OllamaProvider
from app.core.config import settings

logger = structlog.get_logger(__name__)


def get_chatbot_guardrails() -> str:
    """Get formatted guardrails for chatbot from the prompts system."""
    try:
        from app.genai.prompts import DEFAULT_GUARDRAILS
        
        guardrails = []
        
        # Add global guardrails
        for g in DEFAULT_GUARDRAILS.get("global", []):
            if g.get("enabled", True):
                guardrails.append(f"- {g['name']}: {g['description']}")
        
        # Add chatbot-specific guardrails
        for g in DEFAULT_GUARDRAILS.get("chatbot", []):
            if g.get("enabled", True):
                guardrails.append(f"- {g['name']}: {g['description']}")
        
        return "\n".join(guardrails) if guardrails else ""
    except Exception as e:
        logger.warning("failed_to_load_guardrails", error=str(e))
        return ""


def get_rag_context(query: str, db_session=None) -> tuple:
    """
    Get relevant context from the knowledge base for RAG.
    
    Returns:
        Tuple of (context_string, source_documents)
    """
    if not db_session:
        return "", []
    
    try:
        from app.knowledge.service import KnowledgeService
        service = KnowledgeService(db_session)
        
        context_str, sources = service.get_context_for_prompt(
            query=query,
            target_function="chatbot",
            max_tokens=3000  # Allow more context for chatbot
        )
        
        return context_str, sources
    except Exception as e:
        logger.warning("rag_context_failed", error=str(e))
        return "", []


class DocumentStore:
    """Simple document store for chatbot knowledge base."""
    
    def __init__(self, storage_path: str = None):
        self.storage_path = storage_path or os.path.join(
            os.path.dirname(__file__), 
            "../../data/chatbot_docs"
        )
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)
        self.documents: Dict[str, Dict] = {}
        self._load_documents()
    
    def _load_documents(self):
        """Load documents from storage."""
        index_path = os.path.join(self.storage_path, "index.json")
        if os.path.exists(index_path):
            with open(index_path, 'r') as f:
                self.documents = json.load(f)
    
    def _save_index(self):
        """Save document index."""
        index_path = os.path.join(self.storage_path, "index.json")
        with open(index_path, 'w') as f:
            json.dump(self.documents, f, default=str)
    
    def add_document(
        self, 
        content: str, 
        title: str, 
        doc_type: str = "text",
        source: str = "user",
        metadata: Dict = None
    ) -> str:
        """Add a document to the knowledge base."""
        doc_id = hashlib.md5(content.encode()).hexdigest()[:12]
        
        doc = {
            "id": doc_id,
            "title": title,
            "content": content,
            "type": doc_type,
            "source": source,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat(),
            "word_count": len(content.split())
        }
        
        self.documents[doc_id] = doc
        
        # Save content to file
        content_path = os.path.join(self.storage_path, f"{doc_id}.txt")
        with open(content_path, 'w') as f:
            f.write(content)
        
        self._save_index()
        logger.info("document_added", doc_id=doc_id, title=title, word_count=doc["word_count"])
        
        return doc_id
    
    def get_document(self, doc_id: str) -> Optional[Dict]:
        """Get a document by ID."""
        if doc_id in self.documents:
            doc = self.documents[doc_id].copy()
            content_path = os.path.join(self.storage_path, f"{doc_id}.txt")
            if os.path.exists(content_path):
                with open(content_path, 'r') as f:
                    doc["content"] = f.read()
            return doc
        return None
    
    def delete_document(self, doc_id: str) -> bool:
        """Delete a document."""
        if doc_id in self.documents:
            del self.documents[doc_id]
            content_path = os.path.join(self.storage_path, f"{doc_id}.txt")
            if os.path.exists(content_path):
                os.remove(content_path)
            self._save_index()
            return True
        return False
    
    def list_documents(self) -> List[Dict]:
        """List all documents (without full content)."""
        return [
            {k: v for k, v in doc.items() if k != "content"} 
            for doc in self.documents.values()
        ]
    
    def search(self, query: str, limit: int = 5) -> List[Dict]:
        """Simple keyword search in documents."""
        query_lower = query.lower()
        results = []
        
        for doc_id, doc in self.documents.items():
            # Load content
            content_path = os.path.join(self.storage_path, f"{doc_id}.txt")
            content = ""
            if os.path.exists(content_path):
                with open(content_path, 'r') as f:
                    content = f.read()
            
            # Simple relevance scoring
            title_match = query_lower in doc.get("title", "").lower()
            content_match = query_lower in content.lower()
            
            if title_match or content_match:
                score = (2 if title_match else 0) + (1 if content_match else 0)
                results.append({
                    **doc,
                    "content": content[:500] + "..." if len(content) > 500 else content,
                    "score": score
                })
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]


class ParshuChatbot:
    """AI-powered chatbot for Parshu platform assistance with RAG and Guardrails."""
    
    def __init__(self, db_session=None):
        self.document_store = DocumentStore()
        self.conversation_history: List[Dict] = []
        self.max_history = 10
        self.db_session = db_session
        self._last_rag_sources = []  # Track RAG sources for attribution
        
        # Load built-in documentation
        self._load_builtin_docs()
    
    def _load_builtin_docs(self):
        """Load built-in documentation from the docs folder."""
        docs_path = os.path.join(os.path.dirname(__file__), "../../docs")
        if not os.path.exists(docs_path):
            docs_path = os.path.join(os.path.dirname(__file__), "../../../docs")
        
        if os.path.exists(docs_path):
            for filename in os.listdir(docs_path):
                if filename.endswith('.md'):
                    file_path = os.path.join(docs_path, filename)
                    with open(file_path, 'r') as f:
                        content = f.read()
                    
                    # Only add if not already in store
                    doc_id = hashlib.md5(content.encode()).hexdigest()[:12]
                    if doc_id not in self.document_store.documents:
                        self.document_store.add_document(
                            content=content,
                            title=filename.replace('.md', '').replace('_', ' '),
                            doc_type="documentation",
                            source="builtin"
                        )
    
    def _build_system_prompt(self, context_docs: List[Dict] = None, rag_context: str = None) -> str:
        """Build the system prompt with context, guardrails, and RAG knowledge."""
        
        # Get guardrails from the prompts system
        guardrails = get_chatbot_guardrails()
        
        base_prompt = """You are Parshu Assistant, an AI-powered helper for the Parshu Threat Intelligence Platform.

=== YOUR ROLE ===
You are a senior cybersecurity expert with deep knowledge in:
- Threat Intelligence and IOC analysis
- Threat Hunting across SIEM/XDR platforms
- Incident Response and forensics
- Security operations and automation
- MITRE ATT&CK framework

Your role is to help users:
1. Navigate and use the platform features
2. Configure SAML SSO, email notifications, and other settings
3. Understand threat hunting, IOC extraction, and intelligence analysis
4. Generate hunt queries for XSIAM, Defender, Splunk, and Wiz
5. Troubleshoot issues and answer questions about the platform
6. Provide expert guidance on cybersecurity topics

=== GUARDRAILS ===
""" + guardrails + """

=== PLATFORM FEATURES ===
- Article Queue: Triage and analyze threat intelligence articles from RSS feeds
- Intelligence View: View extracted IOCs, IOAs, TTPs with MITRE ATT&CK mapping
- Hunt Workbench: Generate and execute hunt queries across multiple platforms
- Reports: Generate executive and technical reports
- Watchlist: Monitor for specific keywords and threat actors
- Knowledge Base: Admin-managed documentation for RAG-powered responses
- Admin: Manage users, sources, connectors, guardrails, and system configuration

=== HUNT QUERY PLATFORMS ===
- Defender (KQL): Microsoft Defender for Endpoint / Sentinel
- XSIAM (XQL): Palo Alto Cortex XSIAM/XSOAR
- Splunk (SPL): Splunk SIEM
- Wiz (GraphQL): Wiz Cloud Security

=== ROLE-BASED ACCESS ===
- ADMIN: Full system access including user management, guardrails, knowledge base
- TI: Threat Intelligence - article triage and analysis
- TH: Threat Hunting - hunt execution and query generation
- IR: Incident Response - high-priority investigations
- VIEWER: Read-only access"""

        # Add RAG context from knowledge base (admin-managed)
        if rag_context:
            base_prompt += f"""

=== KNOWLEDGE BASE CONTEXT ===
The following information is from the organization's knowledge base. Use it to provide accurate, customized responses:

{rag_context}

=== END KNOWLEDGE BASE CONTEXT ===
"""

        # Add legacy document store context (built-in docs)
        if context_docs:
            context = "\n\n=== BUILT-IN DOCUMENTATION ===\n"
            for doc in context_docs[:3]:
                context += f"\n--- {doc['title']} ---\n{doc.get('content', '')[:2000]}\n"
            base_prompt += context
        
        base_prompt += """

=== RESPONSE GUIDELINES ===
- Be concise but thorough
- When answering configuration questions, provide step-by-step instructions
- Use code blocks for queries, commands, and configuration examples
- If you're unsure, say so and suggest where to find more information
- For query syntax, always specify which platform (KQL, XQL, SPL, etc.)
- Cite sources from the knowledge base when applicable
- If the user's question relates to documentation that seems outdated, note this
"""
        
        return base_prompt
    
    async def chat(
        self, 
        message: str, 
        user_context: Dict = None,
        include_docs: bool = True,
        db_session = None,
        enforce_guardrails: bool = True
    ) -> Dict:
        """Process a chat message and return a response with RAG and guardrails."""
        # Use provided session or instance session
        db = db_session or self.db_session
        
        # =========================================================================
        # GUARDRAIL ENFORCEMENT - INPUT VALIDATION
        # =========================================================================
        guardrail_results = {
            "input_validation": None,
            "output_validation": None,
            "blocked": False,
            "violations": []
        }
        
        if enforce_guardrails and db:
            try:
                from app.guardrails.cybersecurity_guardrails import get_guardrail_engine
                engine = get_guardrail_engine(db)
                
                # Validate input message
                passed, results = await engine.validate_input(
                    prompt=message,
                    use_case='chatbot',
                    platform=None
                )
                
                guardrail_results["input_validation"] = {
                    "passed": passed,
                    "results": [
                        {
                            "guardrail_id": r.guardrail_id,
                            "guardrail_name": r.guardrail_name,
                            "passed": r.passed,
                            "severity": r.severity.value if hasattr(r.severity, 'value') else r.severity,
                            "message": r.message,
                            "suggestion": r.suggestion
                        }
                        for r in results if not r.passed
                    ]
                }
                
                # Block if critical/high violations
                critical_failures = [r for r in results if not r.passed and r.severity.value in ['critical', 'high']]
                if critical_failures:
                    guardrail_results["blocked"] = True
                    guardrail_results["violations"] = [
                        {
                            "guardrail": r.guardrail_name,
                            "message": r.message,
                            "suggestion": r.suggestion
                        }
                        for r in critical_failures
                    ]
                    
                    # Return blocked response
                    return {
                        "response": "⚠️ **Security Guardrail Triggered**\n\n" + 
                                   "Your message was blocked because it contains sensitive information:\n\n" +
                                   "\n".join([f"- **{v['guardrail']}**: {v['message']}" for v in guardrail_results["violations"]]) +
                                   "\n\n**Suggestion**: " + (critical_failures[0].suggestion or "Please remove sensitive data and try again."),
                        "sources": [],
                        "guardrails_applied": True,
                        "guardrail_results": guardrail_results,
                        "blocked": True
                    }
            except Exception as e:
                logger.warning("input_guardrail_check_failed", error=str(e))
        
        # Get RAG context from knowledge base (admin-managed, global scope)
        rag_context = ""
        rag_sources = []
        if db:
            rag_context, rag_sources = get_rag_context(message, db)
            self._last_rag_sources = rag_sources
        
        # Search for relevant documentation from built-in docs
        context_docs = []
        if include_docs:
            context_docs = self.document_store.search(message, limit=3)
        
        # Build prompts with RAG and guardrails
        system_prompt = self._build_system_prompt(context_docs, rag_context)
        
        # Build conversation context
        history_context = ""
        if self.conversation_history:
            history_context = "\n\nRECENT CONVERSATION:\n"
            for msg in self.conversation_history[-self.max_history:]:
                role = "User" if msg["role"] == "user" else "Assistant"
                history_context += f"{role}: {msg['content'][:200]}\n"
        
        user_prompt = f"""
{history_context}

USER QUESTION: {message}

{f"USER CONTEXT: Role={user_context.get('role', 'unknown')}, Page={user_context.get('current_page', 'unknown')}" if user_context else ""}

Please provide a helpful response. If this relates to platform configuration, provide step-by-step instructions.
If you used information from the knowledge base, mention the source."""

        try:
            # Use model manager for generation with fallback support
            model_manager = get_model_manager()
            result = await model_manager.generate_with_fallback(
                system_prompt, 
                user_prompt, 
                temperature=0.3
            )
            response = result.get("response", "")
            model_used = result.get("model_used", "unknown")
            
            # =========================================================================
            # GUARDRAIL ENFORCEMENT - OUTPUT VALIDATION
            # =========================================================================
            if enforce_guardrails and db and response:
                try:
                    from app.guardrails.cybersecurity_guardrails import get_guardrail_engine
                    engine = get_guardrail_engine(db)
                    
                    # Validate output
                    output_passed, output_results = await engine.validate_output(
                        output=response,
                        use_case='chatbot',
                        platform=None
                    )
                    
                    guardrail_results["output_validation"] = {
                        "passed": output_passed,
                        "results": [
                            {
                                "guardrail_id": r.guardrail_id,
                                "guardrail_name": r.guardrail_name,
                                "passed": r.passed,
                                "severity": r.severity.value if hasattr(r.severity, 'value') else r.severity,
                                "message": r.message
                            }
                            for r in output_results if not r.passed
                        ]
                    }
                    
                    # If output contains sensitive data, redact or warn
                    critical_output_failures = [r for r in output_results if not r.passed and r.severity.value in ['critical', 'high']]
                    if critical_output_failures:
                        # Add warning to response
                        warning = "\n\n---\n⚠️ **Security Notice**: The response was flagged by guardrails:\n"
                        for r in critical_output_failures:
                            warning += f"- {r.guardrail_name}: {r.message}\n"
                        response += warning
                        guardrail_results["output_flagged"] = True
                        
                except Exception as e:
                    logger.warning("output_guardrail_check_failed", error=str(e))
            
            # Check for potential documentation discrepancy
            feedback_needed = False
            if (context_docs or rag_sources) and any(
                keyword in message.lower() 
                for keyword in ["not working", "error", "different", "changed", "outdated"]
            ):
                feedback_needed = True
            
            # Update conversation history
            self.conversation_history.append({"role": "user", "content": message})
            self.conversation_history.append({"role": "assistant", "content": response})
            
            # Trim history
            if len(self.conversation_history) > self.max_history * 2:
                self.conversation_history = self.conversation_history[-self.max_history * 2:]
            
            # Combine sources from both RAG knowledge base and built-in docs
            all_sources = []
            
            # Add RAG sources (knowledge base)
            for src in rag_sources:
                all_sources.append({
                    "id": src.get("id"),
                    "title": src.get("title"),
                    "type": "knowledge_base",
                    "similarity": src.get("similarity", 0)
                })
            
            # Add built-in doc sources
            for doc in context_docs:
                all_sources.append({
                    "id": doc.get("id"),
                    "title": doc.get("title"),
                    "type": "builtin_docs"
                })
            
            chat_result = {
                "response": response,
                "sources": all_sources,
                "rag_sources": rag_sources,  # Separate RAG sources for detailed attribution
                "feedback_needed": feedback_needed,
                "model_used": model_used,
                "guardrails_applied": True,  # Indicate guardrails were used
                "guardrail_results": guardrail_results,
                "blocked": False
            }
            
            if feedback_needed:
                chat_result["feedback_prompt"] = (
                    "It seems like the current behavior might differ from the documentation. "
                    "Would you like to submit feedback to the developers about this discrepancy?"
                )
            
            logger.info(
                "chatbot_response", 
                message_length=len(message), 
                response_length=len(response), 
                model=model_used,
                rag_sources_count=len(rag_sources),
                builtin_sources_count=len(context_docs)
            )
            return chat_result
            
        except Exception as e:
            logger.error("chatbot_error", error=str(e))
            # Provide more helpful error message
            error_msg = str(e)
            if "connect" in error_msg.lower() or "connection" in error_msg.lower():
                error_msg = "Cannot connect to Ollama. Please ensure Ollama is running (ollama serve) and accessible."
            return {
                "response": f"I apologize, but I encountered an error: {error_msg}. Please try again or check if Ollama is running.",
                "sources": [],
                "error": str(e),
                "guardrails_applied": True
            }
    
    def clear_history(self):
        """Clear conversation history."""
        self.conversation_history = []
    
    async def submit_feedback(
        self, 
        message: str, 
        issue_type: str,
        user_id: int,
        context: Dict = None
    ) -> Dict:
        """Submit feedback about documentation or feature discrepancy."""
        feedback = {
            "id": hashlib.md5(f"{message}{datetime.utcnow()}".encode()).hexdigest()[:12],
            "message": message,
            "issue_type": issue_type,  # documentation, feature, bug
            "user_id": user_id,
            "context": context or {},
            "created_at": datetime.utcnow().isoformat(),
            "status": "new"
        }
        
        # Save feedback
        feedback_path = os.path.join(
            self.document_store.storage_path, 
            "feedback"
        )
        Path(feedback_path).mkdir(exist_ok=True)
        
        with open(os.path.join(feedback_path, f"{feedback['id']}.json"), 'w') as f:
            json.dump(feedback, f)
        
        logger.info("feedback_submitted", feedback_id=feedback["id"], issue_type=issue_type)
        
        return {
            "feedback_id": feedback["id"],
            "message": "Thank you for your feedback! The development team will review it.",
            "status": "submitted"
        }


# Global chatbot instance
_chatbot_instance: Optional[ParshuChatbot] = None

def get_chatbot(db_session=None) -> ParshuChatbot:
    """Get or create chatbot instance, optionally with a database session for RAG."""
    global _chatbot_instance
    if _chatbot_instance is None:
        _chatbot_instance = OrionChatbot(db_session=db_session)
    elif db_session:
        # Update the db session for RAG support
        _chatbot_instance.db_session = db_session
    return _chatbot_instance


def create_chatbot_with_rag(db_session) -> ParshuChatbot:
    """Create a new chatbot instance with RAG support (for request-scoped usage)."""
    return OrionChatbot(db_session=db_session)
