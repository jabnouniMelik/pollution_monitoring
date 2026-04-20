/\*\*

- DTO Usage Guide - Backend & Frontend Data Contracts
-
- This document explains how to use DTOs for consistent communication
- between backend and frontend.
  \*/

// ════════════════════════════════════════════════════════════
// BACKEND: How to use DTOs
// ════════════════════════════════════════════════════════════

// 1. In Controllers:
const { LoginResponseDTO, UserDTO } = require("../dtos/AuthDTO");

async function loginController(req, res) {
try {
// Validate request
LoginRequestDTO.validate(req.body);

    // Authenticate user
    const user = await User.findOne({ email: req.body.email });

    // Convert entity to DTO
    const userDTO = UserDTO.fromEntity(user);

    // Create response DTO
    const responseDTO = new LoginResponseDTO(token, userDTO);

    // Send response
    res.status(200).json(responseDTO);

} catch (error) {
// Use error DTO
const errorDTO = ErrorResponseDTO.BadRequest(error.message);
res.status(400).json(errorDTO);
}
}

// 2. In Services:
const { ReadingDTO } = require("../dtos/ReadingDTO");

function mapReadingsToDTO(readings) {
return readings.map(reading => ReadingDTO.fromEntity(reading));
}

// 3. In Routes:
router.post("/login", async (req, res) => {
const { email, password } = req.body;

// Validate with DTO
new LoginRequestDTO(email, password);
LoginRequestDTO.validate(req.body);

// ... process login
});

// ════════════════════════════════════════════════════════════
// FRONTEND: How to use Types
// ════════════════════════════════════════════════════════════

// 1. Import types
import type {
LoginRequest,
LoginResponse,
UserInfo
} from "@/types/dtos";

// 2. Use in API Services:
export const authService = {
async login(credentials: LoginRequest): Promise<LoginResponse> {
const response = await apiClient.post("/api/auth/login", credentials);
return response.data as LoginResponse;
}
};

// 3. Use in Components:
import type { UserInfo } from "@/types/dtos";

interface DashboardProps {
user: UserInfo;
isLoading: boolean;
}

export const Dashboard = ({ user, isLoading }: DashboardProps) => {
return (
<div>
<h1>Welcome, {user.name}</h1>
</div>
);
};

// 4. Use in React Hooks:
import { useQuery } from "@tanstack/react-query";
import type { KpiDashboardResponse } from "@/types/dtos";

export function useKpiDashboard() {
return useQuery<KpiDashboardResponse>({
queryKey: ["kpi", "dashboard"],
queryFn: async () => {
const response = await apiClient.get("/api/kpi/dashboard");
return response.data;
},
});
}

// ════════════════════════════════════════════════════════════
// DTO STRUCTURE & VALIDATION
// ════════════════════════════════════════════════════════════

/\*\*

- Each DTO class should have:
- 1.  Constructor - initialize all fields
- 2.  Static validate() - validate input data
- 3.  Static fromEntity() - convert database entity to DTO
      \*/

class ExampleDTO {
constructor(id, name, value) {
this.id = id;
this.name = name;
this.value = value;
}

// Validates incoming data
static validate(data) {
if (!data.name) throw new Error("Name is required");
if (typeof data.value !== "number") throw new Error("Value must be a number");
}

// Converts database entity to clean DTO
static fromEntity(entity) {
return new ExampleDTO(
entity.\_id || entity.id,
entity.name,
entity.value
);
}
}

// ════════════════════════════════════════════════════════════
// BEST PRACTICES
// ════════════════════════════════════════════════════════════

// ✓ DO:
// - Use DTOs for all request/response data
// - Validate data before creation
// - Convert database entities to DTOs before sending
// - Use TypeScript types in frontend
// - Maintain 1:1 mapping between backend DTOs and frontend types

// ✗ DON'T:
// - Send raw database entities as responses
// - Skip validation of incoming data
// - Create different data structures in frontend than backend
// - Expose internal database fields in responses
// - Mix DTOs with business logic

// ════════════════════════════════════════════════════════════
// AVAILABLE DTOS
// ════════════════════════════════════════════════════════════

/\*\*

- AuthDTO.js
- - LoginRequestDTO
- - LoginResponseDTO
- - UserDTO
- - RefreshTokenRequestDTO
- - RefreshTokenResponseDTO
    \*/

/\*\*

- ReadingDTO.js
- - ReadingDTO
- - ReadingsHistoryDTO
- - DailyAggregateDTO
- - ReadingsStatsDTO
    \*/

/\*\*

- AlertDTO.js
- - AlertDTO
- - AlertsListDTO
- - CreateAlertRequestDTO
- - AcknowledgeAlertRequestDTO
    \*/

/\*\*

- KpiDTO.js
- - KpiDashboardDTO
- - KpiTrendsDTO
- - KpiDataPointDTO
- - KpiDashboardResponseDTO
    \*/

/\*\*

- ErrorDTO.js
- - ErrorResponseDTO (with static helper methods)
- - SuccessResponseDTO
    \*/
