import os

from app.core.database import SessionLocal
from app.models import KnowledgeDocument, KnowledgeDocumentStatus, KnowledgeDocumentType, User


def login_admin(client):
    r = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    assert r.status_code == 200
    return r.json()["access_token"]


def register_and_login(client, email: str):
    uname = email.split("@")[0]
    r = client.post(
        "/auth/register",
        json={"email": email, "username": uname, "password": "User@12345678", "full_name": "User"},
    )
    assert r.status_code in (200, 201, 409)
    r2 = client.post("/auth/login", json={"email": email, "password": "User@12345678"})
    assert r2.status_code == 200
    return r2.json()["access_token"]


def test_knowledge_admin_docs_not_exposed_to_normal_users(client):
    admin_token = login_admin(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    user1_token = register_and_login(client, "kbuser1@example.com")
    user2_token = register_and_login(client, "kbuser2@example.com")
    user1_headers = {"Authorization": f"Bearer {user1_token}"}
    user2_headers = {"Authorization": f"Bearer {user2_token}"}

    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.email == os.environ["ADMIN_EMAIL"]).first()
        u1 = db.query(User).filter(User.email == "kbuser1@example.com").first()
        u2 = db.query(User).filter(User.email == "kbuser2@example.com").first()
        assert admin_user and u1 and u2

        admin_doc = KnowledgeDocument(
            title="Admin KB Doc",
            doc_type=KnowledgeDocumentType.CUSTOM,
            scope="global",
            is_admin_managed=True,
            source_type="url",
            source_url="http://example.com",
            status=KnowledgeDocumentStatus.READY,
            is_active=True,
            raw_content="admin content",
            uploaded_by_id=admin_user.id,
        )
        user_doc = KnowledgeDocument(
            title="User KB Doc",
            doc_type=KnowledgeDocumentType.CUSTOM,
            scope="user",
            is_admin_managed=False,
            source_type="url",
            source_url="http://example.com/user",
            status=KnowledgeDocumentStatus.READY,
            is_active=True,
            raw_content="user content",
            uploaded_by_id=u1.id,
        )
        db.add(admin_doc)
        db.add(user_doc)
        db.commit()
        db.refresh(admin_doc)
        db.refresh(user_doc)
    finally:
        db.close()

    # Admin list endpoint is restricted
    r_list_user = client.get("/knowledge/", headers=user1_headers)
    assert r_list_user.status_code == 403
    r_list_admin = client.get("/knowledge/", headers=admin_headers)
    assert r_list_admin.status_code == 200

    # Admin-managed doc content is not readable by normal users
    r_admin_doc_user = client.get(f"/knowledge/{admin_doc.id}/content", headers=user1_headers)
    assert r_admin_doc_user.status_code == 403
    r_admin_doc_admin = client.get(f"/knowledge/{admin_doc.id}/content", headers=admin_headers)
    assert r_admin_doc_admin.status_code == 200

    # User doc content readable only by owner
    r_user_doc_owner = client.get(f"/knowledge/{user_doc.id}/content", headers=user1_headers)
    assert r_user_doc_owner.status_code == 200
    r_user_doc_other = client.get(f"/knowledge/{user_doc.id}/content", headers=user2_headers)
    assert r_user_doc_other.status_code == 404

