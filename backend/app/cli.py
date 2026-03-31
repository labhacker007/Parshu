"""CLI utilities for admin tasks."""
import click
from app.core.database import SessionLocal
from app.models import User, UserRole
from app.auth.security import hash_password
from app.seeds import seed_database


@click.group()
def cli():
    """Jyoti admin CLI"""
    pass


@cli.command()
@click.option("--email", prompt="Email", help="User email")
@click.option("--username", prompt="Username", help="Username")
@click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True, help="Password")
@click.option("--role", type=click.Choice(["ADMIN", "TI", "TH", "IR", "VIEWER"]), default="VIEWER", help="User role")
def create_user(email, username, password, role):
    """Create a new user"""
    db = SessionLocal()
    try:
        existing = db.query(User).filter((User.email == email) | (User.username == username)).first()
        if existing:
            click.echo(f"❌ User already exists")
            return
        
        user = User(
            email=email,
            username=username,
            hashed_password=hash_password(password),
            role=UserRole[role],
            is_active=True
        )
        db.add(user)
        db.commit()
        click.echo(f"✅ User created: {username} ({role})")
    except Exception as e:
        click.echo(f"❌ Failed to create user: {e}")
    finally:
        db.close()


@cli.command()
def seed():
    """Seed database with default data"""
    try:
        seed_database()
    except Exception as e:
        click.echo(f"❌ Seeding failed: {e}")


@cli.command()
def list_users():
    """List all users"""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        click.echo(f"\n{'ID':<5} {'Email':<30} {'Username':<20} {'Role':<10} {'Active':<10}")
        click.echo("-" * 75)
        for user in users:
            click.echo(f"{user.id:<5} {user.email:<30} {user.username:<20} {user.role.value:<10} {str(user.is_active):<10}")
    finally:
        db.close()


if __name__ == "__main__":
    cli()
