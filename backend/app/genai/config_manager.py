"""
GenAI Configuration Manager

Secure configuration management with multi-level hierarchy and validation.
"""

import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from fastapi import HTTPException, status

from app.core.logging import logger
from app.genai.models import (
    GenAIModelConfig, GenAIRequestLog, GenAIModelRegistry,
    GenAIUsageQuota, ConfigType
)


class GenAIConfigManager:
    """
    Manages GenAI model configurations with security controls.
    
    Features:
    - Multi-level configuration hierarchy (global → model → use-case)
    - Security validation and access control
    - Cost control and quota enforcement
    - Complete audit trail
    - Model whitelisting
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    # ========================================================================
    # CONFIGURATION RETRIEVAL
    # ========================================================================
    
    def get_config(
        self,
        use_case: Optional[str] = None,
        model_identifier: Optional[str] = None,
        user_id: Optional[int] = None,
        user_role: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get effective configuration using hierarchy.
        
        Priority: use_case > model > global
        
        Security checks:
        - Validates user has access to configuration
        - Checks model is enabled and approved
        - Validates quota not exceeded
        """
        
        # Start with global defaults
        global_config = self.db.query(GenAIModelConfig).filter(
            GenAIModelConfig.config_type == ConfigType.GLOBAL,
            GenAIModelConfig.is_active == True
        ).first()
        
        if not global_config:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No global configuration found"
            )
        
        config = self._config_to_dict(global_config)
        
        # Override with model-specific config if provided
        if model_identifier:
            model_config = self.db.query(GenAIModelConfig).filter(
                GenAIModelConfig.config_type == ConfigType.MODEL,
                GenAIModelConfig.model_identifier == model_identifier,
                GenAIModelConfig.is_active == True
            ).first()
            
            if model_config:
                config.update(self._config_to_dict(model_config))
        
        # Override with use-case specific config (highest priority)
        if use_case:
            use_case_config = self.db.query(GenAIModelConfig).filter(
                GenAIModelConfig.config_type == ConfigType.USE_CASE,
                GenAIModelConfig.use_case == use_case,
                GenAIModelConfig.is_active == True
            ).first()
            
            if use_case_config:
                config.update(self._config_to_dict(use_case_config))
                
                # Security: Check access control
                if not self._check_access(use_case_config, user_id, user_role):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied to this configuration"
                    )
        
        # Validate and get model
        if config.get('preferred_model'):
            model = self._validate_model(config['preferred_model'])
            config['model_details'] = {
                'identifier': model.model_identifier,
                'provider': model.provider,
                'display_name': model.display_name,
                'max_context_length': model.max_context_length,
                'cost_per_1k_input': model.cost_per_1k_input_tokens,
                'cost_per_1k_output': model.cost_per_1k_output_tokens,
                'is_free': model.is_free,
                'is_local': model.is_local
            }
        
        # Check quotas if user provided
        if user_id:
            self._check_quota(user_id, user_role)
        
        return config
    
    def _config_to_dict(self, config: GenAIModelConfig) -> Dict[str, Any]:
        """Convert config model to dictionary."""
        return {
            'config_id': config.id,
            'config_name': config.config_name,
            'config_type': config.config_type,
            'preferred_model': config.preferred_model or config.model_identifier,
            'temperature': config.temperature,
            'max_tokens': config.max_tokens,
            'top_p': config.top_p,
            'frequency_penalty': config.frequency_penalty,
            'presence_penalty': config.presence_penalty,
            'stop_sequences': config.stop_sequences or [],
            'timeout_seconds': config.timeout_seconds,
            'retry_attempts': config.retry_attempts,
            'max_cost_per_request': config.max_cost_per_request,
            'fallback_model': config.fallback_model,
            'daily_request_limit': config.daily_request_limit
        }
    
    # ========================================================================
    # SECURITY VALIDATION
    # ========================================================================
    
    def _check_access(
        self,
        config: GenAIModelConfig,
        user_id: Optional[int],
        user_role: Optional[str]
    ) -> bool:
        """Check if user has access to configuration."""
        
        # If no restrictions, allow
        if not config.allowed_users and not config.allowed_roles:
            return True
        
        # Check user whitelist
        if config.allowed_users and user_id:
            if user_id in config.allowed_users:
                return True
        
        # Check role whitelist
        if config.allowed_roles and user_role:
            if user_role in config.allowed_roles:
                return True
        
        return False
    
    def _validate_model(self, model_identifier: str) -> GenAIModelRegistry:
        """Validate model is registered, enabled, and approved."""
        
        model = self.db.query(GenAIModelRegistry).filter(
            GenAIModelRegistry.model_identifier == model_identifier
        ).first()
        
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model {model_identifier} not registered"
            )
        
        if not model.is_enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Model {model_identifier} is disabled"
            )
        
        if model.requires_admin_approval and not model.approved_at:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Model {model_identifier} not approved"
            )
        
        return model

    def validate_model_for_use_case(
        self,
        model_identifier: str,
        use_case: Optional[str],
        user_role: Optional[str] = None
    ) -> GenAIModelRegistry:
        """Ensure the requested model is allowed for this use case + role."""
        model = self._validate_model(model_identifier)

        allowed_use_cases = model.allowed_for_use_cases or []
        if allowed_use_cases and use_case and use_case not in allowed_use_cases:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Model {model_identifier} not allowed for use case '{use_case}'"
            )

        restricted_roles = model.restricted_to_roles or []
        if restricted_roles and user_role and user_role not in restricted_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Model {model_identifier} not available for role '{user_role}'"
            )

        return model
    
    def _check_quota(self, user_id: int, user_role: Optional[str] = None):
        """Check if user has exceeded quota."""
        
        # Check user-specific quota
        user_quota = self.db.query(GenAIUsageQuota).filter(
            GenAIUsageQuota.quota_type == "user",
            GenAIUsageQuota.user_id == user_id,
            GenAIUsageQuota.is_active == True
        ).first()
        
        if user_quota:
            self._reset_quota_if_needed(user_quota)
            
            if user_quota.is_exceeded:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="User quota exceeded"
                )
            
            # Check limits
            if user_quota.daily_request_limit:
                if user_quota.current_daily_requests >= user_quota.daily_request_limit:
                    user_quota.is_exceeded = True
                    self.db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Daily request limit exceeded"
                    )
            
            if user_quota.daily_cost_limit:
                if user_quota.current_daily_cost >= user_quota.daily_cost_limit:
                    user_quota.is_exceeded = True
                    self.db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Daily cost limit exceeded"
                    )
        
        # Check role-specific quota
        if user_role:
            role_quota = self.db.query(GenAIUsageQuota).filter(
                GenAIUsageQuota.quota_type == "role",
                GenAIUsageQuota.role_name == user_role,
                GenAIUsageQuota.is_active == True
            ).first()
            
            if role_quota:
                self._reset_quota_if_needed(role_quota)
                
                if role_quota.is_exceeded:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Role quota exceeded"
                    )
    
    def _reset_quota_if_needed(self, quota: GenAIUsageQuota):
        """Reset quota counters if period expired."""
        now = datetime.utcnow()
        
        # Daily reset
        if (now - quota.last_daily_reset).days >= 1:
            quota.current_daily_requests = 0
            quota.current_daily_cost = 0.0
            quota.current_daily_tokens = 0
            quota.last_daily_reset = now
            quota.is_exceeded = False
        
        # Monthly reset
        if (now - quota.last_monthly_reset).days >= 30:
            quota.current_monthly_requests = 0
            quota.current_monthly_cost = 0.0
            quota.current_monthly_tokens = 0
            quota.last_monthly_reset = now
            quota.is_exceeded = False
        
        self.db.commit()
    
    # ========================================================================
    # REQUEST LOGGING
    # ========================================================================
    
    def log_request(
        self,
        use_case: str,
        model_used: str,
        config_id: Optional[int],
        user_id: Optional[int],
        prompt: str,
        response: str,
        tokens_used: int,
        response_time_ms: int,
        was_successful: bool,
        error_message: Optional[str] = None,
        user_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        article_id: Optional[int] = None,
        hunt_id: Optional[int] = None,
        **kwargs
    ) -> GenAIRequestLog:
        """
        Log GenAI request with complete audit trail.
        
        Security features:
        - Never logs actual prompt/response (only metadata)
        - Calculates cost
        - Updates quotas
        - Tracks performance
        """
        
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # Calculate prompt hash for deduplication
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
        
        # Get model for cost calculation
        model = self.db.query(GenAIModelRegistry).filter(
            GenAIModelRegistry.model_identifier == model_used
        ).first()
        
        # Calculate cost
        cost_usd = 0.0
        if model and not model.is_free:
            # Estimate input/output tokens (rough split)
            input_tokens = len(prompt.split()) * 1.3  # Rough estimate
            output_tokens = tokens_used - input_tokens
            
            if model.cost_per_1k_input_tokens:
                cost_usd += (input_tokens / 1000) * model.cost_per_1k_input_tokens
            if model.cost_per_1k_output_tokens:
                cost_usd += (output_tokens / 1000) * model.cost_per_1k_output_tokens
        
        # Create log entry
        log = GenAIRequestLog(
            request_id=request_id,
            use_case=use_case,
            model_used=model_used,
            config_id=config_id,
            prompt_length=len(prompt),
            prompt_hash=prompt_hash,
            temperature=kwargs.get('temperature'),
            max_tokens=kwargs.get('max_tokens'),
            top_p=kwargs.get('top_p'),
            response_length=len(response) if response else None,
            tokens_used=tokens_used,
            response_time_ms=response_time_ms,
            cost_usd=cost_usd,
            was_successful=was_successful,
            error_message=error_message,
            error_type=kwargs.get('error_type'),
            user_id=user_id,
            user_ip=user_ip,
            user_agent=user_agent,
            article_id=article_id,
            hunt_id=hunt_id,
            created_at=datetime.utcnow()
        )
        
        self.db.add(log)
        
        # Update quotas
        if user_id:
            self._update_quota(user_id, cost_usd, tokens_used)
        
        # Update model statistics
        if model:
            model.total_requests += 1
            model.total_cost += cost_usd
            model.last_used_at = datetime.utcnow()
            
            # Update averages
            if model.avg_response_time_ms:
                model.avg_response_time_ms = int(
                    (model.avg_response_time_ms + response_time_ms) / 2
                )
            else:
                model.avg_response_time_ms = response_time_ms
        
        # Update config statistics
        if config_id:
            config = self.db.query(GenAIModelConfig).get(config_id)
            if config:
                config.total_requests += 1
                config.last_used_at = datetime.utcnow()
                
                if was_successful:
                    # Update averages
                    if config.avg_response_time_ms:
                        config.avg_response_time_ms = int(
                            (config.avg_response_time_ms + response_time_ms) / 2
                        )
                    else:
                        config.avg_response_time_ms = response_time_ms
                    
                    if config.avg_tokens_used:
                        config.avg_tokens_used = int(
                            (config.avg_tokens_used + tokens_used) / 2
                        )
                    else:
                        config.avg_tokens_used = tokens_used
                    
                    if config.avg_cost_per_request:
                        config.avg_cost_per_request = (
                            config.avg_cost_per_request + cost_usd
                        ) / 2
                    else:
                        config.avg_cost_per_request = cost_usd
        
        self.db.commit()
        
        logger.info(
            "genai_request_logged",
            request_id=request_id,
            use_case=use_case,
            model=model_used,
            cost=cost_usd,
            success=was_successful
        )
        
        return log
    
    def _update_quota(self, user_id: int, cost: float, tokens: int):
        """Update user quota after request."""
        
        quota = self.db.query(GenAIUsageQuota).filter(
            GenAIUsageQuota.quota_type == "user",
            GenAIUsageQuota.user_id == user_id,
            GenAIUsageQuota.is_active == True
        ).first()
        
        if quota:
            quota.current_daily_requests += 1
            quota.current_monthly_requests += 1
            quota.current_daily_cost += cost
            quota.current_monthly_cost += cost
            quota.current_daily_tokens += tokens
            quota.current_monthly_tokens += tokens
            self.db.commit()
    
    # ========================================================================
    # MODEL REGISTRY
    # ========================================================================
    
    def get_available_models(
        self,
        provider: Optional[str] = None,
        is_free: Optional[bool] = None,
        is_local: Optional[bool] = None,
        use_case: Optional[str] = None
    ) -> List[GenAIModelRegistry]:
        """Get available models with filters."""
        
        query = self.db.query(GenAIModelRegistry).filter(
            GenAIModelRegistry.is_enabled == True
        )
        
        if provider:
            query = query.filter(GenAIModelRegistry.provider == provider)
        
        if is_free is not None:
            query = query.filter(GenAIModelRegistry.is_free == is_free)
        
        if is_local is not None:
            query = query.filter(GenAIModelRegistry.is_local == is_local)
        
        if use_case:
            # Filter by use case if model has restrictions
            query = query.filter(
                or_(
                    GenAIModelRegistry.allowed_for_use_cases == None,
                    GenAIModelRegistry.allowed_for_use_cases.contains([use_case])
                )
            )
        
        return query.order_by(
            GenAIModelRegistry.provider,
            GenAIModelRegistry.cost_per_1k_input_tokens
        ).all()
    
    def get_model_by_identifier(self, model_identifier: str) -> Optional[GenAIModelRegistry]:
        """Get model by identifier."""
        return self.db.query(GenAIModelRegistry).filter(
            GenAIModelRegistry.model_identifier == model_identifier
        ).first()
    
    # ========================================================================
    # STATISTICS
    # ========================================================================
    
    def get_usage_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        user_id: Optional[int] = None,
        use_case: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get usage statistics."""
        
        query = self.db.query(GenAIRequestLog)
        
        if start_date:
            query = query.filter(GenAIRequestLog.created_at >= start_date)
        
        if end_date:
            query = query.filter(GenAIRequestLog.created_at <= end_date)
        
        if user_id:
            query = query.filter(GenAIRequestLog.user_id == user_id)
        
        if use_case:
            query = query.filter(GenAIRequestLog.use_case == use_case)
        
        logs = query.all()
        
        if not logs:
            return {
                'total_requests': 0,
                'total_cost': 0.0,
                'total_tokens': 0,
                'avg_response_time_ms': 0,
                'success_rate': 0.0
            }
        
        total_requests = len(logs)
        total_cost = sum(log.cost_usd or 0 for log in logs)
        total_tokens = sum(log.tokens_used or 0 for log in logs)
        avg_response_time = sum(log.response_time_ms or 0 for log in logs) / total_requests
        successful = sum(1 for log in logs if log.was_successful)
        success_rate = (successful / total_requests) * 100
        
        return {
            'total_requests': total_requests,
            'total_cost': round(total_cost, 4),
            'total_tokens': total_tokens,
            'avg_response_time_ms': int(avg_response_time),
            'success_rate': round(success_rate, 2),
            'successful_requests': successful,
            'failed_requests': total_requests - successful
        }
