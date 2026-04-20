# 🚀 BACKEND RBAC LAYER - COMPLETE IMPLEMENTATION

**Date:** April 16, 2026  
**Status:** ✅ **IMPLEMENTATION COMPLETE**  
**Next Step:** Testing endpoints

---

## 📊 Summary of Completed Work

### 1️⃣ Repository Layer (Data Access) ✅
- ✅ **UserRepository** - User CRUD with filters
- ✅ **SiteRepository** - Site CRUD with industry/supervisor filters
- ✅ **ZoneRepository** - Zone CRUD with site/operator filters
- ✅ **SiteConfigRepository** - Configuration parameters (airflow, weights, targets)
- ✅ **ThresholdConfigRepository** - Regulatory limits (Décret 2010-2516)

### 2️⃣ Service Layer (Business Logic) ✅
- ✅ **UserManagementService** - User creation, role changes, assignments
- ✅ **SiteManagementService** - Site creation, supervision assignment
- ✅ **ZoneManagementService** - Zone creation, operator assignment
- ✅ **SiteConfigManagementService** - Q_air, weights, targets management
- ✅ **ThresholdConfigManagementService** - Regulatory limits management

### 3️⃣ Controller Layer (HTTP Handlers) ✅
- ✅ **userManagementController** - 8 endpoints
- ✅ **siteManagementController** - 7 endpoints
- ✅ **zoneManagementController** - 8 endpoints
- ✅ **siteConfigManagementController** - 8 endpoints
- ✅ **thresholdConfigManagementController** - 8 endpoints

### 4️⃣ Routes Layer (URL Mapping) ✅
- ✅ **userManagementRoutes** - /api/users
- ✅ **siteManagementRoutes** - /api/sites
- ✅ **zoneManagementRoutes** - /api/zones
- ✅ **siteConfigManagementRoutes** - /api/site-config
- ✅ **thresholdConfigManagementRoutes** - /api/thresholds

### 5️⃣ Integration ✅
- ✅ Routes registered in server.js
- ✅ RBAC middleware (`checkRole`) integrated
- ✅ JWT authentication (`verifyToken`) integrated

---

## 🔐 API ENDPOINTS WITH RBAC

### USER MANAGEMENT `/api/users`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | SUPER_ADMIN | Create new user |
| GET | `/` | Auth (filtered) | List users (SUPER_ADMIN→all, HEAD_SUP→industry, SITE_SUP→site) |
| GET | `/:id` | Auth (filtered) | Get user by ID |
| PUT | `/:id` | SUPER_ADMIN | Update user details |
| DELETE | `/:id` | SUPER_ADMIN | Delete user (⚠️ not last SUPER_ADMIN) |
| POST | `/:id/sites` | SUPER_ADMIN | Assign sites to HEAD_SUPERVISOR |
| POST | `/:id/zones` | SUPER_ADMIN, SITE_SUP | Assign zones to OPERATOR |
| PUT | `/:id/role` | SUPER_ADMIN | Change user role |
| GET | `/role/:role` | SUPER_ADMIN | List users by role |

**Example: Create User (SUPER_ADMIN)**
```bash
POST /api/users
{
  "username": "alice",
  "email": "alice@company.com",
  "password": "secure123",
  "role": "HEAD_SUPERVISOR",
  "industryId": "industry_id_123"
}
```

---

### SITE MANAGEMENT `/api/sites`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | SUPER_ADMIN, HEAD_SUP | Create site |
| GET | `/` | Auth (filtered) | List sites (SUPER_ADMIN→all, HEAD_SUP→industry, SITE_SUP→mine) |
| GET | `/:id` | Auth (filtered) | Get site by ID |
| PUT | `/:id` | SUPER_ADMIN, HEAD_SUP | Update site (nom, contact, localisation) |
| DELETE | `/:id` | SUPER_ADMIN | Delete site (⚠️ no zones) |
| PUT | `/:id/supervisor` | SUPER_ADMIN | Assign HEAD_SUPERVISOR |
| GET | `/industrie/:industrieId` | Auth | List sites of industry |
| GET | `/:id/zones-count` | Auth | Count zones in site |

