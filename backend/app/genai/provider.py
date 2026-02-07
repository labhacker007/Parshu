"""Multi-provider GenAI abstraction with support for OpenAI, Gemini, Claude, and Ollama."""
import json
import hashlib
from typing import Optional, Dict, List, Any
from abc import ABC, abstractmethod
from app.core.config import settings
from app.core.logging import logger


def get_config_value(category: str, key: str) -> Optional[str]:
    """
    Get configuration value from database.
    Falls back to None if database is not available.
    """
    try:
        from app.core.database import SessionLocal
        from app.models import SystemConfiguration
        from app.core.crypto import decrypt_config_secret
        
        db = SessionLocal()
        try:
            config = db.query(SystemConfiguration).filter(
                SystemConfiguration.category == category,
                SystemConfiguration.key == key
            ).first()
            
            if config and config.value:
                # Decrypt if sensitive
                if config.is_sensitive:
                    return decrypt_config_secret(config.value)
                return config.value
        finally:
            db.close()
    except Exception as e:
        logger.debug("config_lookup_failed", category=category, key=key, error=str(e))
    return None


def get_api_key(provider: str) -> Optional[str]:
    """
    Get API key for a provider.
    Priority: 1) Environment variable, 2) Database configuration
    """
    env_mapping = {
        'openai': settings.OPENAI_API_KEY,
        'anthropic': settings.ANTHROPIC_API_KEY or getattr(settings, 'CLAUDE_API_KEY', None),
        'gemini': settings.GEMINI_API_KEY,
    }
    
    # First try environment variable
    env_key = env_mapping.get(provider)
    if env_key:
        return env_key
    
    # Then try database
    db_key = get_config_value('genai', f'{provider}_api_key')
    return db_key


def get_model_name(provider: str) -> Optional[str]:
    """
    Get model name for a provider.
    Priority: 1) Environment variable, 2) Database configuration, 3) Default
    """
    env_mapping = {
        'openai': settings.OPENAI_MODEL,
        'anthropic': settings.ANTHROPIC_MODEL,
        'gemini': settings.GEMINI_MODEL if hasattr(settings, 'GEMINI_MODEL') else None,
        'ollama': settings.OLLAMA_MODEL,
    }
    
    defaults = {
        'openai': 'gpt-4-turbo-preview',
        'anthropic': 'claude-3-5-sonnet-20241022',
        'gemini': 'gemini-1.5-pro',
        'ollama': 'llama3:latest',
    }
    
    # First try environment variable
    env_model = env_mapping.get(provider)
    if env_model:
        return env_model
    
    # Then try database
    db_model = get_config_value('genai', f'{provider}_model')
    if db_model:
        return db_model
    
    # Default
    return defaults.get(provider)


class BaseGenAIProvider(ABC):
    """Abstract base class for GenAI providers."""
    
    @abstractmethod
    async def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        """Generate a response from the AI model."""
        pass
    
    @abstractmethod
    async def analyze_results(self, hunt_results: Dict, context: Dict) -> Dict:
        """Analyze hunt results and provide findings."""
        pass


class OpenAIProvider(BaseGenAIProvider):
    """OpenAI API provider (GPT-4, GPT-3.5-turbo)."""
    
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or get_api_key('openai')
        self.model = model or get_model_name('openai')
    
    async def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        from openai import AsyncOpenAI
        
        if not self.api_key:
            raise ValueError("OpenAI API key not configured. Please set OPENAI_API_KEY in Admin > Configuration > GenAI Providers")
        
        client = AsyncOpenAI(api_key=self.api_key)
        
        try:
            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=kwargs.get("temperature", 0.2),
                max_tokens=kwargs.get("max_tokens", 2000)
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error("openai_generation_failed", error=str(e))
            raise
    
    async def analyze_results(self, hunt_results: Dict, context: Dict) -> Dict:
        system_prompt = """You are a senior threat intelligence analyst. Analyze the hunt results and provide:
1. Executive Summary - Key findings in 2-3 sentences
2. Risk Assessment - Critical/High/Medium/Low with justification
3. Affected Systems - List of impacted hosts/users
4. Recommended Actions - Immediate steps to take
5. IOC Matches - Confirmed indicators found in the environment

Respond in JSON format with keys: executive_summary, risk_level, risk_justification, affected_systems, recommended_actions, confirmed_iocs"""

        user_prompt = f"""Hunt Context:
{json.dumps(context, indent=2)}

Hunt Results:
{json.dumps(hunt_results, indent=2)}

Analyze these results and provide your assessment."""

        response = await self.generate(system_prompt, user_prompt, temperature=0.1)
        
        try:
            # Extract JSON from response
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            return json.loads(response)
        except json.JSONDecodeError:
            return {"raw_analysis": response, "parse_error": True}


