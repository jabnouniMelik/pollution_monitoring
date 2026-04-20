# Quick Test Guide

## 🚀 Run Tests in 30 Seconds

```bash
cd backend
npm run test:services
```

**Expected Result:** 28/28 tests passed ✅

---

## 📋 All Test Commands

```bash
# Integration tests (MongoDB only)
npm test

# Service layer error tests (MongoDB only)
npm run test:services

# HTTP error tests (requires server)
npm run test:errors

# Initialize test data
npm run init:simulator
```

---

## ✅ What's Tested

### Service Layer (28 tests)
- ✅ ReadingService error handling
- ✅ AlertService error handling
- ✅ AuthService error handling
- ✅ SensorService error handling
- ✅ Alert engine threshold logic

### Error Types
- ✅ Missing/invalid credentials
- ✅ Non-existent resources
- ✅ Invalid data formats
- ✅ Business logic violations
- ✅ MongoDB errors
- ✅ MQTT resilience

---

## 🎯 Success Criteria

```
Total tests    : 28
✅ Réussis     : 28
❌ Échoués     : 0
📊 Taux succès : 100.0%

🎉 TOUS LES TESTS PASSÉS !
```

---

## 🐛 If Tests Fail

1. **Check MongoDB is running**
   ```bash
   netstat -ano | findstr :27017
   ```

2. **Check dependencies installed**
   ```bash
   npm install
   ```

3. **Check .env file exists**
   ```bash
   ls backend/.env
   ```

4. **Review error message**
   - Tests show clear error descriptions
   - Check which service/test failed
   - Review corresponding service code

---

## 📊 Test Coverage

| Layer | Coverage |
|-------|----------|
| Service Layer | ✅ 100% |
| Alert Engine | ✅ 100% |
| MQTT Resilience | ✅ Verified |
| HTTP Endpoints | 📋 Ready |

---

## 🔧 Fixed Issues

- ✅ Schema field name consistency (`acknowledgedBy`)
- ✅ All populate calls working
- ✅ 100% test pass rate achieved

---

## 📚 Documentation

- `FINAL_TEST_REPORT.md` - Complete test report
- `backend/tests/README.md` - Developer guide
- `backend/tests/ERROR_HANDLING_REPORT.md` - Detailed analysis
- `backend/tests/ERROR_FLOW_DIAGRAM.md` - Visual diagrams

---

## 🎓 Quick Examples

### Test Output
```
============================================================
TEST SUITE 1: ReadingService Error Handling
============================================================
✅ ingestReading() rejette capteur inexistant
✅ ingestReading() rejette polluant inexistant
✅ getReadingById() rejette ID inexistant
✅ reEvaluateReading() rejette ID inexistant
```

### Alert Engine
```
Value: 850 ppm
Limit: 800 ppm
Result: ✅ High alert created correctly
```

### MQTT Resilience
```
Invalid JSON → ✅ Logged, continued processing
Missing sensor → ✅ Logged warning, skipped
Processing error → ✅ Logged error, continued
```

---

## ⚡ One-Line Verification

```bash
cd backend && npm run test:services && echo "✅ All error handling tests passed!"
```

---

**Status:** ✅ Production Ready  
**Last Updated:** April 7, 2026