**Example: Create Site (HEAD_SUPERVISOR)**
```bash
POST /api/sites
{
  "nom": "Site Sfax",
  "industrieId": "industry_id_123",
  "supervisorId": "user_id_alice",
  "localisation": {
    "type": "Point",
    "coordinates": [10.7602, 35.8256]
  },
  "contact": {
    "telephone": "+216-25-123456",
    "email": "sfax@company.com",
    "responsable": "Ahmed Ben Ali"
  }
}
```

---

### ZONE MANAGEMENT `/api/zones`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | SUPER_ADMIN, HEAD_SUP, SITE_SUP | Create zone |
| GET | `/` | Auth (filtered) | List zones (SUPER_ADMIN→all, HEAD_SUP→industry, SITE_SUP→site, OPERATOR→assigned) |
| GET | `/:id` | Auth (filtered) | Get zone by ID |
| PUT | `/:id` | SUPER_ADMIN, HEAD_SUP, SITE_SUP | Update zone |
| DELETE | `/:id` | SUPER_ADMIN | Delete zone (⚠️ no sensors) |
| POST | `/:id/operators` | SUPER_ADMIN, HEAD_SUP, SITE_SUP | Assign OPERATOR |
| DELETE | `/:id/operators/:operatorId` | SUPER_ADMIN, HEAD_SUP, SITE_SUP | Remove OPERATOR |
| GET | `/site/:siteId` | Auth | List zones of site |
| GET | `/:id/sensors-count` | Auth | Count sensors in zone |

**Example: Create Zone (SITE_SUPERVISOR)**
```bash
POST /api/zones
{
  "code": "Z001",
  "nom": "Zone Émissions NOx",
  "siteId": "site_id_sfax",
  "industrieId": "industry_id_123",
  "description": "Monitoring des émissions d'oxyde d'azote",
  "localisation": {
    "type": "Point",
    "coordinates": [10.7602, 35.8256]
  }
}
```

---

### SITE CONFIG MANAGEMENT `/api/site-config`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Auth (all) | Get active config (read-only) |
| GET | `/targets` | Auth (all) | Get KPI targets (TD, IPE, RCO2) |
| GET | `/weights` | Auth (all) | Get pollutant weights (for IPE) |
| GET | `/airflow` | Auth (all) | Get air flow rate (Q_air) |
| PUT | `/:id/airflow` | SUPER_ADMIN | Update Q_air (0.1-100 Nm³/s) |
| PUT | `/:id/weights` | SUPER_ADMIN | Update pollutant weights (sum=1.0) |
| PUT | `/:id/targets` | SUPER_ADMIN | Update KPI targets |
| PUT | `/:id` | SUPER_ADMIN | Update complete config |

**Example: Update Q_air (SUPER_ADMIN)**
```bash
PUT /api/site-config/config_id_123/airflow
{
  "airflow": 2.5
}
```

**Example: Update Pollutant Weights (SUPER_ADMIN)**
```bash
PUT /api/site-config/config_id_123/weights
{
  "weights": {
    "NOx": 0.30,
    "SO2": 0.25,
    "PM25": 0.25,
    "COV": 0.15,
    "CO2": 0.05
  }
}
```

---

### THRESHOLD CONFIG MANAGEMENT `/api/thresholds`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Auth (all) | Get active threshold config (read-only) |
| GET | `/all` | SUPER_ADMIN | Get all threshold configs (history) |
| GET | `/pollutant/:name` | Auth (all) | Get limits for specific pollutant |
| GET | `/report` | Auth (all) | Get compliance report |
| PUT | `/:id/pollutant/:name` | SUPER_ADMIN | Update pollutant limits (auto-recalc warning/critical) |
| PUT | `/:id/offsets` | SUPER_ADMIN | Update warning/critical offset % |
| PUT | `/:id/all-pollutants` | SUPER_ADMIN | Mass update all pollutants |
| POST | `/:id/clone` | SUPER_ADMIN | Clone config for backup |
| PUT | `/:id/reset` | SUPER_ADMIN | Reset to Décret 2010-2516 defaults |

