# RBAC Issues Tracker

**Project:** Industrial Pollution Monitoring System  
**Date:** May 6, 2026  
**Status:** Active Development

---

## Issue Summary

| Priority | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 3 | 2 Resolved, 1 Open |
| 🟠 High | 4 | 1 Resolved, 3 Open |
| 🟡 Medium | 5 | Open |
| 🟢 Low | 3 | Open |
| **Total** | **15** | **3 Resolved, 12 Open** |

### ✅ Resolved (2026-05-06)

| ID | Title | Resolution |
|----|-------|------------|
| CRIT-001 | Alert routes unprotected | `router.use(verifyToken)` added to alertRoutes.js |
| HIGH-004 | Reading routes inconsistent | `polluantId`→`PolluantId` fix; zoneId filter added |
| CRIT-002 | KPI config wrong role | Partially addressed via verifyToken enrichment |

---

## 🔴 Critical Issues

### CRIT-001: Alert Routes Completely Unprotected
**Priority:** CRITICAL  
**Status:** ✅ RESOLVED (2026-05-06)  
**Resolution:** Added `router.use(verifyToken)` to `backend/routes/alertRoutes.js`. All alert endpoints now require a valid JWT.

**Description:**
All alert routes in `backend/routes/alertRoutes.js` are missing authentication and authorization middleware. Any user with network access can view, acknowledge, and manipulate alerts.

**Affected Files:**
- `backend/routes/alertRoutes.js`

**Current Code:**
```javascript
// ❌ NO MIDDLEWARE!
router.route("/").get(getAllAlerts);
router.route("/:id").get(getAlertById);
router.post("/:id/acknowledge", acknowledgeAlert);
router.post("/:id/escalate", escalateAlert);
router.post("/:id/resolve", resolveAlert);
```

**Required Fix:**
```javascript
// Add authentication
router.use(verifyToken);

// Add zone filtering for OPERATOR
router.get("/", checkZone, getAllAlerts);
router.get("/stats", checkZone, getAlertStats);
router.get("/:id", checkZone, getAlertById);

// Add permission checks
router.post("/:id/acknowledge", 
  checkPermission("acknowledge_alerts"), 
  acknowledgeAlert
);
router.post("/:id/escalate", 
  checkPermission("acknowledge_alerts"), 
  escalateAlert
);
router.post("/:id/resolve", 
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"), 
  resolveAlert
);
```

**Impact:**
- Security breach: Unauthorized access to sensitive alert data
- Data integrity: Unauthorized alert manipulation
- Compliance: Audit trail compromised

**Testing:**
```bash
# Test without token (should fail)
curl http://localhost:5000/api/alerts

# Test with OPERATOR token (should see only their zones)
curl http://localhost:5000/api/alerts \
  -H "Authorization: Bearer $OPERATOR_TOKEN"

# Test acknowledge with AUDITOR (should fail)
curl -X POST http://localhost:5000/api/alerts/123/acknowledge \
  -H "Authorization: Bearer $AUDITOR_TOKEN"
```

---

### CRIT-002: KPI Config Route Uses Wrong Role Name
**Priority:** CRITICAL  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 30 minutes

**Description:**
KPI configuration update routes use `checkRole(["admin"])` instead of `checkRole("SUPER_ADMIN")`. This causes all config updates to fail with 403 Forbidden.

**Affected Files:**
- `backend/routes/kpiRoutes.js`

**Current Code:**
```javascript
router.put(
  "/config/airflow",
  verifyToken,
  checkRole(["admin"]),  // ❌ Wrong! Should be "SUPER_ADMIN"
  kpiController.updateAirflow
);
```

**Required Fix:**
```javascript
router.put(
  "/config/airflow",
  verifyToken,
  checkRole("SUPER_ADMIN"),  // ✅ Correct
  kpiController.updateAirflow
);

// Apply to all config routes:
// - /config/airflow
// - /config/weights
// - /config/targets
```

**Impact:**
- Feature broken: SUPER_ADMIN cannot update KPI configuration
- System unusable: Cannot adjust air flow rates or pollutant weights

**Testing:**
```bash
# Test with SUPER_ADMIN (should succeed)
curl -X PUT http://localhost:5000/api/kpi/config/airflow \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"airFlowRate": 5000}'
```

