# RBAC Quick Reference Guide

## Role Capabilities at a Glance

### 🔴 SUPER_ADMIN
```
✅ Everything
├── Create/modify/delete any user
├── Configure legal thresholds
├── Configure KPI parameters
├── Access all companies/sites/zones
└── Full system control
```

### 🟠 HEAD_SUPERVISOR
```
✅ Company-wide management
├── View all company data
├── Manage sites and sensor nodes
├── Assign site supervisors
├── Generate company reports
└── ❌ Cannot configure thresholds
```

### 🟡 SITE_SUPERVISOR
```
✅ Site-level management
├── View assigned sites only
├── Manage operators
├── Acknowledge/resolve alerts
├── Generate site reports
└── ❌ Cannot manage other supervisors
```

### 🟢 AUDITOR
```
✅ Read-only compliance
├── View historical data
├── Generate reports
├── Export data
└── ❌ Cannot modify anything or view real-time
```

### 🔵 OPERATOR
```
✅ Zone monitoring
├── View live data (assigned zones only)
├── Acknowledge alerts
├── Calibrate sensors
├── View AI predictions
└── ❌ Cannot access other zones or generate reports
```

---

## Permission Quick Lookup

### User Management
| Action | SA | HS | SS | AU | OP |
|--------|:--:|:--:|:--:|:--:|:--:|
| View all users | ✅ | ✅ | ❌ | ✅ | ❌ |
| View own operators | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create user | ✅ | ❌ | ✅* | ❌ | ❌ |
| Update user | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete user | ✅ | ❌ | ✅* | ❌ | ❌ |
| Change role | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign sites | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign zones | ✅ | ❌ | ✅* | ❌ | ❌ |

*SITE_SUPERVISOR: operators in their site only

### Site & Zone Management
| Action | SA | HS | SS | AU | OP |
|--------|:--:|:--:|:--:|:--:|:--:|
| View all sites | ✅ | ✅ | ❌ | ✅ | ❌ |
| View own sites | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create site | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update site | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete site | ✅ | ❌ | ❌ | ❌ | ❌ |
| View all zones | ✅ | ✅ | ❌ | ✅ | ❌ |
| View own zones | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create zone | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update zone | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete zone | ✅ | ✅ | ❌ | ❌ | ❌ |

### Configuration
| Action | SA | HS | SS | AU | OP |
|--------|:--:|:--:|:--:|:--:|:--:|
| View config | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update airflow | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update weights | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update targets | ✅ | ❌ | ❌ | ❌ | ❌ |
| View thresholds | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update thresholds | ✅ | ❌ | ❌ | ❌ | ❌ |

### Alerts
| Action | SA | HS | SS | AU | OP |
|--------|:--:|:--:|:--:|:--:|:--:|
| View alerts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Acknowledge | ✅ | ✅ | ✅ | ❌ | ✅ |
| Escalate | ✅ | ✅ | ✅ | ❌ | ❌ |
| Resolve | ✅ | ✅ | ❌ | ❌ | ❌ |

### Reports & KPI
| Action | SA | HS | SS | AU | OP |
|--------|:--:|:--:|:--:|:--:|:--:|
| View KPI | ✅ | ✅ | ✅ | ✅ | ✅ |
| Generate report | ✅ | ✅ | ✅ | ✅ | ❌ |
| Submit ANPE | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export data | ✅ | ✅ | ✅ | ✅ | ❌ |

### AI & Predictions
| Action | SA | HS | SS | AU | OP |
|--------|:--:|:--:|:--:|:--:|:--:|
| View AI | ✅ | ✅ | ✅ | ✅ | ✅ |
| Retrain model | ✅ | ✅ | ❌ | ❌ | ❌ |

**Legend:** SA=SUPER_ADMIN, HS=HEAD_SUPERVISOR, SS=SITE_SUPERVISOR, AU=AUDITOR, OP=OPERATOR

---

## Common RBAC Patterns

### Backend Route Protection

#### Pattern 1: Single Role
```javascript
router.post(
  "/users",
  verifyToken,
  checkRole("SUPER_ADMIN"),
  controller.createUser
);
```

#### Pattern 2: Multiple Roles
```javascript
router.post(
  "/sites",
  verifyToken,
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR"),
  controller.createSite
);
```

#### Pattern 3: Permission-Based
```javascript
router.get(
  "/readings",
  verifyToken,
  checkPermission("view_live_data"),
  controller.getReadings
);
```

#### Pattern 4: Zone-Filtered (OPERATOR)
```javascript
router.get(
  "/sensor-nodes",
  verifyToken,
  checkZone,  // Auto-filters by zone
  controller.getSensorNodes
);
```

### Frontend Route Protection

#### Pattern 1: Permission-Based
```typescript
<ProtectedRoute requires={['VIEW_KPI']}>
  <Overview />
</ProtectedRoute>
```

#### Pattern 2: Role-Based
```typescript
<ProtectedRoute role={Role.SUPER_ADMIN}>
  <Config />
</ProtectedRoute>
```

#### Pattern 3: Component-Level
```typescript
<PermissionGate permission="GENERATE_REPORT">
  <Button>Nouveau rapport</Button>
</PermissionGate>
```

#### Pattern 4: Multiple Permissions (OR)
```typescript
<PermissionGate anyOf={['UPDATE_ZONE', 'DELETE_ZONE']}>
  <ActionButtons />
</PermissionGate>
```

---

## Data Access Scopes

### SUPER_ADMIN
```
Scope: GLOBAL
├── All industries
├── All sites
├── All zones
└── All users
```