**Example: Update NOx Limits (SUPER_ADMIN)**
```bash
PUT /api/thresholds/threshold_id_123/pollutant/NOx
{
  "min": 120,
  "max": 500,
  "unit": "mg/Nm³",
  "reference": "Décret 2010-2516"
}
```
*Note: Warning (360) and Critical (600) auto-calculate: 20% offset*

**Example: Reset to Defaults (SUPER_ADMIN)**
```bash
PUT /api/thresholds/threshold_id_123/reset
```

---

## 🏗️ ARCHITECTURE DIAGRAM

```
                 HTTP Request
                     ↓
            ┌────────────────┐
            │  Express Route │ (verifyToken + checkRole middleware)
            └────────┬───────┘
                     ↓
            ┌────────────────────┐
            │    Controller      │ (HTTP handling, validation)
            │ userManagement...  │
            └────────┬───────────┘
                     ↓
            ┌────────────────────┐
            │     Service        │ (Business logic, RBAC checks)
            │ UserManagement...  │
            └────────┬───────────┘
                     ↓
            ┌────────────────────┐
            │    Repository      │ (Database queries)
            │ UserRepository...  │
            └────────┬───────────┘
                     ↓
            ┌────────────────────┐
            │   MongoDB Model    │
            │ User, Site, Zone   │
            └────────────────────┘
```

---

## 🔒 RBAC HIERARCHY

```
Level 5: SUPER_ADMIN
├── Create/manage all users, industries, sites, zones
├── Adjust configuration (Q_air, weights, targets)
├── Modify regulatory limits (thresholds)
└── Full system access

Level 4: HEAD_SUPERVISOR
├── Manage sites within assigned industry
├── Assign SITE_SUPERVISOR to sites
├── Create/edit zones in industry
└── View industry data & KPIs

Level 3: SITE_SUPERVISOR
├── Manage zones within assigned site
├── Assign OPERATOR to zones
└── View site data & alerts

Level 2: AUDITOR
├── View all data (read-only)
└── Generate reports

Level 1: OPERATOR
├── View assigned zones only
└── View live data & history
```

---

## 📂 FILE STRUCTURE

```
backend/
├── repositories/
│   ├── UserRepository.js ✅
│   ├── SiteRepository.js ✅
│   ├── ZoneRepository.js ✅
│   ├── SiteConfigRepository.js ✅ (enhanced)
│   └── ThresholdConfigRepository.js ✅
├── services/
│   ├── UserManagementService.js ✅
│   ├── SiteManagementService.js ✅
│   ├── ZoneManagementService.js ✅
│   ├── SiteConfigManagementService.js ✅
│   └── ThresholdConfigManagementService.js ✅
├── controllers/
│   ├── userManagementController.js ✅
│   ├── siteManagementController.js ✅
│   ├── zoneManagementController.js ✅
│   ├── siteConfigManagementController.js ✅
│   └── thresholdConfigManagementController.js ✅
├── routes/
│   ├── userManagementRoutes.js ✅
│   ├── siteManagementRoutes.js ✅
│   ├── zoneManagementRoutes.js ✅
│   ├── siteConfigManagementRoutes.js ✅
│   └── thresholdConfigManagementRoutes.js ✅
├── models/
│   ├── User.js (updated) ✅
│   ├── Site.js (new) ✅
│   ├── Zone.js (new) ✅
│   ├── SiteConfig.js ✅
│   └── ThresholdConfig.js ✅
├── server.js (updated) ✅
└── ...
```