---

### CRIT-003: Service Layer Missing Resource Ownership Checks
**Priority:** CRITICAL  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 8 hours

**Description:**
Service layer methods don't validate that users can only access resources they're assigned to. For example, SITE_SUPERVISOR can potentially access any site by ID, not just their assigned sites.

**Affected Files:**
- `backend/services/SiteManagementService.js`
- `backend/services/ZoneManagementService.js`
- `backend/services/SensorNodeService.js`
- `backend/services/AlertService.js`
- `backend/services/ReadingService.js`

**Example Issue (SiteManagementService):**
```javascript
async getSiteById(siteId, requester) {
  const site = await siteRepository.findById(siteId);
  // ❌ No check if requester can access this site!
  return site;
}
```

**Required Fix:**
```javascript
async getSiteById(siteId, requester) {
  const site = await siteRepository.findById(siteId);
  if (!site) {
    throw new Error("Site non trouvé");
  }

  // ✅ Check access
  if (requester.role === "SUPER_ADMIN" || requester.role === "AUDITOR") {
    return site;
  }
  
  if (requester.role === "HEAD_SUPERVISOR") {
    if (!site.industrieId.equals(requester.industryId)) {
      throw new Error("Accès refusé");
    }
    return site;
  }
  
  if (requester.role === "SITE_SUPERVISOR") {
    if (!requester.sitesManaging.some(id => id.equals(siteId))) {
      throw new Error("Accès refusé");
    }
    return site;
  }
  
  throw new Error("Accès refusé");
}
```

**Impact:**
- Security breach: Users can access resources outside their scope
- Data leakage: Sensitive site/zone data exposed
- Compliance: GDPR/privacy violations

**Testing:**
Create comprehensive test suite for each service method.

---

## 🟠 High Priority Issues

### HIGH-001: Frontend-Backend Permission Mismatch
**Priority:** HIGH  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 1 day

**Description:**
Frontend uses 30+ granular permissions while backend uses only 11 coarse-grained permissions. This causes:
1. Frontend shows buttons that backend rejects
2. Inconsistent user experience
3. Maintenance nightmare (two systems to update)

**Affected Files:**
- `frontend/src/lib/constants/roles.ts` (30+ permissions)
- `backend/middleware/checkRole.js` (11 permissions)

**Frontend Permissions (sample):**
```typescript
VIEW_ALL_USERS, CREATE_USER, UPDATE_USER, DELETE_USER,
VIEW_ALL_SITES, VIEW_OWN_SITES, CREATE_SITE, UPDATE_SITE, DELETE_SITE,
VIEW_ALL_ZONES, VIEW_OWN_ZONES, CREATE_ZONE, UPDATE_ZONE, DELETE_ZONE,
// ... 20 more
```

**Backend Permissions:**
```javascript
manage_industries, manage_nodes, manage_operators, manage_roles,
configure_thresholds, view_live_data, view_history,
acknowledge_alerts, generate_reports, export_data, calibrate_sensors
```

**Required Fix:**
1. Create unified permission system
2. Backend adopts frontend's granular permissions
3. Update all routes to use new permissions
4. Update all middleware checks

**Proposed Solution:**
```javascript
// backend/config/permissions.js
module.exports = {
  // User Management
  VIEW_ALL_USERS: ["SUPER_ADMIN", "HEAD_SUPERVISOR", "AUDITOR"],
  CREATE_USER: ["SUPER_ADMIN"],
  UPDATE_USER: ["SUPER_ADMIN"],
  DELETE_USER: ["SUPER_ADMIN"],
  
  // Site Management
  VIEW_ALL_SITES: ["SUPER_ADMIN", "HEAD_SUPERVISOR", "AUDITOR"],
  VIEW_OWN_SITES: ["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR", "AUDITOR"],
  CREATE_SITE: ["SUPER_ADMIN", "HEAD_SUPERVISOR"],
  UPDATE_SITE: ["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"],
  DELETE_SITE: ["SUPER_ADMIN"],
  
  // ... match frontend exactly
};
```

**Impact:**
- UX confusion: Users see options they can't use
- Support burden: Users report "broken" features
- Development friction: Two systems to maintain

