# Error Flow Diagram

## Complete Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST                            │
│                    POST /api/readings                           │
│                    { sensorId, value, ... }                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  1. verifyToken                                                 │
│     ├─ No token? → 401 "Token manquant"                        │
│     ├─ Invalid format? → 401 "Format token invalide"           │
│     ├─ Expired? → 401 "Token expiré"                           │
│     └─ Valid? → Continue                                        │
│                                                                 │
│  2. validateReading                                             │
│     ├─ Missing sensorId? → 400 "sensorId requis"              │
│     ├─ Invalid ObjectId? → 400 "ID invalide"                   │
│     ├─ Negative value? → 400 "Valeur invalide"                │
│     └─ Valid? → Continue                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONTROLLER LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  readingController.createReading()                              │
│     ├─ Extract req.body                                         │
│     ├─ Call ReadingService.ingestReading()                     │
│     └─ Return response                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  ReadingService.ingestReading()                                 │
│                                                                 │
│  1. Validate Sensor                                             │
│     ├─ sensor = sensorRepository.findById()                    │
│     ├─ Not found? → throw "Capteur non trouvé"                │
│     ├─ Inactive? → throw "Le capteur est inactif"             │
│     └─ Valid? → Continue                                        │
│                                                                 │
│  2. Validate Pollutant                                          │
│     ├─ polluant = polluantRepository.findById()               │
│     ├─ Not found? → throw "Polluant non trouvé"               │
│     └─ Valid? → Continue                                        │
│                                                                 │
│  3. Validate Reading Value                                      │
│     ├─ value < 0 or > 1000? → isValid = false                 │
│     └─ Valid? → isValid = true                                  │
│                                                                 │
│  4. Create Reading                                              │
│     └─ reading = readingRepository.create()                    │
│                                                                 │
│  5. Check Alert Thresholds                                      │
│     ├─ value < warningThreshold? → No alert                    │
│     ├─ value > warningThreshold? → Warning alert               │
│     ├─ value > regulatoryLimit? → High alert                   │
│     ├─ value > limit * 1.5? → Critical alert                   │
│     └─ alert = alertRepository.create()                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   REPOSITORY LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  readingRepository.create()                                     │
│     ├─ Validate with Mongoose schema                           │
│     ├─ Schema error? → throw ValidationError                   │
│     ├─ Duplicate? → throw DuplicateKeyError                    │
│     └─ Success? → Return document                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       MongoDB                                   │
├─────────────────────────────────────────────────────────────────┤
│  Insert document                                                │
│     ├─ Connection error? → throw ConnectionError               │
│     ├─ Validation error? → throw ValidationError               │
│     └─ Success? → Return inserted document                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ERROR HANDLER                                 │
├─────────────────────────────────────────────────────────────────┤
│  errorHandler(err, req, res, next)                              │
│                                                                 │
│  1. Check MongoDB Errors                                        │
│     ├─ err.code === 11000? → 400 "already exists"             │
│     ├─ err.name === "ValidationError"? → 400 + messages       │
│     └─ err.name === "CastError"? → 400 "invalid_id"           │
│                                                                 │
│  2. Check Custom Errors                                         │
│     └─ err.statusCode? → Return with statusCode                │
│                                                                 │
│  3. Unknown Error                                               │
│     └─ 500 "Internal server error"                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HTTP RESPONSE                                │
│                                                                 │
│  Success (200):                                                 │
│  {                                                              │
│    "success": true,                                             │
│    "data": { reading, alert }                                  │
│  }                                                              │
│                                                                 │
│  Error (400/401/404/500):                                       │
│  {                                                              │
│    "success": false,                                            │
│    "message": "Description en français"                        │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

## MQTT Error Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      MQTT MESSAGE                               │
│         Topic: emissions/Zone-A/CO2                             │
│         Payload: { sensorType, value, ... }                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MQTT SERVICE                                 │
├─────────────────────────────────────────────────────────────────┤
│  mqttService.processMessage()                                   │
│                                                                 │
│  1. Parse JSON                                                  │
│     ├─ Invalid JSON? → Log error, CONTINUE                     │
│     └─ Valid? → Continue                                        │
│                                                                 │
│  2. Find Sensor                                                 │
│     ├─ sensor = Sensor.findOne({ type, model })               │
│     ├─ Not found? → Log warning, SKIP                          │
│     └─ Found? → Continue                                        │
│                                                                 │
│  3. Find Pollutant                                              │
│     ├─ polluant = Polluant.findOne({ name })                  │
│     ├─ Not found? → Log warning, SKIP                          │
│     └─ Found? → Continue                                        │
│                                                                 │
│  4. Call ReadingService                                         │
│     ├─ await ReadingService.ingestReading()                    │
│     ├─ Error? → Log error, CONTINUE                            │
│     └─ Success? → Log success                                   │
│                                                                 │
│  ✅ RESILIENCE: Errors don't crash the service                 │
│  ✅ CONTINUES: Processing next message                          │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication Error Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOGIN REQUEST                                │
│         POST /api/auth/login                                    │
│         { email, password }                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AUTH SERVICE                                  │
├─────────────────────────────────────────────────────────────────┤
│  AuthService.login(email, password)                             │
│                                                                 │
│  1. Validate Input                                              │
│     ├─ !email or !password?                                    │
│     └─ → throw "Email et mot de passe requis"                 │
│                                                                 │
│  2. Find User                                                   │
│     ├─ user = userRepository.findByEmail(email)                │
│     ├─ Not found?                                              │
│     └─ → throw "Email ou mot de passe incorrect"              │
│                                                                 │
│  3. Verify Password                                             │
│     ├─ isValid = user.comparePassword(password)                │
│     ├─ !isValid?                                               │
│     └─ → throw "Email ou mot de passe incorrect"              │
│                                                                 │
│  4. Generate Tokens                                             │
│     ├─ accessToken = generateAccessToken()                     │
│     ├─ refreshToken = generateRefreshToken()                   │
│     └─ Save refresh token to DB                                │
│                                                                 │
│  5. Return Success                                              │
│     └─ { user, accessToken, refreshToken }                     │
└─────────────────────────────────────────────────────────────────┘
```

## Alert Engine Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   READING CREATED                               │
│         value = 850 ppm                                         │
│         regulatoryLimit = 800 ppm                               │
│         warningThreshold = 640 ppm                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              ALERT ENGINE (ReadingService)                      │
├─────────────────────────────────────────────────────────────────┤
│  checkAndCreateAlert(reading, polluant)                         │
│                                                                 │
│  1. Check Thresholds Exist                                      │
│     ├─ No regulatoryLimit? → Return null (no alert)           │
│     ├─ No warningThreshold? → Return null (no alert)          │
│     └─ Both exist? → Continue                                   │
│                                                                 │
│  2. Determine Severity                                          │
│     ├─ value > limit * 1.5? → severity = "Critical"           │
│     ├─ value > limit? → severity = "High"                      │
│     ├─ value > warning? → severity = "Warning"                 │
│     └─ value < warning? → Return null (no alert)               │
│                                                                 │
│  3. Calculate Exceedance                                        │
│     └─ percentage = ((value - limit) / limit) * 100            │
│                                                                 │
│  4. Create Alert                                                │
│     ├─ alert = alertRepository.create({                        │
│     │    severity,                                             │
│     │    value,                                                │
│     │    threshold: regulatoryLimit,                           │
│     │    message: "CO2 dépasse... +6.25%"                     │
│     │  })                                                      │
│     └─ Log: "Alerte High créée — CO2: 850 ppm"                │
│                                                                 │
│  5. Return Alert                                                │
│     └─ { id, severity, type, message }                         │
└─────────────────────────────────────────────────────────────────┘

Example Calculations:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Value    | Threshold | Severity  | Calculation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
500 ppm  | 640 ppm   | None      | 500 < 640 (warning)
650 ppm  | 640 ppm   | Warning   | 650 > 640 but < 800
850 ppm  | 800 ppm   | High      | 850 > 800 but < 1200
1300 ppm | 800 ppm   | Critical  | 1300 > 800 * 1.5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Error Propagation Example

### Scenario: Invalid Sensor ID

```
1. HTTP Request
   POST /api/readings
   { sensorId: "invalid_id", value: 100 }
   
2. Middleware: validateReading
   ✅ PASS: sensorId exists
   ❌ FAIL: !isValidObjectId("invalid_id")
   → Return 400 { success: false, message: "L'ID du capteur est invalide" }
   
3. Controller: NOT REACHED
4. Service: NOT REACHED
5. Repository: NOT REACHED
6. MongoDB: NOT REACHED

Result: Error caught at middleware layer (earliest possible)
```

### Scenario: Non-existent Sensor

```
1. HTTP Request
   POST /api/readings
   { sensorId: "507f1f77bcf86cd799439011", value: 100 }
   
2. Middleware: validateReading
   ✅ PASS: Valid ObjectId format
   
3. Controller: readingController.createReading
   ✅ PASS: Calls ReadingService
   
4. Service: ReadingService.ingestReading
   ├─ sensor = sensorRepository.findById()
   ├─ sensor === null
   └─ throw new Error("Capteur non trouvé")
   
5. Error Handler: errorHandler
   ├─ err.statusCode not set
   ├─ Not a MongoDB error
   └─ Return 500 (should be 400, but service doesn't set statusCode)
   
Result: Error caught at service layer
```

### Scenario: Inactive Sensor

```
1. HTTP Request
   POST /api/readings
   { sensorId: "507f...", value: 100 }
   
2. Middleware: validateReading
   ✅ PASS: Valid ObjectId
   
3. Controller: readingController.createReading
   ✅ PASS: Calls ReadingService
   
4. Service: ReadingService.ingestReading
   ├─ sensor = sensorRepository.findById()
   ├─ sensor.isActive === false
   └─ throw new Error("Le capteur est inactif")
   
5. Error Handler: errorHandler
   └─ Return 500 (business logic error)
   
Result: Error caught at service layer (business rule)
```

## Error Response Examples

### 400 Bad Request (Validation)
```json
{
  "success": false,
  "message": "L'ID du capteur est requis et invalide"
}
```

### 401 Unauthorized (Authentication)
```json
{
  "success": false,
  "message": "Token expiré — Veuillez vous reconnecter",
  "expired": true
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Capteur non trouvé"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Erreur interne du serveur",
  "error": "Detailed error message (dev only)"
}
```

## Summary

### Error Handling Layers

1. **Middleware** (First line of defense)
   - Input validation
   - Authentication
   - Format checking

2. **Service** (Business logic)
   - Resource existence
   - Business rules
   - State validation

3. **Repository** (Data layer)
   - Schema validation
   - Uniqueness constraints
   - Database errors

4. **Error Handler** (Last resort)
   - Catches all errors
   - Formats responses
   - Logs for debugging

### Key Principles

✅ **Fail Fast**: Validate early, fail early  
✅ **Clear Messages**: Descriptive French error messages  
✅ **Proper Codes**: Correct HTTP status codes  
✅ **Resilience**: MQTT continues despite errors  
✅ **Security**: Don't leak sensitive information  
✅ **Logging**: Log errors for debugging  