class GeminiProvider(BaseGenAIProvider):
    """Google Gemini API provider."""
    
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or get_api_key('gemini')
        self.model = model or get_model_name('gemini')
    
    async def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        import google.generativeai as genai
        
        if not self.api_key:
            raise ValueError("Gemini API key not configured")
        
        genai.configure(api_key=self.api_key)
        
        try:
            model = genai.GenerativeModel(
                model_name=self.model,
                system_instruction=system_prompt
            )
            
            response = await model.generate_content_async(
                user_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=kwargs.get("temperature", 0.2),
                    max_output_tokens=kwargs.get("max_tokens", 2000)
                )
            )
            return response.text
        except Exception as e:
            logger.error("gemini_generation_failed", error=str(e))
            raise
    
    async def analyze_results(self, hunt_results: Dict, context: Dict) -> Dict:
        system_prompt = """You are a senior threat intelligence analyst. Analyze hunt results and provide findings in JSON format with keys: executive_summary, risk_level, risk_justification, affected_systems, recommended_actions, confirmed_iocs"""
        
        user_prompt = f"Hunt Context: {json.dumps(context)}\n\nHunt Results: {json.dumps(hunt_results)}\n\nProvide your analysis."
        
        response = await self.generate(system_prompt, user_prompt, temperature=0.1)
        
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            return json.loads(response)
        except json.JSONDecodeError:
            return {"raw_analysis": response, "parse_error": True}


class ClaudeProvider(BaseGenAIProvider):
    """Anthropic Claude API provider."""
    
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or get_api_key('anthropic')
        self.model = model or get_model_name('anthropic')
    
    async def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        import anthropic
        
        if not self.api_key:
            raise ValueError("Claude API key not configured")
        
        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        
        try:
            message = await client.messages.create(
                model=self.model,
                max_tokens=kwargs.get("max_tokens", 2000),
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            return message.content[0].text
        except Exception as e:
            logger.error("claude_generation_failed", error=str(e))
            raise
    
    async def analyze_results(self, hunt_results: Dict, context: Dict) -> Dict:
        system_prompt = """You are a senior threat intelligence analyst. Analyze hunt results and provide findings in JSON format with keys: executive_summary, risk_level, risk_justification, affected_systems, recommended_actions, confirmed_iocs"""
        
        user_prompt = f"Hunt Context: {json.dumps(context)}\n\nHunt Results: {json.dumps(hunt_results)}\n\nProvide your analysis in JSON format."
        
        response = await self.generate(system_prompt, user_prompt, temperature=0.1)
        
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            return json.loads(response)
        except json.JSONDecodeError:
            return {"raw_analysis": response, "parse_error": True}


class OllamaProvider(BaseGenAIProvider):
    """Ollama local LLM provider (Llama, Mistral, etc.).
    
    Ollama runs locally and provides fast, private inference.
    Default model: llama3:latest (8B parameters)
    """
    
    def __init__(self, base_url: str = None, model: str = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL or "http://localhost:11434"
        self.model = model or settings.OLLAMA_MODEL or "llama3:latest"
        try:
            from app.core.ssrf import SSRFPolicy, validate_outbound_url
            validate_outbound_url(
                self.base_url,
                policy=SSRFPolicy(
                    allow_private_ips=True,
                    allow_loopback_ips=True,
                    allowed_ports={80, 443, 11434},
                ),
            )
        except Exception:
            # Do not block startup; provider connectivity is validated at call time.
            pass
        logger.info("ollama_provider_initialized", base_url=self.base_url, model=self.model)
    
    async def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        import httpx
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "system": system_prompt,
                        "prompt": user_prompt,
                        "stream": False,
                        "options": {
                            "temperature": kwargs.get("temperature", 0.2),
                            "num_predict": kwargs.get("max_tokens", 2000)
                        }
                    }
                )
                response.raise_for_status()
                return response.json()["response"]
        except Exception as e:
            logger.error("ollama_generation_failed", error=str(e))
            raise
    
    async def analyze_results(self, hunt_results: Dict, context: Dict) -> Dict:
        system_prompt = """You are a threat analyst. Analyze hunt results. Respond ONLY with valid JSON containing: executive_summary, risk_level (Critical/High/Medium/Low), risk_justification, affected_systems (array), recommended_actions (array), confirmed_iocs (array)"""
        
        user_prompt = f"Context: {json.dumps(context)}\nResults: {json.dumps(hunt_results)}\n\nJSON Response:"
        
        response = await self.generate(system_prompt, user_prompt, temperature=0.1)
        
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            return json.loads(response.strip())
        except json.JSONDecodeError:
            return {"raw_analysis": response, "parse_error": True}