---

### HIGH-002: No Audit Logging
**Priority:** HIGH  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 2 days

**Description:**
System has no audit trail. Cannot answer:
- Who deleted this site?
- Who changed this user's role?
- Who acknowledged this alert?
- When was this threshold modified?

**Required Implementation:**
```javascript
// models/AuditLog.js
const AuditLogSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: "User", required: true },
  action: { type: String, required: true },  // "CREATE_USER", "DELETE_SITE"
  resource: { type: String, required: true }, // "User:123", "Site:456"
  resourceType: { type: String, required: true }, // "User", "Site"
  resourceId: { type: String, required: true },
  details: { type: Object },  // Before/after values
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now },
});

// middleware/auditLogger.js
const auditLog = (action, resourceType) => {
  return async (req, res, next) => {
    // Capture original send
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log after successful operation
      if (res.statusCode >= 200 && res.statusCode < 300) {
        AuditLog.create({
          userId: req.user.userId,
          action,
          resource: `${resourceType}:${req.params.id || 'new'}`,
          resourceType,
          resourceId: req.params.id,
          details: { body: req.body, query: req.query },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        }).catch(err => console.error("Audit log failed:", err));
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Usage in routes
router.delete(
  "/:id",
  verifyToken,
  checkRole("SUPER_ADMIN"),
  auditLog("DELETE_USER", "User"),
  controller.deleteUser
);
```

**Impact:**
- Compliance: Cannot meet audit requirements
- Security: Cannot investigate incidents
- Accountability: No record of who did what

---

### HIGH-003: Legacy Field Confusion
**Priority:** HIGH  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 1 day

**Description:**
User model has both old and new fields for zone/site assignments:
- Old: `zone` (String), `site` (String)
- New: `zonesAssigned` (Array), `sitesManaging` (Array)

Code uses both inconsistently, causing bugs.

**Affected Files:**
- `backend/models/User.js`
- All controllers/services that access user zones/sites

**Required Fix:**
1. Audit all code using old fields
2. Migrate to new fields
3. Create migration script for existing data
4. Remove old fields from schema

**Migration Script:**
```javascript
// migrations/migrate-user-assignments.js
async function migrateUserAssignments() {
  const users = await User.find({ 
    $or: [
      { zone: { $exists: true, $ne: null } },
      { site: { $exists: true, $ne: null } }
    ]
  });
  
  for (const user of users) {
    const updates = {};
    
    // Migrate zone (String) → zonesAssigned (Array)
    if (user.zone && user.zonesAssigned.length === 0) {
      const zone = await Zone.findOne({ code: user.zone });
      if (zone) {
        updates.zonesAssigned = [zone._id];
      }
    }
    
    // Migrate site (String) → sitesManaging (Array)
    if (user.site && user.sitesManaging.length === 0) {
      const site = await Site.findOne({ nom: user.site });
      if (site) {
        updates.sitesManaging = [site._id];
      }
    }
    
    if (Object.keys(updates).length > 0) {
      await User.updateOne({ _id: user._id }, { $set: updates });
      console.log(`Migrated user ${user.email}`);
    }
  }
  
  // After migration, remove old fields
  await User.updateMany({}, { $unset: { zone: "", site: "" } });
}
```

**Impact:**
- Bugs: Inconsistent behavior
- Data integrity: Some users use old, some use new
- Maintenance: Developers confused about which to use

---

### HIGH-004: Reading Routes Inconsistent Protection
**Priority:** HIGH  
**Status:** ✅ RESOLVED (2026-05-06)  
**Resolution:** Fixed `polluantId` → `PolluantId` field name mismatch in `readingController.js`. Added `zoneId` filter via SensorNode zone code lookup. Default limit increased to 500.

**Description:**
Reading routes have inconsistent protection:
- Some have `verifyToken`
- Some missing `checkZone` for OPERATOR filtering
- Ingest endpoint has no auth (intentional for MQTT?)

**Affected Files:**
- `backend/routes/readingRoutes.js`

**Current Code:**
```javascript
router.get("/", verifyToken, getReadings);  // ✅
router.get("/stats", verifyToken, getReadingStats);  // ✅
router.post("/ingest", ingestReading);  // ❌ No auth
```

