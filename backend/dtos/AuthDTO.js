/**
 * Authentication DTOs (Data Transfer Objects)
 * Defines request/response contracts for auth endpoints
 */

/**
 * Login Request DTO
 */
export class LoginRequestDTO {
  constructor(email, password) {
    this.email = email;
    this.password = password;
  }

  static validate(data) {
    if (!data.email || !data.password) {
      throw new Error("Email and password are required");
    }
    if (!data.email.includes("@")) {
      throw new Error("Valid email required");
    }
    if (data.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
  }
}

/**
 * Login Response DTO
 */
export class LoginResponseDTO {
  constructor(token, user, refreshToken = null) {
    this.token = token;
    this.user = user;
    this.refreshToken = refreshToken;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * User DTO
 */
export class UserDTO {
  constructor(id, email, role, name, profilePicture = null) {
    this.id = id;
    this.email = email;
    this.role = role;
    this.name = name;
    this.profilePicture = profilePicture;
  }

  static fromEntity(user) {
    return new UserDTO(
      user._id || user.id,
      user.email,
      user.role,
      user.name,
      user.profilePicture,
    );
  }
}

/**
 * Token Refresh Request DTO
 */
export class RefreshTokenRequestDTO {
  constructor(token) {
    this.token = token;
  }
}

/**
 * Token Refresh Response DTO
 */
export class RefreshTokenResponseDTO {
  constructor(token) {
    this.token = token;
    this.timestamp = new Date().toISOString();
  }
}

export default {
  LoginRequestDTO,
  LoginResponseDTO,
  UserDTO,
  RefreshTokenRequestDTO,
  RefreshTokenResponseDTO,
};
