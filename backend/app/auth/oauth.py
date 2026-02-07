"""OAuth 2.0 authentication for Google and Microsoft."""
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config

# Load config from environment
config = Config('.env')

oauth = OAuth(config)

# Register Google OAuth
oauth.register(
    name='google',
    client_id=config('GOOGLE_CLIENT_ID', default=None),
    client_secret=config('GOOGLE_CLIENT_SECRET', default=None),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

# Register Microsoft OAuth
oauth.register(
    name='microsoft',
    client_id=config('MICROSOFT_CLIENT_ID', default=None),
    client_secret=config('MICROSOFT_CLIENT_SECRET', default=None),
    server_metadata_url='https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)