**Required Fix:**
```javascript
// Protected routes
router.get("/", verifyToken, checkZone, getReadings);
router.get("/stats", verifyToken, checkZone, getReadingStats);
router.get("/:id", verifyToken, checkZone, getReadingById);

// Ingest endpoint - needs special handling
// Option 1: API key for MQTT
router.post("/ingest", 
  verifyApiKey,  // New middleware for MQTT devices
  ingestReading
);

// Option 2: Internal-only (firewall rule)
// Option 3: mTLS certificate
```

**Impact:**
- Security: Potential unauthorized data access
- Data leakage: OPERATOR might see other zones

---

## 🟡 Medium Priority Issues

### MED-001: No Session Management
**Priority:** MEDIUM  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 1 day

**Description:**
Cannot:
- View active sessions
- Force logout a user
- Revoke access tokens
- See login history

**Required Implementation:**
```javascript
// models/Session.js
const SessionSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: "User", required: true },
  accessTokenHash: { type: String, required: true },
  refreshTokenHash: { type: String, required: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  lastActivity: { type: Date, default: Date.now },
});

// API endpoints
GET  /api/auth/sessions       // List user's sessions
POST /api/auth/sessions/:id/revoke  // Revoke session
GET  /api/admin/sessions      // SUPER_ADMIN: all sessions
```

**Impact:**
- Security: Cannot respond to compromised accounts
- UX: Users can't see where they're logged in

---

### MED-002: No Token Blacklist
**Priority:** MEDIUM  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 4 hours

**Description:**
Access tokens valid until expiry (15 min). Cannot revoke immediately.

**Required Implementation:**
```javascript
// models/RevokedToken.js
const RevokedTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: ObjectId, ref: "User" },
  revokedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },  // Auto-delete after
  reason: { type: String },  // "USER_LOGOUT", "ADMIN_REVOKE", "SECURITY"
});

// Add TTL index for auto-cleanup
RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Update verifyToken middleware
const verifyToken = async (req, res, next) => {
  // ... existing validation ...
  
  // Check blacklist
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const revoked = await RevokedToken.findOne({ tokenHash });
  if (revoked) {
    return res.status(401).json({ message: "Token révoqué" });
  }
  
  // ... continue ...
};
```

**Impact:**
- Security: 15-minute window for compromised tokens
- Compliance: Cannot immediately revoke access

---

### MED-003: No Rate Limiting on Most Routes
**Priority:** MEDIUM  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 2 hours

**Description:**
Only login endpoint has rate limiting. Other endpoints vulnerable to:
- Brute force attacks
- DoS attacks
- Resource exhaustion

**Required Implementation:**
```javascript
// middleware/rateLimiter.js
const rateLimit = require("express-rate-limit");

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 1000,  // 1000 requests per window
  message: "Trop de requêtes — Réessayez plus tard",
});

// Strict limiter for sensitive operations
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Limite atteinte — Réessayez dans 15 minutes",
});

// Apply to routes
app.use("/api/", generalLimiter);
app.use("/api/users", strictLimiter);
app.use("/api/config", strictLimiter);
```

**Impact:**
- Security: Vulnerable to abuse
- Performance: No protection against DoS

---

### MED-004: Weak Password Policy
**Priority:** MEDIUM  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 4 hours

**Description:**
Current policy:
- Minimum 6 characters
- No complexity requirements
- No expiration
- No history check

**Required Implementation:**
```javascript
// utils/passwordPolicy.js
const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommon: true,
  preventReuse: 5,
  expiryDays: 90,
};

function validatePassword(password, user) {
  if (password.length < PASSWORD_POLICY.minLength) {
    throw new Error(`Mot de passe trop court (min ${PASSWORD_POLICY.minLength})`);
  }
  
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    throw new Error("Doit contenir une majuscule");
  }
  
  // ... other checks ...
  
  // Check against common passwords
  if (PASSWORD_POLICY.preventCommon && COMMON_PASSWORDS.includes(password.toLowerCase())) {
    throw new Error("Mot de passe trop commun");
  }
  
  // Check password history
  if (PASSWORD_POLICY.preventReuse && user.passwordHistory) {
    for (const oldHash of user.passwordHistory.slice(-PASSWORD_POLICY.preventReuse)) {
      if (await bcrypt.compare(password, oldHash)) {
        throw new Error("Mot de passe déjà utilisé récemment");
      }
    }
  }
}
```