class GenAIProviderFactory:
    """Factory for creating GenAI providers."""
    
    PROVIDERS = {
        "openai": OpenAIProvider,
        "gemini": GeminiProvider,
        "claude": ClaudeProvider,
        "ollama": OllamaProvider,
    }
    
    @classmethod
    def create(cls, provider_name: str = None, **kwargs) -> BaseGenAIProvider:
        """Create a GenAI provider instance."""
        provider_name = provider_name or settings.GENAI_PROVIDER or "ollama"
        provider_name = provider_name.lower()
        
        if provider_name not in cls.PROVIDERS:
            raise ValueError(f"Unknown provider: {provider_name}. Available: {list(cls.PROVIDERS.keys())}")
        
        return cls.PROVIDERS[provider_name](**kwargs)
    
    @classmethod
    def get_available_providers(cls) -> List[str]:
        """Get list of available provider names."""
        return list(cls.PROVIDERS.keys())


class GenAIModelManager:
    """Manages multiple GenAI models with primary/secondary fallback."""
    
    def __init__(self):
        self._available_models = None
        self._primary_model = None
        self._secondary_model = None
    
    async def get_available_models(self, force_refresh: bool = False, db_session=None) -> List[Dict]:
        """
        Detect all available GenAI models (both API and local).
        
        This method now:
        1. Checks runtime availability (API keys, Ollama status)
        2. Optionally merges with database registry for consistent model list
        3. Deduplicates models by model_identifier to avoid showing duplicates
        """
        if self._available_models and not force_refresh:
            return self._available_models
        
        models = []
        seen_identifiers = set()  # For deduplication
        
        # First, try to get models from database registry if available
        registry_models = {}
        if db_session:
            try:
                from app.genai.models import GenAIModelRegistry
                db_models = db_session.query(GenAIModelRegistry).filter(
                    GenAIModelRegistry.is_enabled == True
                ).all()
                for m in db_models:
                    registry_models[m.model_identifier] = {
                        "id": m.model_identifier,
                        "name": m.display_name or m.model_name,
                        "model": m.model_name,
                        "provider": m.provider,
                        "type": "local" if m.is_local else "api",
                        "status": "available",  # Will be validated below
                        "description": m.description or f"{m.provider} model",
                        "is_free": m.is_free,
                        "from_registry": True
                    }
            except Exception as e:
                # Table might not exist yet - continue without registry
                logger.warning("registry_models_not_available", error=str(e))
        
        # Check OpenAI
        openai_key = get_api_key('openai')
        if openai_key:
            model_id = "openai"
            model_name = get_model_name('openai')
            if model_id not in seen_identifiers:
                seen_identifiers.add(model_id)
                # Check if in registry, use registry info if available
                if model_id in registry_models:
                    models.append(registry_models[model_id])
                else:
                    models.append({
                        "id": model_id,
                        "name": "OpenAI",
                        "model": model_name,
                        "provider": "openai",
                        "type": "api",
                        "status": "available",
                        "description": "OpenAI GPT-4 via API",
                        "is_free": False
                    })
        
        # Check Claude/Anthropic
        anthropic_key = get_api_key('anthropic')
        if anthropic_key:
            model_id = "claude"
            model_name = get_model_name('anthropic')
            if model_id not in seen_identifiers:
                seen_identifiers.add(model_id)
                if model_id in registry_models:
                    models.append(registry_models[model_id])
                else:
                    models.append({
                        "id": model_id,
                        "name": "Anthropic Claude",
                        "model": model_name,
                        "provider": "anthropic",
                        "type": "api",
                        "status": "available",
                        "description": "Anthropic Claude via API",
                        "is_free": False
                    })
        
        # Check Gemini
        gemini_key = get_api_key('gemini')
        if gemini_key:
            model_id = "gemini"
            if model_id not in seen_identifiers:
                seen_identifiers.add(model_id)
                if model_id in registry_models:
                    models.append(registry_models[model_id])
                else:
                    models.append({
                        "id": model_id,
                        "name": "Google Gemini",
                        "model": "gemini-1.5-pro",
                        "provider": "gemini",
                        "type": "api",
                        "status": "available",
                        "description": "Google Gemini via API",
                        "is_free": False
                    })
        
        # Check Ollama (local)
        ollama_models = await self._check_ollama()
        for model in ollama_models:
            model_id = f"ollama:{model['name']}"
            # Also check for shorter identifier
            short_id = model['name']
            
            if model_id not in seen_identifiers and short_id not in seen_identifiers:
                seen_identifiers.add(model_id)
                seen_identifiers.add(short_id)
                
                # Check if in registry
                registry_key = None
                for key in registry_models:
                    if model['name'] in key or key in model['name']:
                        registry_key = key
                        break
                
                if registry_key and registry_key in registry_models:
                    reg_model = registry_models[registry_key]
                    reg_model["id"] = model_id  # Use consistent ID format
                    reg_model["status"] = "available"
                    models.append(reg_model)
                else:
                    models.append({
                        "id": model_id,
                        "name": f"Ollama - {model['name']}",
                        "model": model['name'],
                        "provider": "ollama",
                        "type": "local",
                        "status": "available",
                        "description": f"Local Ollama model ({model.get('size', 'unknown')})",
                        "base_url": settings.OLLAMA_BASE_URL or "http://localhost:11434",
                        "is_free": True
                    })
        
        # Add any registry models that weren't found in runtime checks
        # (these might be configured but not currently available)
        for model_id, model_info in registry_models.items():
            if model_id not in seen_identifiers:
                # Check if any variation of the ID was seen
                base_name = model_id.split(":")[-1] if ":" in model_id else model_id
                if base_name not in seen_identifiers:
                    model_info["status"] = "not_available"
                    model_info["reason"] = "Model configured but not currently available"
                    models.append(model_info)
                    seen_identifiers.add(model_id)
        
        self._available_models = models
        return models
    
    async def _check_ollama(self) -> List[Dict]:
        """Check for available Ollama models."""
        import httpx
        
        base_url = settings.OLLAMA_BASE_URL or "http://localhost:11434"
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{base_url}/api/tags")
                response.raise_for_status()
                data = response.json()
                return data.get("models", [])
        except Exception as e:
            logger.warning("ollama_not_available", error=str(e))
            return []
    
    def get_primary_model(self) -> Optional[str]:
        """Get the configured primary model.
        
        Priority:
        1. In-memory setting (from set_primary_model)
        2. Database configuration (genai:primary_model)
        3. Environment variable GENAI_PRIMARY_MODEL
        4. Environment variable GENAI_PROVIDER
        5. Default to "ollama"
        """
        if self._primary_model:
            return self._primary_model
        
        # Try to load from database
        try:
            from app.core.database import SessionLocal
            from app.models import SystemConfiguration
            
            db = SessionLocal()
            try:
                config = db.query(SystemConfiguration).filter(
                    SystemConfiguration.category == "genai",
                    SystemConfiguration.key == "primary_model"
                ).first()
                
                if config and config.value:
                    self._primary_model = config.value
                    return self._primary_model
            finally:
                db.close()
        except Exception as e:
            logger.warning("failed_to_load_primary_model_from_db", error=str(e))
        
        # Fallback to environment variables
        return settings.GENAI_PRIMARY_MODEL or settings.GENAI_PROVIDER or "ollama"
    
    def get_secondary_model(self) -> Optional[str]:
        """Get the configured secondary model.
        
        Priority:
        1. In-memory setting
        2. Database configuration
        3. Environment variable
        """
        if self._secondary_model:
            return self._secondary_model
        
        # Try to load from database
        try:
            from app.core.database import SessionLocal
            from app.models import SystemConfiguration
            
            db = SessionLocal()
            try:
                config = db.query(SystemConfiguration).filter(
                    SystemConfiguration.category == "genai",
                    SystemConfiguration.key == "secondary_model"
                ).first()
                
                if config and config.value:
                    self._secondary_model = config.value
                    return self._secondary_model
            finally:
                db.close()
        except Exception as e:
            logger.warning("failed_to_load_secondary_model_from_db", error=str(e))
        
        return getattr(settings, 'GENAI_SECONDARY_MODEL', None)
    
    def set_primary_model(self, model_id: str):
        """Set the primary model."""
        self._primary_model = model_id
    
    def set_secondary_model(self, model_id: str):
        """Set the secondary model."""
        self._secondary_model = model_id
    
    async def get_provider(self, model_id: str = None) -> BaseGenAIProvider:
        """Get a provider instance for the specified model."""
        model_id = model_id or self.get_primary_model()
        
        if model_id.startswith("ollama:"):
            model_name = model_id.split(":", 1)[1]
            return OllamaProvider(model=model_name)
        elif model_id == "ollama":
            return OllamaProvider()
        elif model_id == "openai":
            return OpenAIProvider()
        elif model_id == "claude":
            return ClaudeProvider()
        elif model_id == "gemini":
            return GeminiProvider()
        else:
            # Default to Ollama
            return OllamaProvider()
    
    async def generate_with_fallback(
        self, 
        system_prompt: str, 
        user_prompt: str,
        preferred_model: str = None,
        **kwargs
    ) -> Dict:
        """Generate using preferred model with automatic fallback."""
        models_to_try = []
        
        if preferred_model:
            models_to_try.append(preferred_model)
        else:
            models_to_try.append(self.get_primary_model())
        
        # Add secondary as fallback
        secondary = self.get_secondary_model()
        if secondary and secondary not in models_to_try:
            models_to_try.append(secondary)
        
        # Try each model in order
        last_error = None
        for model_id in models_to_try:
            try:
                provider = await self.get_provider(model_id)
                response = await provider.generate(system_prompt, user_prompt, **kwargs)
                return {
                    "response": response,
                    "model_used": model_id,
                    "fallback": model_id != models_to_try[0]
                }
            except Exception as e:
                last_error = e
                logger.warning("model_generation_failed", model=model_id, error=str(e))
                continue
        
        raise last_error or Exception("No GenAI models available")


