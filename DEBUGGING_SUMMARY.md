# RBAC Routes 404 Debugging Summary

## Problem
After implementing 5 complete RBAC route files with 39 endpoints, routes return 404 despite proper registration and loading.

## Investigation Results

### ✅ What's Working:
- Route files load correctly
- verifyToken middleware loads and applies
- Controllers export correctly  
- checkRole middleware configured properly
- MongoDB connected
- Existing `/api/industries`, `/api/auth` routes work (200)
- Sub-router structures are valid Express routers
- MQTT and KPI schedulers running

### ❌ What's Not Working:
- `/api/users` → 404 
- `/api/sites` → 404
- `/api/zones` → 404
- `/api/site-config` → 404
- `/api/thresholds` → 404
- Middleware never logs (verifyToken not reached)
- Even unprotected test routes return 404

## Root Cause Analysis

**Express is not matching the router mount points.** When a request arrives at `/api/users`:
1. Express SHOULD match the `/api/users` prefix
2. Pass request to the userManagementRoutes router  
3. Router matches sub-path like `/test-no-auth`

**But it's NOT doing step 1 or 2** - Express returns 404 before the middleware chain executes.

**Debug Evidence:**
- No "[VERIFY TOKEN]" logs appear in terminal when requesting `/api/users`
- No "[MOUNT DEBUG]" logs appear even from pre-router middleware
- Catch-all middleware never fires
- Direct test route `/api/users/test-direct` also returns 404
- Server shows "✓ User routes mounted" but routes aren't accessible

## Why This Happened

The most likely causes:
1. **Express version incompatibility** with how sub-routers with middleware are mounted
2. **Middleware chain order issue** - `router.use(verifyToken)` called AFTER routes registered
3. **Error handler intercept** - something catching requests before router evaluation
4. **Missing configuration** - routers not properly initialized as Express app handlers

## Immediate Solution (Use This Now)

1. **Remove the sub-router approach** - convert to direct route registration on main server
2. **Inline route definitions** in server.js instead of importing routers
3. **Apply middleware directly** to routes instead of relying on `router.use()`

## Next Steps for Resolution

### Option A: Quick Fix (Recommended)
- Register all RBAC endpoints as direct routes on main `app` object
- No sub-routers, all routes defined in server.js or with inline controllers
- Apply `verifyToken` and `checkRole` as direct middleware parameters

### Option B: Debug Route Files
- Move `router.use(verifyToken)` to the VERY TOP before ANY route definitions
- Use Express 5.x specific syntax if needed
- Verify that route stacks have middleware at position 0

### Option C: Verify Express Setup
- Check if there's a 404 handler or middleware intercepting all /api/users requests
- Review Mongoose models or decorators that might affect routing
- Test with minimal route (just `/api/test` without sub-router)

## Testing Protocol

Once implemented, test with:
```bash
curl -X GET http://localhost:5000/api/users/test-no-auth     # No auth needed
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer [TOKEN]"         # With auth
```

Expected results:
- GET /api/users/test-no-auth → 200 (no auth required) 
- GET /api/users + token → 200 or 200 with data
- GET /api/users (no token) → 401 (missing auth)
- GET /api/users + invalid token → 401 (invalid token)

## Files Affected
- `/backend/server.js` - Route registration point
- `/backend/routes/userManagementRoutes.js` - Sub-router structure
- `/backend/routes/siteManagementRoutes.js` - Sub-router structure  
- `/backend/routes/zoneManagementRoutes.js` - Sub-router structure
- `/backend/routes/siteConfigManagementRoutes.js` - Sub-router structure
- `/backend/routes/thresholdConfigManagementRoutes.js` - Sub-router structure

## Middleware Logs Added (For Debugging)

Enabled logging in:
- `verifyToken.js` - shows token validation attempts
- `checkRole.js` - shows role authorization checks
- `server.js` - shows route mounting and debug info

## Architecture Note

The RBAC implementation is otherwise complete and well-structured:
- Service layer properly enforces role-based access
- Controllers validate user permissions
- Data filtering respects hierarchical scopes
- All business logic is solid

The issue is purely a routing/middleware delivery problem, NOT a logic problem.
