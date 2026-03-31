"""ServiceNow SecOps integration for incident creation."""
import httpx
from typing import Dict, Optional
from app.core.config import settings
from app.core.logging import logger


class ServiceNowClient:
    """Client for ServiceNow SecOps API."""
    
    def __init__(self, instance_url: Optional[str] = None, username: Optional[str] = None, password: Optional[str] = None):
        self.instance_url = instance_url or settings.SERVICENOW_INSTANCE_URL
        self.username = username or settings.SERVICENOW_USERNAME
        self.password = password or settings.SERVICENOW_PASSWORD
        self.api_base = f"{self.instance_url}/api/now"
    
    async def create_security_incident(
        self,
        short_description: str,
        description: str,
        priority: int = 3,
        category: str = "threat_intelligence",
        assignment_group: Optional[str] = None,
        additional_fields: Optional[Dict] = None
    ) -> Optional[str]:
        """Create a security incident in ServiceNow.
        
        Args:
            short_description: Brief title of the incident
            description: Detailed description
            priority: 1 (Critical) to 5 (Planning)
            category: Incident category
            assignment_group: Group to assign the incident to
            additional_fields: Additional fields to set
            
        Returns:
            Incident sys_id if successful, None otherwise
        """
        if not self.instance_url or not self.username or not self.password:
            logger.warning("servicenow_not_configured")
            return None
        
        try:
            # Prepare incident data
            incident_data = {
                "short_description": short_description,
                "description": description,
                "priority": priority,
                "category": category,
                "impact": 2 if priority <= 2 else 3,  # High impact for critical/high priority
                "urgency": 2 if priority <= 2 else 3,
                "state": 1,  # New
                "caller_id": self.username,
            }
            
            if assignment_group:
                incident_data["assignment_group"] = assignment_group
            
            if additional_fields:
                incident_data.update(additional_fields)
            
            # Create incident via REST API
            url = f"{self.api_base}/table/incident"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    json=incident_data,
                    auth=(self.username, self.password),
                    headers={"Content-Type": "application/json", "Accept": "application/json"}
                )
                
                if response.status_code == 201:
                    result = response.json()
                    incident_sys_id = result.get("result", {}).get("sys_id")
                    incident_number = result.get("result", {}).get("number")
                    
                    logger.info(
                        "servicenow_incident_created",
                        incident_number=incident_number,
                        sys_id=incident_sys_id
                    )
                    
                    return incident_number  # Return incident number for tracking
                else:
                    logger.error(
                        "servicenow_incident_creation_failed",
                        status_code=response.status_code,
                        response=response.text
                    )
                    return None
        
        except Exception as e:
            logger.error("servicenow_api_error", error=str(e))
            return None
    
    async def update_incident(self, incident_number: str, update_data: Dict) -> bool:
        """Update an existing incident.
        
        Args:
            incident_number: Incident number (e.g., INC0010001)
            update_data: Fields to update
            
        Returns:
            True if successful, False otherwise
        """
        if not self.instance_url or not self.username or not self.password:
            logger.warning("servicenow_not_configured")
            return False
        
        try:
            url = f"{self.api_base}/table/incident"
            params = {"sysparm_query": f"number={incident_number}"}
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.patch(
                    url,
                    params=params,
                    json=update_data,
                    auth=(self.username, self.password),
                    headers={"Content-Type": "application/json", "Accept": "application/json"}
                )
                
                if response.status_code == 200:
                    logger.info("servicenow_incident_updated", incident_number=incident_number)
                    return True
                else:
                    logger.error(
                        "servicenow_incident_update_failed",
                        incident_number=incident_number,
                        status_code=response.status_code
                    )
                    return False
        
        except Exception as e:
            logger.error("servicenow_update_error", error=str(e))
            return False
    
    async def get_incident(self, incident_number: str) -> Optional[Dict]:
        """Get incident details.
        
        Args:
            incident_number: Incident number
            
        Returns:
            Incident data if found, None otherwise
        """
        if not self.instance_url or not self.username or not self.password:
            return None
        
        try:
            url = f"{self.api_base}/table/incident"
            params = {"sysparm_query": f"number={incident_number}", "sysparm_limit": 1}
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    url,
                    params=params,
                    auth=(self.username, self.password),
                    headers={"Accept": "application/json"}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    incidents = result.get("result", [])
                    return incidents[0] if incidents else None
                else:
                    return None
        
        except Exception as e:
            logger.error("servicenow_get_error", error=str(e))
            return None


async def create_threat_hunt_incident(
    article_title: str,
    article_url: str,
    hunt_platform: str,
    hits_count: int,
    findings_summary: str,
    hunt_execution_id: int
) -> Optional[str]:
    """Create a ServiceNow incident for threat hunt findings.
    
    Args:
        article_title: Title of the threat intelligence article
        article_url: URL to the article
        hunt_platform: Platform where hunt was executed
        hits_count: Number of hits found
        findings_summary: Summary of findings
        hunt_execution_id: ID of the hunt execution
        
    Returns:
        Incident number if created, None otherwise
    """
    client = ServiceNowClient()
    
    short_description = f"Threat Hunt Alert: {hits_count} hits found - {article_title[:80]}"
    
    description = f"""
Automated Threat Hunt Alert

Article: {article_title}
Source: {article_url}
Platform: {hunt_platform}
Hits Found: {hits_count}
Hunt Execution ID: {hunt_execution_id}

Findings Summary:
{findings_summary}

This incident was automatically created by the Jyoti platform based on news intelligence analysis.
Please review the findings and take appropriate action.
"""
    
    # Priority based on hit count
    if hits_count >= 10:
        priority = 1  # Critical
    elif hits_count >= 5:
        priority = 2  # High
    else:
        priority = 3  # Moderate
    
    incident_number = await client.create_security_incident(
        short_description=short_description,
        description=description.strip(),
        priority=priority,
        category="threat_intelligence",
        additional_fields={
            "u_threat_source": "Jyoti",
            "u_hunt_platform": hunt_platform,
            "u_hits_count": hits_count,
            "u_hunt_execution_id": hunt_execution_id
        }
    )
    
    return incident_number