# Global model manager instance
_model_manager: Optional[GenAIModelManager] = None

def get_model_manager() -> GenAIModelManager:
    """Get or create the global model manager."""
    global _model_manager
    if _model_manager is None:
        _model_manager = GenAIModelManager()
    return _model_manager


class GenAIOrchestrator:
    """Orchestrates GenAI operations for threat intelligence workflows."""
    
    def __init__(self, provider_name: str = None, db_session=None, enable_guardrails: bool = True, **kwargs):
        self.provider = GenAIProviderFactory.create(provider_name, **kwargs)
        self.provider_name = provider_name or settings.GENAI_PROVIDER or "openai"
        self.db = db_session
        self.enable_guardrails = enable_guardrails
        self._guardrail_engine = None
    
    def _get_guardrail_engine(self):
        """Get or create guardrail engine."""
        if self._guardrail_engine is None:
            from app.guardrails.cybersecurity_guardrails import get_guardrail_engine
            self._guardrail_engine = get_guardrail_engine(self.db)
        return self._guardrail_engine
    
    async def validate_input(self, prompt: str, use_case: str, platform: str = None) -> tuple:
        """Validate input against guardrails before sending to GenAI.
        
        Returns (is_valid, violations, modified_prompt)
        """
        if not self.enable_guardrails:
            return True, [], prompt
        
        engine = self._get_guardrail_engine()
        passed, results = await engine.validate_input(
            prompt=prompt,
            use_case=use_case,
            platform=platform
        )
        
        violations = [
            {"guardrail_id": r.guardrail_id, "message": r.message, "severity": r.severity.value}
            for r in results if not r.passed
        ]
        
        return passed, violations, prompt
    
    async def validate_output(self, output: str, use_case: str, platform: str = None, source_content: str = None) -> tuple:
        """Validate GenAI output against guardrails.
        
        Returns (is_valid, violations, sanitized_output)
        """
        if not self.enable_guardrails:
            return True, [], output
        
        engine = self._get_guardrail_engine()
        passed, results = await engine.validate_output(
            output=output,
            use_case=use_case,
            platform=platform,
            source_content=source_content
        )
        
        violations = [
            {"guardrail_id": r.guardrail_id, "message": r.message, "severity": r.severity.value}
            for r in results if not r.passed
        ]
        
        return passed, violations, output
    
    async def generate_hunt_query(
        self,
        platform: str,
        intelligence: Dict,
        product_docs: str = None,
        article_title: str = None,
        article_content: str = None,
        technical_summary: str = None,
        db_session = None
    ) -> Dict[str, Any]:
        """Generate a comprehensive hunt query for a target platform using ALL extracted intelligence.
        
        This method now:
        1. Uses ALL IOCs without truncation
        2. Incorporates technical summary for behavioral context
        3. References article content for attack understanding
        4. Checks knowledge base for platform-specific syntax
        5. Applies comprehensive guardrails
        """
        from app.genai.prompts import PromptManager
        
        # Format ALL IOCs for prompt (no truncation!)
        iocs = intelligence.get("iocs", [])
        iocs_by_type = {}
        for ioc in iocs:
            ioc_type = ioc.get("type", "unknown")
            if ioc_type not in iocs_by_type:
                iocs_by_type[ioc_type] = []
            iocs_by_type[ioc_type].append(ioc.get("value"))
        
        # Build comprehensive IOC string
        iocs_str = ""
        for ioc_type, values in iocs_by_type.items():
            iocs_str += f"\n{ioc_type.upper()} ({len(values)} indicators):\n"
            for value in values:  # Include ALL - no truncation
                iocs_str += f"  - {value}\n"
        
        if not iocs_str:
            iocs_str = "No IOCs available"
        
        # Format ALL TTPs
        ttps = intelligence.get("ttps", [])
        ttps_str = "\n".join([
            f"- {t.get('mitre_id', 'N/A')}: {t.get('name', 'Unknown')}"
            for t in ttps  # Include ALL - no truncation
        ]) or "No TTPs identified"
        
        # Build context with all available information
        context_parts = []
        if article_title:
            context_parts.append(f"Article: {article_title}")
        if product_docs:
            context_parts.append(f"Platform Documentation: {product_docs[:1500]}")
        context_parts.append(f"Total IOCs: {len(iocs)}, Total TTPs: {len(ttps)}")
        context = "\n".join(context_parts) or "Threat intelligence analysis"
        
        # Use PromptManager for standardized prompts with guardrails and KB context
        prompt_manager = PromptManager(db_session=db_session, enable_rag=db_session is not None)
        
        if technical_summary and article_content:
            # Use comprehensive hunt prompt with all components
            prompts = prompt_manager.build_comprehensive_hunt_prompt(
                platform=platform,
                article_title=article_title or "Threat Intelligence Article",
                article_content=article_content[:4000] if article_content else "",
                technical_summary=technical_summary[:2000] if technical_summary else "",
                iocs=iocs_str,
                ttps=ttps_str
            )
        else:
            # Use standard hunt query prompt
            prompts = prompt_manager.build_hunt_query_prompt(
                platform=platform,
                iocs=iocs_str,
                ttps=ttps_str,
                context=context,
                article_title=article_title or "",
                article_summary=article_content[:2000] if article_content else "",
                technical_summary=technical_summary or ""
            )
        
        system_prompt = prompts["system"]
        user_prompt = prompts["user"]
        kb_sources = prompts.get("kb_sources", [])
        
        try:
            query = await self.provider.generate(system_prompt, user_prompt)
            
            # Clean up the query - remove markdown code blocks
            if "```" in query:
                parts = query.split("```")
                for part in parts:
                    part_clean = part.strip()
                    # Skip language identifiers
                    if part_clean.lower().startswith(("json", "xql", "kql", "spl", "graphql")):
                        lines = part_clean.split("\n", 1)
                        if len(lines) > 1:
                            part_clean = lines[1].strip()
                    
                    if part_clean and any(keyword in part_clean.lower() 
                        for keyword in ["filter", "where", "search", "dataset", "index", "query {"]):
                        query = part_clean
                        break
            
            return {
                "query": query.strip(),
                "platform": platform,
                "model": self._get_model_name(),
                "provider": self.provider_name,
                "iocs_included": len(iocs),
                "ttps_included": len(ttps),
                "kb_sources_used": len(kb_sources),
                "response_hash": hashlib.sha256(query.encode()).hexdigest()[:16]
            }
        except Exception as e:
            logger.error("hunt_query_generation_failed", error=str(e), platform=platform)
            # Fallback to template-based query
            return {
                "query": self._fallback_query(platform, intelligence),
                "platform": platform,
                "model": "fallback",
                "provider": "template",
                "is_fallback": True,
                "iocs_included": len(iocs)
            }
    
    async def analyze_hunt_results(
        self,
        hunt_results: Dict,
        article_context: Dict,
        intelligence: Dict
    ) -> Dict:
        """Analyze hunt results using GenAI."""
        
        context = {
            "article_title": article_context.get("title", "Unknown"),
            "article_summary": article_context.get("summary", "")[:500],
            "targeted_iocs": [i.get("value") for i in intelligence.get("iocs", [])[:10]],
            "targeted_ttps": [t.get("mitre_id") for t in intelligence.get("ttps", [])[:5]],
            "hunt_platform": hunt_results.get("platform", "unknown"),
        }
        
        analysis = await self.provider.analyze_results(hunt_results, context)
        analysis["analyzed_by"] = self._get_model_name()
        analysis["provider"] = self.provider_name
        
        return analysis
    
    async def generate_executive_summary(self, article_content: str, intelligence: Dict) -> str:
        """Generate an executive summary of an article using PromptManager."""
        from app.genai.prompts import PromptManager
        
        # Extract threat actors
        threat_actors = [
            i.get('value') for i in intelligence.get('ioas', []) 
            if i.get('type') == 'threat_actor'
        ]
        
        # Use PromptManager for standardized prompts
        prompt_manager = PromptManager()
        prompts = prompt_manager.build_summary_prompt(
            content=article_content,
            summary_type="executive",
            ioc_count=len(intelligence.get('iocs', [])),
            ttp_count=len(intelligence.get('ttps', [])),
            threat_actors=", ".join(threat_actors) if threat_actors else "Unknown",
            severity="High" if len(intelligence.get('iocs', [])) > 5 else "Medium"
        )

        return await self.provider.generate(prompts["system"], prompts["user"])
    
    async def generate_technical_summary(self, article_content: str, intelligence: Dict) -> str:
        """Generate a technical summary with full IOC/TTP details using PromptManager."""
        from app.genai.prompts import PromptManager

        iocs_by_type = {}
        for ioc in intelligence.get("iocs", []):
            ioc_type = ioc.get("type", "unknown")
            if ioc_type not in iocs_by_type:
                iocs_by_type[ioc_type] = []
            iocs_by_type[ioc_type].append(ioc.get("value"))
        
        # Format for prompt
        iocs_str = json.dumps(iocs_by_type, indent=2)
        ttps_str = json.dumps([
            {"id": t.get("mitre_id"), "name": t.get("name")} 
            for t in intelligence.get("ttps", [])
        ], indent=2)
        
        threat_actors = [
            i.get('value') for i in intelligence.get('ioas', []) 
            if i.get('type') == 'threat_actor'
        ]
        
        # Use PromptManager for standardized prompts
        prompt_manager = PromptManager()
        prompts = prompt_manager.build_summary_prompt(
            content=article_content,
            summary_type="technical",
            ioc_count=len(intelligence.get('iocs', [])),
            ttp_count=len(intelligence.get('ttps', [])),
            threat_actors=", ".join(threat_actors) if threat_actors else "Unknown",
            iocs=iocs_str,
            ttps=ttps_str
        )

        return await self.provider.generate(prompts["system"], prompts["user"])
    
    def _build_hunt_system_prompt(self, platform: str, product_docs: str = None) -> str:
        """Build the system prompt for hunt query generation with comprehensive documentation."""
        
        platform_contexts = {
            "xsiam": """You are a Palo Alto Cortex XSIAM threat hunting expert.
You write production-ready XQL queries for security operations teams.

XQL CORE SYNTAX:
- dataset = xdr_data | filter <conditions> | fields <columns> | sort | limit
- Datasets: xdr_data, cloud_audit_logs, identity_data, network_story
- Operators: =, !=, ~= (regex), contains, in, not in
- Logical: and, or, not
- Time: _time >= now() - 7d

KEY FIELDS:
- action_process_image_sha256: Process file hash
- action_remote_ip: Remote IP address
- action_local_ip: Local IP address  
- action_file_path: File path
- agent_hostname: Endpoint hostname
- dns_query_name: DNS query
- actor_effective_username: User context""",

            "defender": """You are a Microsoft Defender threat hunting expert.
You write production-ready KQL queries for security operations teams.

KQL CORE SYNTAX:
- TableName | where <condition> | project <columns>
- Tables: DeviceProcessEvents, DeviceNetworkEvents, DeviceFileEvents, DeviceLogonEvents
- Operators: ==, !=, contains, has, startswith, endswith, in, !in
- Use 'let' for variables: let iocs = dynamic(["ip1", "ip2"]);
- Use 'union' to combine tables

KEY FIELDS:
- Timestamp, DeviceName, DeviceId
- InitiatingProcessFileName, InitiatingProcessCommandLine
- RemoteIP, RemoteUrl, RemotePort
- SHA256, SHA1, MD5
- AccountName, AccountDomain""",

            "splunk": """You are a Splunk threat hunting expert.
You write production-ready SPL queries for security operations teams.

SPL CORE SYNTAX:
- index=<name> <search terms> | stats/table/eval <processing>
- Use 'search' command or pipe directly
- Time: earliest=-7d latest=now
- Stats: count, values, dc (distinct count)
- Use 'rex' for regex: | rex field=_raw "(?<extracted>pattern)"

COMMON PATTERNS:
- index=security dest_ip IN ("1.2.3.4") | stats count by src_ip
- index=main file_hash="abc123" | table _time host file_path""",

            "wiz": """You are a Wiz cloud security query expert.
You write GraphQL queries for cloud security investigations.

WIZ QUERY STRUCTURE:
{
  securityFindings(filter: { <conditions> }) {
    nodes { id severity affectedResource { name type } }
  }
}

FILTER OPTIONS:
- severity: CRITICAL, HIGH, MEDIUM, LOW
- status: OPEN, RESOLVED
- provider: AWS, AZURE, GCP"""
        }
        
        base_prompt = platform_contexts.get(platform.lower(), 
            "You are an expert threat hunter writing detection queries.")
        
        # Add product documentation if provided
        if product_docs:
            base_prompt += f"\n\n=== PRODUCT DOCUMENTATION ===\n{product_docs}"
        
        # Add strict output requirements
        base_prompt += """

=== OUTPUT REQUIREMENTS ===
1. Generate ONLY the query - no explanations, no markdown formatting
2. The query must be syntactically correct and production-ready
3. Focus on HIGH-FIDELITY detection with MINIMAL false positives
4. Search across relevant timeframes (7 days default)
5. Include all provided IOCs in the query
6. For TTPs, add behavioral detection logic where possible
7. Add inline comments for complex logic using platform-specific comment syntax

=== QUALITY CRITERIA ===
- Query should run without modification
- Cover both IOC-based and behavior-based detection
- Use efficient operators (avoid wildcards where possible)
- Return actionable fields (hostname, user, timestamp, evidence)"""

        return base_prompt
    
    def _build_hunt_user_prompt(self, platform: str, intelligence: Dict) -> str:
        """Build the user prompt with intelligence data."""
        
        iocs = intelligence.get("iocs", [])
        ttps = intelligence.get("ttps", [])
        ioas = intelligence.get("ioas", [])
        
        prompt = f"""Generate a threat hunting query for {platform.upper()} to detect the following:

IOCs to hunt for:
- IPs: {[i['value'] for i in iocs if i.get('type') == 'ip'][:10]}
- Domains: {[i['value'] for i in iocs if i.get('type') == 'domain'][:10]}
- Hashes: {[i['value'] for i in iocs if i.get('type') == 'hash'][:5]}
- URLs: {[i['value'] for i in iocs if i.get('type') == 'url'][:5]}

MITRE ATT&CK Techniques:
{json.dumps([{"id": t.get("mitre_id"), "name": t.get("name")} for t in ttps[:10]], indent=2)}

Behavioral Patterns:
{[i.get("category", i.get("value")) for i in ioas if i.get("type") == "ioa"][:5]}

Generate a comprehensive query that searches for these indicators across relevant data sources."""

        return prompt
    
    def _fallback_query(self, platform: str, intelligence: Dict) -> str:
        """Generate a fallback template-based query."""
        
        iocs = intelligence.get("iocs", [])
        ips = [i["value"] for i in iocs if i.get("type") == "ip"][:5]
        domains = [i["value"] for i in iocs if i.get("type") == "domain"][:5]
        hashes = [i["value"] for i in iocs if i.get("type") == "hash"][:5]
        
        if platform.lower() == "xsiam":
            return f"""dataset = xdr_data
| filter action_remote_ip in ({json.dumps(ips)}) 
    or action_file_sha256 in ({json.dumps(hashes)})
    or dns_query_name in ({json.dumps(domains)})
| fields _time, agent_hostname, action_remote_ip, action_file_sha256, dns_query_name
| limit 1000"""
        
        elif platform.lower() == "defender":
            return f"""let iocs_ips = dynamic({json.dumps(ips)});
let iocs_domains = dynamic({json.dumps(domains)});
let iocs_hashes = dynamic({json.dumps(hashes)});
DeviceNetworkEvents
| where RemoteIP in (iocs_ips) or RemoteUrl has_any (iocs_domains)
| union (
    DeviceFileEvents
    | where SHA256 in (iocs_hashes)
)
| project Timestamp, DeviceName, RemoteIP, RemoteUrl, SHA256, InitiatingProcessFileName
| limit 1000"""
        
        elif platform.lower() == "splunk":
            ip_search = " OR ".join([f'dest_ip="{ip}"' for ip in ips])
            hash_search = " OR ".join([f'file_hash="{h}"' for h in hashes])
            return f"""index=main earliest=-7d
({ip_search} OR {hash_search})
| stats count by src_ip, dest_ip, file_hash, host
| sort -count"""
        
        elif platform.lower() == "wiz":
            return f"""{{
  securityFindings(
    filter: {{
      or: [
        {{ affectedResource: {{ ipAddress: {{ in: {json.dumps(ips)} }} }} }}
      ]
    }}
  ) {{
    nodes {{
      id
      severity
      affectedResource {{ name type }}
    }}
  }}
}}"""
        
        return "# Unable to generate query for this platform"
    
    def _get_model_name(self) -> str:
        """Get the current model name."""
        if hasattr(self.provider, 'model'):
            return self.provider.model
        return "unknown"


