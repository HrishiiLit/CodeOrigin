from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class UserRole(str, Enum):
    STUDENT = "student"
    FACULTY = "faculty"


class UserProfile(BaseModel):
    user_id: str = Field(..., description="Unique user identifier")
    name: str = Field(..., description="Full display name")
    email: str = Field(..., description="Institutional email address")
    role: UserRole = Field(..., description="User role (student or faculty)")
    department: Optional[str] = Field(None, description="Academic department (for faculty)")
    student_id: Optional[str] = Field(None, description="Student registration ID (for students)")


class LoginRequest(BaseModel):
    role: UserRole = Field(UserRole.STUDENT, description="Role to log in as")
    username: str = Field(..., min_length=1, description="Username or ID")
    password: Optional[str] = Field("", description="Password (optional for demo/local mode)")


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile
