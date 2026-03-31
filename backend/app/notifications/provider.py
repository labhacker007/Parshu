"""Notification handlers for Email and Slack with actual sending capability."""
import smtplib
import ssl
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional, Dict
from datetime import datetime
from app.core.config import settings
from app.core.logging import logger


class EmailNotifier:
    """Send email notifications via SMTP."""
    
    def __init__(self, 
                 smtp_host: str = None, 
                 smtp_port: int = None,
                 smtp_user: str = None, 
                 smtp_password: str = None,
                 use_tls: bool = True):
        self.smtp_host = smtp_host or settings.SMTP_HOST
        self.smtp_port = smtp_port or settings.SMTP_PORT
        self.smtp_user = smtp_user or settings.SMTP_USER
        self.smtp_password = smtp_password or settings.SMTP_PASSWORD
        self.use_tls = use_tls
    
    def _create_connection(self):
        """Create SMTP connection with TLS."""
        if not self.smtp_host or not self.smtp_user:
            raise ValueError("SMTP configuration is incomplete")
        
        context = ssl.create_default_context()
        
        if self.smtp_port == 465:
            # SSL connection
            server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, context=context)
        else:
            # STARTTLS connection
            server = smtplib.SMTP(self.smtp_host, self.smtp_port)
            if self.use_tls:
                server.starttls(context=context)
        
        server.login(self.smtp_user, self.smtp_password)
        return server
    
    def send_email(
        self,
        to_emails: List[str],
        subject: str,
        body_html: str,
        body_text: str = None,
        attachments: List[Dict] = None,
        cc_emails: List[str] = None,
        bcc_emails: List[str] = None
    ) -> bool:
        """Send an email with HTML content and optional attachments.
        
        Args:
            to_emails: List of recipient email addresses
            subject: Email subject
            body_html: HTML body content
            body_text: Plain text fallback (auto-generated if not provided)
            attachments: List of dicts with 'filename', 'content', 'content_type'
            cc_emails: CC recipients
            bcc_emails: BCC recipients
            
        Returns:
            bool: True if email sent successfully
        """
        if not self.smtp_host or not self.smtp_user:
            logger.warning("email_config_missing")
            return False
        
        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = self.smtp_user
            msg["To"] = ", ".join(to_emails)
            msg["Subject"] = subject
            
            if cc_emails:
                msg["Cc"] = ", ".join(cc_emails)
            
            # Attach plain text
            if body_text:
                msg.attach(MIMEText(body_text, "plain"))
            
            # Attach HTML
            msg.attach(MIMEText(body_html, "html"))
            
            # Add attachments
            if attachments:
                for attachment in attachments:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(attachment["content"])
                    encoders.encode_base64(part)
                    part.add_header(
                        "Content-Disposition",
                        f"attachment; filename={attachment['filename']}"
                    )
                    msg.attach(part)
            
            # Build recipient list
            all_recipients = to_emails.copy()
            if cc_emails:
                all_recipients.extend(cc_emails)
            if bcc_emails:
                all_recipients.extend(bcc_emails)
            
            # Send email
            server = self._create_connection()
            server.sendmail(self.smtp_user, all_recipients, msg.as_string())
            server.quit()
            
            logger.info("email_sent", recipients=len(all_recipients), subject=subject[:50])
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error("email_auth_failed", error=str(e))
            return False
        except smtplib.SMTPException as e:
            logger.error("email_smtp_error", error=str(e))
            return False
        except Exception as e:
            logger.error("email_send_failed", error=str(e))
            return False
    
    def send_hunt_alert(
        self, 
        recipient_email: str, 
        hunt_platform: str, 
        article_title: str, 
        results_count: int,
        query: str = None,
        results_summary: List[Dict] = None
    ) -> bool:
        """Send hunt execution alert via email."""
        subject = f"🎯 Hunt Alert - {hunt_platform.upper()} - {results_count} Results Found"
        
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 20px; border-radius: 10px;">
                <h1 style="margin: 0;">🎯 Threat Hunt Completed</h1>
                <p style="font-size: 14px; opacity: 0.8;">Open Threat Feed & Hunt Workbench</p>
            </div>
            
            <div style="padding: 20px; background: #f5f5f5; margin-top: 20px; border-radius: 10px;">
                <h2 style="color: #1a1a2e;">Execution Summary</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Platform:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">{hunt_platform.upper()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Article:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">{article_title}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Results Found:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                            <span style="background: {'#e74c3c' if results_count > 0 else '#27ae60'}; 
                                         color: white; padding: 5px 15px; border-radius: 15px;">
                                {results_count}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Executed At:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</td>
                    </tr>
                </table>
            </div>
            
            {f'''
            <div style="padding: 20px; background: #fff3cd; margin-top: 20px; border-radius: 10px; border-left: 4px solid #ffc107;">
                <h3 style="color: #856404; margin-top: 0;">⚠️ Action Required</h3>
                <p style="color: #856404;">
                    {results_count} potential threat indicators were found. 
                    Please review the results in the dashboard and take appropriate action.
                </p>
            </div>
            ''' if results_count > 0 else ''}
            
            {f'''
            <div style="padding: 20px; margin-top: 20px;">
                <h3>Query Used:</h3>
                <pre style="background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 5px; overflow-x: auto;">{query[:500]}...</pre>
            </div>
            ''' if query else ''}
            
            <div style="padding: 20px; text-align: center; margin-top: 20px;">
                <a href="{getattr(settings, 'APP_URL', 'http://localhost:3000')}/hunts" 
                   style="background: #1a1a2e; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                    View Full Results in Dashboard
                </a>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                <p>This is an automated notification from Jyoti</p>
            </div>
        </body>
        </html>
        """
        
        body_text = f"""
Hunt Execution Alert - {hunt_platform.upper()}

Platform: {hunt_platform}
Article: {article_title}
Results Found: {results_count}
Executed At: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}

{'ACTION REQUIRED: Potential threats detected!' if results_count > 0 else 'No threats detected.'}

Log in to the dashboard for full details.
"""
        
        return self.send_email([recipient_email], subject, body_html, body_text)
    
    def send_report_share(
        self,
        recipient_emails: List[str],
        report_title: str,
        report_content: str,
        report_type: str,
        generated_by: str
    ) -> bool:
        """Send a shared report via email."""
        subject = f"📊 Threat Intelligence Report: {report_title}"
        
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 20px; border-radius: 10px;">
                <h1 style="margin: 0;">📊 Threat Intelligence Report</h1>
                <p style="font-size: 14px; opacity: 0.8;">{report_type.title()} Report</p>
            </div>
            
            <div style="padding: 20px;">
                <h2>{report_title}</h2>
                <p style="color: #666;">Generated by: {generated_by} | Date: {datetime.utcnow().strftime('%Y-%m-%d')}</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin-top: 20px;">
                    {report_content.replace(chr(10), '<br>')}
                </div>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                <p>This report was shared from Jyoti - News Feed Platform</p>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(recipient_emails, subject, body_html, report_content)


class SlackNotifier:
    """Send Slack notifications using the Slack SDK."""
    
    def __init__(self, bot_token: str = None, default_channel: str = None):
        self.bot_token = bot_token or settings.SLACK_BOT_TOKEN
        self.default_channel = default_channel or settings.SLACK_CHANNEL_ALERTS
    
    def _get_client(self):
        """Get Slack WebClient instance."""
        if not self.bot_token:
            raise ValueError("Slack bot token not configured")
        
        from slack_sdk import WebClient
        return WebClient(token=self.bot_token)
    
    def send_message(
        self,
        channel: str,
        text: str,
        blocks: List[Dict] = None,
        thread_ts: str = None
    ) -> bool:
        """Send a message to a Slack channel.
        
        Args:
            channel: Channel ID or name (e.g., #alerts or C1234567890)
            text: Fallback text for notifications
            blocks: Slack Block Kit blocks for rich formatting
            thread_ts: Thread timestamp to reply in a thread
            
        Returns:
            bool: True if message sent successfully
        """
        if not self.bot_token:
            logger.warning("slack_config_missing")
            return False
        
        try:
            client = self._get_client()
            
            kwargs = {
                "channel": channel,
                "text": text,
            }
            
            if blocks:
                kwargs["blocks"] = blocks
            
            if thread_ts:
                kwargs["thread_ts"] = thread_ts
            
            response = client.chat_postMessage(**kwargs)
            
            if response["ok"]:
                logger.info("slack_message_sent", channel=channel)
                return True
            else:
                logger.error("slack_message_failed", error=response.get("error"))
                return False
                
        except Exception as e:
            logger.error("slack_send_error", error=str(e))
            return False
    
    def send_hunt_alert(
        self,
        channel: str,
        hunt_platform: str,
        article_title: str,
        results_count: int,
        query: str = None,
        hunt_id: int = None,
        executed_by: str = None
    ) -> bool:
        """Send hunt execution alert via Slack with rich formatting."""
        
        # Determine color based on results
        color = "#e74c3c" if results_count > 0 else "#27ae60"
        status_emoji = "🚨" if results_count > 0 else "✅"
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🎯 Hunt Execution Complete",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Platform:*\n{hunt_platform.upper()}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Results Found:*\n{status_emoji} {results_count}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Article:*\n{article_title[:50]}..."
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Executed At:*\n{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
                    }
                ]
            },
            {
                "type": "divider"
            }
        ]
        
        # Add alert section if results found
        if results_count > 0:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"⚠️ *Action Required*: {results_count} potential threat indicators found. Review immediately."
                }
            })
        
        # Add query snippet if provided
        if query:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Query:*\n```{query[:300]}{'...' if len(query) > 300 else ''}```"
                }
            })
        
        # Add action buttons
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View Results",
                        "emoji": True
                    },
                    "url": f"{getattr(settings, 'APP_URL', 'http://localhost:3000')}/hunts/{hunt_id}" if hunt_id else f"{getattr(settings, 'APP_URL', 'http://localhost:3000')}/hunts",
                    "style": "primary"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View Article",
                        "emoji": True
                    },
                    "url": f"{getattr(settings, 'APP_URL', 'http://localhost:3000')}/articles"
                }
            ]
        })
        
        # Add context
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Executed by: {executed_by or 'System'} | Hunt ID: {hunt_id or 'N/A'}"
                }
            ]
        })
        
        text = f"Hunt completed on {hunt_platform}: {results_count} results found for '{article_title}'"
        
        return self.send_message(channel, text, blocks)
    
    def send_high_priority_article_alert(
        self,
        channel: str,
        article_title: str,
        article_url: str,
        matched_keywords: List[str],
        source_name: str
    ) -> bool:
        """Alert when a high-priority article is detected from watchlist keywords."""
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🚨 High Priority Article Detected",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{article_title}*"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Source:*\n{source_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Matched Keywords:*\n{', '.join(matched_keywords[:5])}"
                    }
                ]
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Review Article",
                            "emoji": True
                        },
                        "url": f"{getattr(settings, 'APP_URL', 'http://localhost:3000')}/articles",
                        "style": "primary"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View Original",
                            "emoji": True
                        },
                        "url": article_url
                    }
                ]
            }
        ]
        
        text = f"High priority article detected: {article_title}"
        
        return self.send_message(channel, text, blocks)
    
    def send_error_alert(
        self,
        channel: str,
        error_type: str,
        error_message: str,
        context: Dict = None
    ) -> bool:
        """Send an error alert to Slack."""
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "❌ Error Alert",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Error Type:* {error_type}\n*Message:* {error_message}"
                }
            }
        ]
        
        if context:
            context_text = "\n".join([f"• {k}: {v}" for k, v in context.items()])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Context:*\n{context_text}"
                }
            })
        
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}"
                }
            ]
        })
        
        return self.send_message(channel, f"Error: {error_type} - {error_message}", blocks)


class NotificationManager:
    """Unified notification manager for sending alerts across channels."""
    
    def __init__(self):
        self.email = EmailNotifier()
        self.slack = SlackNotifier()
    
    def send_hunt_completed(
        self,
        hunt_platform: str,
        article_title: str,
        results_count: int,
        query: str = None,
        hunt_id: int = None,
        executed_by: str = None,
        notify_emails: List[str] = None,
        notify_slack_channel: str = None
    ) -> Dict[str, bool]:
        """Send hunt completion notification to all configured channels."""
        results = {}
        
        # Send email notifications
        if notify_emails:
            for email in notify_emails:
                results[f"email:{email}"] = self.email.send_hunt_alert(
                    recipient_email=email,
                    hunt_platform=hunt_platform,
                    article_title=article_title,
                    results_count=results_count,
                    query=query
                )
        
        # Send Slack notification
        if notify_slack_channel or self.slack.default_channel:
            channel = notify_slack_channel or self.slack.default_channel
            results[f"slack:{channel}"] = self.slack.send_hunt_alert(
                channel=channel,
                hunt_platform=hunt_platform,
                article_title=article_title,
                results_count=results_count,
                query=query,
                hunt_id=hunt_id,
                executed_by=executed_by
            )
        
        return results
    
    def send_high_priority_alert(
        self,
        article_title: str,
        article_url: str,
        matched_keywords: List[str],
        source_name: str,
        notify_slack_channel: str = None
    ) -> Dict[str, bool]:
        """Send high-priority article alert."""
        results = {}
        
        channel = notify_slack_channel or self.slack.default_channel
        if channel:
            results[f"slack:{channel}"] = self.slack.send_high_priority_article_alert(
                channel=channel,
                article_title=article_title,
                article_url=article_url,
                matched_keywords=matched_keywords,
                source_name=source_name
            )
        
        return results