---

## 🧪 TESTING RECOMMENDATIONS

### 1. Test SUPER_ADMIN Access
```bash
# Create user
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","email":"bob@c.com","password":"pass123","role":"HEAD_SUPERVISOR"}'
```

### 2. Test HEAD_SUPERVISOR Access (Filtered)
```bash
# List sites (should see only industry sites)
curl -X GET http://localhost:5000/api/sites \
  -H "Authorization: Bearer head_supervisor_token"
```

### 3. Test SITE_SUPERVISOR Access (Filtered)
```bash
# List zones (should see only site zones)
curl -X GET http://localhost:5000/api/zones \
  -H "Authorization: Bearer site_supervisor_token"
```

### 4. Test OPERATOR Access (Assigned Only)
```bash
# List zones (should see only assigned zones)
curl -X GET http://localhost:5000/api/zones \
  -H "Authorization: Bearer operator_token"
```

### 5. Test Authorization Denied
```bash
# Try to create user as HEAD_SUPERVISOR (should fail)
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer head_supervisor_token" \
  -H "Content-Type: application/json" \
  -d '{"username":"eve","email":"eve@c.com","password":"pass123","role":"OPERATOR"}'
# Expected: 403 Forbidden
```

---

## ⚙️ MIDDLEWARE STACK

### Per Route Example
```javascript
router.post(
  "/",                                    // Route
  verifyToken,                           // 1. Check JWT
  checkRole("SUPER_ADMIN"),              // 2. Check role
  userManagementController.createUser    // 3. Execute
);
```

### Available Middleware
- ✅ `verifyToken` - Validates JWT, attaches user object
- ✅ `checkRole(roles...)` - Checks user.role against allowed roles
- ✅ `errorHandler` - Global error handling
- ✅ `rate limiting` - Request throttling

---

## 📝 IMPLEMENTATION DETAILS

### Key Features

1. **Hierarchical RBAC**
   - 5 role levels with clear permission boundaries
   - Data filtering at service layer (security-first approach)
   - Middleware for HTTP-level checks

2. **Resource Hierarchies**
   - Industrie → Site → Zone → SensorNode
   - Each level inherits permissions from parent
   - Prevents unauthorized cross-organization access

3. **Configuration Management**
   - Q_air (airflow) for EMJ calculation
   - Pollutant weights for IPE score
   - KPI targets for compliance dashboard
   - Regulatory limits with auto-calculation

4. **Validation & Error Handling**
   - Input validation at controller level
   - Business logic validation at service level
   - Consistent error response format
   - Authorization failures return 403

5. **Database Layer Optimization**
   - Relationships use MongoDB ObjectId refs
   - Population for nested data
   - Efficient filtering with queries
   - Indexes on frequently queried fields

---

## 🚀 NEXT STEPS

1. **Start Backend Server**
   ```bash
   cd backend
   npm start
   ```

2. **Test Endpoints** (see Testing Recommendations above)

3. **Build Frontend UI**
   - User management panel (SUPER_ADMIN)
   - Site management (HEAD_SUPERVISOR)
   - Zone management (SITE_SUPERVISOR)
   - Configuration forms

4. **Integration Testing**
   - End-to-end flows
   - Permission boundary tests
   - Data filtering validation

---

## 📞 QUICK REFERENCE

**All endpoints require JWT token in header:**
```
Authorization: Bearer <accessToken>
```

**Status codes:**
- `200` - Success
- `201` - Created
- `400` - Bad request
- `401` - Unauthorized (no token)
- `403` - Forbidden (wrong role)
- `404` - Not found
- `500` - Server error

**Common errors:**
- `"Seul le SUPER_ADMIN peut..."` → Need SUPER_ADMIN role
- `"Accès refusé"` → Insufficient permissions or cross-organization access
- `"non trouvé(e)"` → Resource doesn't exist
- `"déjà utilisé"` → Unique constraint violation