### HEAD_SUPERVISOR
```
Scope: INDUSTRY
├── industryId: X
├── All sites where industrieId = X
├── All zones in those sites
└── All users in that industry
```

### SITE_SUPERVISOR
```
Scope: SITES
├── sitesManaging: [A, B, C]
├── Only sites A, B, C
├── All zones in those sites
└── Operators in those sites
```

### OPERATOR
```
Scope: ZONES
├── zonesAssigned: [Z1, Z2]
├── Only zones Z1, Z2
├── Sensors in those zones
├── Alerts for those zones
└── AI predictions for those zones
```

### AUDITOR
```
Scope: GLOBAL (read-only)
├── All industries
├── All sites
├── All zones
└── Historical data only
```

---

## Security Checklist

### ✅ Always Do
- [ ] Add `verifyToken` to all protected routes
- [ ] Add role/permission checks after `verifyToken`
- [ ] Validate resource ownership in service layer
- [ ] Use `checkZone` for OPERATOR endpoints
- [ ] Sanitize user objects (remove password)
- [ ] Log security-relevant actions
- [ ] Use HTTPS in production
- [ ] Set secure cookie flags

### ❌ Never Do
- [ ] Store passwords in plain text
- [ ] Trust client-side permission checks
- [ ] Skip token validation
- [ ] Return sensitive data without checks
- [ ] Use `localStorage` for tokens
- [ ] Expose internal error details
- [ ] Allow SQL/NoSQL injection
- [ ] Skip input validation

---

## Troubleshooting

### "Token expiré" Error
```javascript
// Frontend automatically handles this
// Calls /api/auth/refresh with HttpOnly cookie
// Retries original request with new token
```

### "Accès refusé" Error
```javascript
// Check:
1. User has correct role?
2. User assigned to resource (site/zone)?
3. Route has correct middleware?
4. Service layer validates ownership?
```

### OPERATOR Sees No Data
```javascript
// Check:
1. User has zonesAssigned populated?
2. Route uses checkZone middleware?
3. Controller filters by req.zoneFilter?
```

### Permission Denied on Frontend
```javascript
// Check:
1. User role in ROLE_PERMISSIONS?
2. Permission name matches exactly?
3. ProtectedRoute/PermissionGate configured correctly?
```

---

## Testing RBAC

### Manual Testing

```bash
# 1. Login as each role
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@enim.tn","password":"Admin1234"}'

# 2. Extract token
TOKEN="eyJhbGciOiJIUzI1NiJ9..."

# 3. Test endpoint
curl http://localhost:5000/api/users \
  -H "Authorization: Bearer $TOKEN"

# 4. Verify response
# ✅ 200 OK → Access granted
# ❌ 401 Unauthorized → Token invalid
# ❌ 403 Forbidden → Insufficient permissions
```

### Automated Testing

```javascript
describe("RBAC Tests", () => {
  it("SUPER_ADMIN can create users", async () => {
    const token = await loginAs("SUPER_ADMIN");
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: "test", email: "test@example.com", ... });
    expect(res.status).toBe(201);
  });

  it("OPERATOR cannot create users", async () => {
    const token = await loginAs("OPERATOR");
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: "test", email: "test@example.com", ... });
    expect(res.status).toBe(403);
  });
});
```

---

## Default Test Accounts

### Original Demo Accounts
| Role | Email | Password | Scope |
|------|-------|----------|-------|
| SUPER_ADMIN | admin@example.com | admin123 | All |
| HEAD_SUPERVISOR | head@example.com | head123 | — |
| SITE_SUPERVISOR | site@example.com | site123 | — |
| OPERATOR | operator@example.com | operator123 | Both Gabès zones |
| AUDITOR | auditor@example.com | audit123 | All (read-only) |

### Cimenterie de Gabès (Seeded 2026-05-06)
| Role | Email | Password | Scope |
|------|-------|----------|-------|
| HEAD_SUPERVISOR | responsable.industrie@cimenterie-gabes.tn | Head123! | Cimenterie de Gabès |
| SITE_SUPERVISOR | responsable.site@cimenterie-gabes.tn | Site123! | Site Principal Gabès (2 zones) |
| OPERATOR | operateur.four@cimenterie-gabes.tn | Oper123! | Zone Fours de Calcination |
| OPERATOR | operateur.broyage@cimenterie-gabes.tn | Oper123! | Zone Broyage & Expédition |

⚠️ **Change all passwords before production deployment!**

---

## Quick Commands

### Create User (SUPER_ADMIN only)
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "SecurePass123",
    "role": "OPERATOR",
    "zonesAssigned": ["zone_id_1", "zone_id_2"]
  }'
```

### Assign Zones to OPERATOR
```bash
curl -X POST http://localhost:5000/api/users/{userId}/zones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "zoneIds": ["zone_id_1", "zone_id_2"]
  }'
```

### Change User Role
```bash
curl -X PUT http://localhost:5000/api/users/{userId}/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newRole": "SITE_SUPERVISOR"
  }'
```

---

## Need More Details?

- **Full Analysis:** See `RBAC_ANALYSIS.md`
- **API Documentation:** See `docs/API_REFERENCE.md`
- **Auth Flow:** See `docs/AUTH_RBAC.md`
- **Backend Code:** See `backend/middleware/checkRole.js`
- **Frontend Code:** See `frontend/src/lib/rbac/checkPermission.ts`

---

**Last Updated:** May 6, 2026 — v2.0 (major implementation session)  
**Version:** 2.0
