# Jyoti - Quick Start & Troubleshooting

## 🚀 One-Command Startup

**Windows:**
```batch
FIX-NOW.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/jyoti-start.sh
./scripts/jyoti-start.sh
```

This automatically:
- ✅ Stops old containers
- ✅ Rebuilds if needed
- ✅ Starts all services
- ✅ Waits for health checks
- ✅ Tests API endpoints
- ✅ Shows login credentials

---

## 🔧 Troubleshooting Scripts

### If you see a BLACK SCREEN:

**Run this immediately:**
```batch
FIX-NOW.bat           # Windows
./scripts/quick-fix.sh  # Linux/Mac
```

This rebuilds the frontend with --no-cache and restarts everything.

---

## 📋 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| **Black screen on localhost:3000** | Run `FIX-NOW.bat` |
| **Backend not responding** | `docker restart parshu-backend-1` |
| **Port already in use** | `docker-compose down` then restart |
| **Database connection error** | `docker restart parshu-postgres-1` |
| **Login not working** | Check credentials below, restart backend |

---

## 🔐 Default Credentials

```
Email:    admin@huntsphere.local
Password: Admin123!@2026
```

Change these in `.env` file.

---

## 📍 Access URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health

---

## 🛠️ Manual Troubleshooting

### Check Container Status
```bash
docker ps
```

All containers should show `(healthy)` status.

### View Logs
```bash
# All containers
docker-compose logs -f

# Specific container
docker logs parshu-backend-1
docker logs parshu-frontend-1
```

### Restart Specific Container
```bash
docker restart parshu-backend-1
docker restart parshu-frontend-1
```

### Complete Rebuild
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Clean Everything (Nuclear Option)
```bash
docker-compose down -v  # WARNING: Deletes database!
docker system prune -a
# Then run FIX-NOW.bat or jyoti-start.sh
```

---

## 🌐 Browser DevTools Debugging

If you see a black screen:

1. **Open DevTools:** Press `F12`
2. **Console Tab:** Look for JavaScript errors (red text)
3. **Network Tab:**
   - Refresh page (Ctrl+R)
   - Check if `/auth/me` or `/health` requests fail
   - Look for CORS errors
4. **Hard Refresh:** `Ctrl+Shift+R` (clears cache)

Common errors and fixes:

| Console Error | Fix |
|---------------|-----|
| `Failed to fetch` | Backend is down, run `docker restart parshu-backend-1` |
| `CORS error` | Check `.env` has `CORS_ORIGINS=http://localhost:3000` |
| `Unexpected token <` | Frontend build is broken, run `FIX-NOW.bat` |
| `Cannot read property of undefined` | Clear browser cache, hard refresh |

---

## 📊 Health Check Endpoints

Test these URLs in your browser:

- **Backend Health:** http://localhost:8000/health
  - Should return: `{"status":"healthy",...}`

- **Frontend:** http://localhost:3000
  - Should show login page (not blank)

---

## 💡 Pro Tips

1. **Always run FIX-NOW.bat first** when you encounter any issue
2. **Check Docker Desktop** is running before starting
3. **Use hard refresh** (Ctrl+Shift+R) after rebuilds
4. **Check .env file** has correct credentials
5. **Port conflicts:** Close other apps using ports 3000 or 8000

---

## 🔄 Update Jyoti

Pull latest changes:
```bash
git checkout Jyoti
git pull origin Jyoti
FIX-NOW.bat  # Rebuild with latest code
```

---

## 📞 Getting Help

If issues persist after running `FIX-NOW.bat`:

1. Check the output of:
   ```bash
   docker-compose logs backend
   docker-compose logs frontend
   ```

2. Copy any error messages

3. Share:
   - Error messages from logs
   - Browser console errors (F12 → Console tab)
   - Output of `docker ps`

---

## 🚦 Startup Checklist

- [ ] Docker Desktop is running
- [ ] Ports 3000 and 8000 are free
- [ ] Ran `FIX-NOW.bat` or `jyoti-start.sh`
- [ ] All containers show `(healthy)` status
- [ ] http://localhost:8000/health returns JSON
- [ ] http://localhost:3000 shows login page
- [ ] Hard refreshed browser (Ctrl+Shift+R)
- [ ] Used correct credentials (see above)

---

## 📁 Project Structure

```
Parshu/
├── FIX-NOW.bat              # ← ONE-COMMAND FIX (Windows)
├── scripts/
│   ├── jyoti-start.sh       # ← Automated startup (Linux/Mac)
│   ├── jyoti-start.bat      # ← Automated startup (Windows)
│   └── quick-fix.sh         # ← Diagnostics & auto-fix
├── docker-compose.yml       # Container orchestration
├── backend/                 # Python FastAPI backend
│   ├── app/
│   └── .env                 # ← Check credentials here
└── frontend/                # React frontend
    └── src/
```

---

## 🎯 Quick Commands Reference

```bash
# Start everything
FIX-NOW.bat

# View logs
docker-compose logs -f

# Restart backend
docker restart parshu-backend-1

# Stop everything
docker-compose down

# Check status
docker ps

# Access database (PostgreSQL)
docker exec -it parshu-postgres-1 psql -U huntsphere_user -d huntsphere_db
```

---

**Need more help?** Check `README_JYOTI.md` for full documentation.