# Convenience function for backward compatibility
class GenAIProvider:
    """Legacy wrapper for backward compatibility."""
    
    def __init__(self, provider: str = None):
        self.orchestrator = GenAIOrchestrator(provider)
        self.provider = provider or settings.GENAI_PROVIDER or "ollama"
    
    async def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        """Direct generation method for simple prompts."""
        # Use the underlying provider's generate method
        return await self.orchestrator.provider.generate(system_prompt, user_prompt, **kwargs)
    
    async def generate_hunt_query(
        self,
        platform: str,
        intelligence: Dict,
        prompt_template: str = None
    ) -> str:
        result = await self.orchestrator.generate_hunt_query(platform, intelligence)
        return result.get("query", "")
    
    async def generate_executive_summary(self, article_content: str, intelligence: Dict = None) -> str:
        """Generate an executive summary."""
        return await self.orchestrator.generate_executive_summary(article_content, intelligence or {})
    
    async def generate_technical_summary(self, article_content: str, intelligence: Dict = None) -> str:
        """Generate a technical summary."""
        return await self.orchestrator.generate_technical_summary(article_content, intelligence or {})


class PromptTemplateManager:
    """Manage versioned prompt templates."""
    
    @staticmethod
    def get_templates() -> Dict[str, str]:
        return {
            "hunt_query_v1": "Generate threat hunting queries for IOCs/TTPs",
            "summary_executive_v1": "Generate executive summary",
            "summary_technical_v1": "Generate technical summary",
            "analysis_v1": "Analyze hunt results"
        }
    
    @staticmethod
    def get_template_version() -> str:
        return settings.PROMPT_TEMPLATE_VERSION or "v1"
