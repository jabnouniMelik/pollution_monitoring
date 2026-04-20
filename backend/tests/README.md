# Backend Tests

## Overview

This directory contains comprehensive tests for the pollution monitoring system's backend.

## Test Files

### 1. `test.js` - Integration Tests
Basic integration tests that verify:
- MongoDB connection
- Model creation (Industrie, SensorNode, Polluant, Sensor)
- Reading creation
- Report generation

**Run:** `npm test` or `npm run test:integration`

### 2. `serviceErrors.test.js` - Service Layer Error Handling
Unit tests for service layer error handling:
- ReadingService validation and errors
- AlertService validation and errors
- AuthService validation and errors
- SensorService validation and errors
- Alert engine logic verification

**Run:** `npm run test:services`

**Requirements:** MongoDB running (no backend server needed)

### 3. `errorHandling.test.js` - HTTP Error Handling
End-to-end tests for HTTP error handling:
- Authentication errors (401)
- Authorization errors (403)
- Validation errors (400)
- Not found errors (404)
- Business logic errors (400/409)
- MongoDB errors (400/500)

**Run:** `npm run test:errors`

**Requirements:** Backend server must be running

## Quick Start

### Run All Tests

```bash
# 1. Integration tests (MongoDB only)
npm test

# 2. Service layer tests (MongoDB only)
npm run test:services

# 3. HTTP error tests (requires backend server)
# Terminal 1:
node server.js

# Terminal 2:
npm run test:errors
```

### Test Results

All tests output colored results:
- ✅ Green: Test passed
- ❌ Red: Test failed
- ⚠️  Yellow: Test skipped (missing test data)
- ℹ️  Cyan: Information

## Test Coverage

### Error Handling Coverage

| Layer | Tests | Coverage |
|-------|-------|----------|
| Service Layer | 28 | 96.4% |
| HTTP Layer | 40+ | Ready |
| MQTT Layer | 4 | Documented |

### Scenarios Tested

#### Authentication & Authorization
- Missing credentials
- Invalid credentials
- Missing/invalid/expired tokens
- Invalid roles
- Duplicate users

#### Validation
- Missing required fields
- Invalid data types
- Invalid ObjectId formats
- Negative values
- Empty strings

#### Business Logic
- Inactive sensors
- Non-existent resources
- Already acknowledged alerts
- Invalid severity levels
- Duplicate resources

#### Database
- MongoDB connection errors
- Duplicate key errors
- Validation errors
- Cast errors (invalid ObjectId)

#### MQTT
- Invalid JSON messages
- Non-existent sensors/pollutants
- Processing errors
- Resilience testing

## Writing New Tests

### Service Layer Test Template

```javascript
async function testMyService() {
  log.section("TEST SUITE: MyService");

  // Test error case
  await expectError(
    () => MyService.someMethod("invalid_id"),
    "Expected error message",
    "Test description"
  );

  // Test success case
  try {
    const result = await MyService.someMethod(validId);
    assert(result !== null, "Should return result");
  } catch (error) {
    log.error(`Test failed: ${error.message}`);
  }
}
```

### HTTP Test Template

```javascript
async function testMyEndpoint() {
  log.section("TEST SUITE: My Endpoint");

  const headers = { Authorization: `Bearer ${validToken}` };

  // Test error case
  await expectError(
    () => axios.post(`${BASE_URL}/my-endpoint`, {
      // invalid data
    }, { headers }),
    400,
    "Should reject invalid data"
  );

  // Test success case
  try {
    const response = await axios.post(`${BASE_URL}/my-endpoint`, {
      // valid data
    }, { headers });
    assert(response.status === 200, "Should return 200");
  } catch (error) {
    log.error(`Test failed: ${error.message}`);
  }
}
```

## Debugging Tests

### Enable Verbose Logging

```javascript
// In test file
console.log("Debug info:", variable);
console.error("Error details:", error);
```

### Check MongoDB State

```javascript
// In test file
const Model = require("../models/MyModel");
const count = await Model.countDocuments();
console.log(`Total documents: ${count}`);
```

### Inspect HTTP Responses

```javascript
// In test file
try {
  await axios.post(url, data);
} catch (error) {
  console.log("Status:", error.response?.status);
  console.log("Data:", error.response?.data);
  console.log("Headers:", error.response?.headers);
}
```

## Common Issues

### Issue: "MongoDB connection failed"

**Solution:** Ensure MongoDB is running
```bash
# Check if MongoDB is running
netstat -ano | findstr :27017

# If not running, start MongoDB service
```

### Issue: "Cannot find module"

**Solution:** Install dependencies
```bash
npm install
```

### Issue: "Port 5000 already in use"

**Solution:** Kill existing process
```bash
# Find process
netstat -ano | findstr :5000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

### Issue: "Token expired"

**Solution:** Tests generate fresh tokens automatically. If issue persists, check JWT configuration in `.env`

### Issue: "Test skipped - no test data"

**Solution:** Run initialization scripts
```bash
npm run init:simulator
```

## Test Reports

After running tests, check:
- `ERROR_HANDLING_REPORT.md` - Detailed error handling analysis
- Console output - Real-time test results
- Exit code - 0 = success, 1 = failures

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend
          npm install
      
      - name: Run integration tests
        run: |
          cd backend
          npm test
      
      - name: Run service layer tests
        run: |
          cd backend
          npm run test:services
      
      - name: Start backend server
        run: |
          cd backend
          node server.js &
          sleep 5
      
      - name: Run HTTP error tests
        run: |
          cd backend
          npm run test:errors
```

## Best Practices

1. **Always test error cases first** - Ensure proper error handling before testing success cases
2. **Use descriptive test names** - Make it clear what's being tested
3. **Clean up test data** - Don't leave test data in production databases
4. **Mock external services** - Don't rely on external APIs in tests
5. **Test edge cases** - Empty strings, null values, extreme numbers
6. **Keep tests independent** - Each test should work in isolation
7. **Use consistent assertions** - Follow the same pattern across all tests

## Resources

- [Mongoose Testing Guide](https://mongoosejs.com/docs/jest.html)
- [Axios Testing](https://axios-http.com/docs/handling_errors)
- [JWT Testing](https://jwt.io/)
- [MQTT Testing](https://github.com/mqttjs/MQTT.js#readme)

## Support

For issues or questions:
1. Check this README
2. Review `ERROR_HANDLING_REPORT.md`
3. Check console output for detailed error messages
4. Review service layer code for business logic
5. Check middleware for validation rules