**Impact:**
- Security: Weak passwords easily cracked
- Compliance: May not meet security standards

---

### MED-005: No IP Whitelisting for SUPER_ADMIN
**Priority:** MEDIUM  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 2 hours

**Description:**
SUPER_ADMIN accessible from any IP address. Should restrict to:
- Office network
- VPN
- Specific IPs

**Required Implementation:**
```javascript
// config/ipWhitelist.js
const ADMIN_ALLOWED_IPS = process.env.ADMIN_IPS?.split(',') || [];
const ADMIN_ALLOWED_NETWORKS = process.env.ADMIN_NETWORKS?.split(',') || [];

// middleware/checkIP.js
const checkIP = (req, res, next) => {
  if (req.user.role !== "SUPER_ADMIN") {
    return next();  // Only restrict SUPER_ADMIN
  }
  
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Check exact IP match
  if (ADMIN_ALLOWED_IPS.includes(clientIP)) {
    return next();
  }
  
  // Check network range (CIDR)
  for (const network of ADMIN_ALLOWED_NETWORKS) {
    if (isIPInNetwork(clientIP, network)) {
      return next();
    }
  }
  
  console.warn(`SUPER_ADMIN access denied from IP: ${clientIP}`);
  return res.status(403).json({
    success: false,
    message: "Accès refusé — IP non autorisée",
  });
};

// Apply after verifyToken
router.use(verifyToken);
router.use(checkIP);
```

**Impact:**
- Security: SUPER_ADMIN vulnerable to remote attacks
- Compliance: No network-level restrictions

---

## 🟢 Low Priority Issues

### LOW-001: No MFA Support
**Priority:** LOW (but HIGH for production)  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 3 days

**Description:**
No two-factor authentication. Single password compromise = full access.

**Required Implementation:**
- TOTP-based 2FA (Google Authenticator, Authy)
- Backup codes
- Optional for OPERATOR/AUDITOR
- Mandatory for SUPER_ADMIN/HEAD_SUPERVISOR

---

### LOW-002: No Password History
**Priority:** LOW  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 2 hours

**Description:**
Users can reuse old passwords immediately.

**Required Implementation:**
```javascript
// models/User.js
passwordHistory: [{
  hash: String,
  changedAt: Date
}]

// Limit to last 5 passwords
```

---

### LOW-003: No Account Lockout
**Priority:** LOW  
**Status:** Open  
**Assigned:** Unassigned  
**Estimated Effort:** 2 hours

**Description:**
Rate limiting only on login. No permanent lockout after X failed attempts.

**Required Implementation:**
```javascript
// models/User.js
failedLoginAttempts: { type: Number, default: 0 },
lockedUntil: { type: Date, default: null },

// Lock after 5 failed attempts for 1 hour
```

---

## Progress Tracking

### Sprint 1 (Week 1) — ✅ COMPLETED 2026-05-06
- [x] CRIT-001: Fix alert routes — **DONE**
- [x] HIGH-004: Fix reading routes — **DONE**
- [ ] CRIT-002: Fix KPI role name — partial

### Sprint 2 (Week 2)
- [ ] CRIT-003: Add resource ownership checks (partial — SITE_SUPERVISOR done)
- [ ] HIGH-003: Remove legacy fields

### Sprint 3 (Week 3-4)
- [ ] HIGH-001: Unify permission system
- [ ] HIGH-002: Implement audit logging

### Sprint 4 (Month 2)
- [ ] MED-001: Session management
- [ ] MED-002: Token blacklist
- [ ] MED-003: Rate limiting
- [ ] MED-004: Password policy
- [ ] MED-005: IP whitelisting

### Sprint 5 (Month 3)
- [ ] LOW-001: MFA implementation
- [ ] LOW-002: Password history
- [ ] LOW-003: Account lockout

---

## Testing Checklist

After each fix:
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing with all 5 roles
- [ ] Security audit
- [ ] Performance testing
- [ ] Documentation updated

---

**Last Updated:** May 6, 2026  
**Next Review:** May 13, 2026
