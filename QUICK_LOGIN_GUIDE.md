# Quick Login Guide - HuntSphere Platform

**Status:** ✅ Login is working!

---

## 🚀 Quick Start

### Login Credentials

```
Username: admin
Password: Admin@123
```

### Web Interface

1. Open browser: http://localhost:3000
2. Enter credentials above
3. Click "Login"

### API Login

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"Admin@123"}'
```

---

## ✅ System Status

```bash
# Check all services
docker-compose ps

# Expected output:
# backend   - Up (healthy)
# frontend  - Up
# postgres  - Up (healthy)
# redis     - Up (healthy)
```

---

## 🔧 Troubleshooting

### If Login Fails

1. **Check backend is running:**
   ```bash
   curl http://localhost:8000/health
   ```

2. **Restart backend:**
   ```bash
   docker-compose restart backend
   ```

3. **Check logs:**
   ```bash
   docker-compose logs backend --tail=50
   ```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid credentials" | Use: admin / Admin@123 |
| "Cannot connect" | Run: `docker-compose up -d` |
| "Backend unhealthy" | Run: `docker-compose restart backend` |
| "Token expired" | Login again to get new token |

---

## 📚 Related Documents

- **LOGIN_FIX_SUMMARY.md** - Detailed fix explanation
- **ROLLBACK_SECURITY_CHANGES.md** - Configuration changes
- **CODE_REVIEW_SUMMARY.md** - Complete review results
- **SECURITY.md** - Security policy

---

## 🎯 What Was Fixed

1. ✅ Configuration validation (too strict → development-friendly)
2. ✅ Password hashing (added legacy support)
3. ✅ Docker defaults (no .env needed for dev)
4. ✅ JWT tokens (enhanced security claims)

---

## 🔒 Security Notes

- **Development mode** - Uses default credentials
- **Production mode** - Requires secure .env configuration
- **Password migration** - Automatic upgrade to Argon2id on login
- **JWT security** - Enhanced claims (jti, iss, aud, iat, nbf)

---

**Last Updated:** January 28, 2026  
**Status:** ✅ All systems operational
