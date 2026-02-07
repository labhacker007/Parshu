import asyncio
from app.hunts.connectors import get_connector, XSIAMConnector, DefenderConnector, WizConnector
from app.core import config


def test_get_connector_instances():
    assert isinstance(get_connector('xsiam'), XSIAMConnector)
    assert isinstance(get_connector('defender'), DefenderConnector)
    assert isinstance(get_connector('wiz'), WizConnector)
    assert get_connector('unknown') is None


def test_connector_test_connection_and_execute(monkeypatch):
    class FakeResponse:
        def __init__(self, status_code: int, payload: dict):
            self.status_code = status_code
            self._payload = payload
            self.text = ""

        def json(self):
            return self._payload

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            if "start_xql_query" in url:
                return FakeResponse(200, {"reply": {"query_id": "test-query-id"}})
            if "get_query_results" in url:
                return FakeResponse(200, {"reply": {"status": "SUCCESS", "results": {"data": [{"k": "v"}]}}})
            return FakeResponse(404, {})

    async def _fast_sleep(*args, **kwargs):
        return None

    # Ensure missing creds -> test_connection False and execute_query returns error
    monkeypatch.setattr(config.settings, 'XSIAM_TENANT_ID', None)
    monkeypatch.setattr(config.settings, 'XSIAM_API_KEY', None)
    xc = XSIAMConnector()
    assert not xc.test_connection()
    coro = xc.execute_query('SELECT *')
    result = asyncio.get_event_loop().run_until_complete(coro)
    assert result['status'] == 'error'

    # Provide fake creds -> mock HTTP so execute_query returns completed without real network
    monkeypatch.setattr(config.settings, 'XSIAM_TENANT_ID', 'tenant-1')
    monkeypatch.setattr(config.settings, 'XSIAM_API_KEY', 'key-1')
    monkeypatch.setattr("app.hunts.connectors.httpx.AsyncClient", FakeAsyncClient)
    monkeypatch.setattr("app.hunts.connectors.asyncio.sleep", _fast_sleep)
    xc = XSIAMConnector()
    assert xc.test_connection()
    result = asyncio.get_event_loop().run_until_complete(xc.execute_query('SELECT *'))
    assert result['status'] == 'completed'
    assert result['platform'] == 'xsiam'
