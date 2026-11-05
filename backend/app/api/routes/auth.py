import uuid
from typing import Dict, List
from fastapi import APIRouter, HTTPException, status

from app.schemas.auth import AuthResponse, LoginRequest, UserProfile, UserRole

router = APIRouter(prefix="/auth", tags=["Authentication"])

DEMO_USERS: Dict[str, UserProfile] = {
    "student-alex": UserProfile(
        user_id="student-alex",
        name="Alex Chen",
        email="alex.chen@university.edu",
        role=UserRole.STUDENT,
        student_id="STU-2026-0814",
    ),
    "prof-evaluation": UserProfile(
        user_id="prof-evaluation",
        name="Prof. Marcus Vance",
        email="m.vance@university.edu",
        role=UserRole.FACULTY,
        department="Computer Science & Engineering",
    ),
    "admin-root": UserProfile(
        user_id="admin-root",
        name="Dean Dr. Eleanor Cross",
        email="dean.cross@university.edu",
        role=UserRole.ADMIN,
        department="Academic Affairs & Computing Governance",
    ),
}


@router.get("/demo-users", response_model=List[UserProfile])
def get_demo_users():
    """Returns available predefined student and faculty profiles for quick testing."""
    return list(DEMO_USERS.values())


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest):
    """
    Authenticates a user as Student or Faculty.
    Accepts predefined accounts or creates a dynamic demo session.
    """
    username = request.username.strip()
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required.",
        )

    # Check for known demo user
    matched_user = DEMO_USERS.get(username)
    if matched_user and matched_user.role == request.role:
        user_profile = matched_user
    else:
        # Dynamic profile generation for any username
        display_name = username.replace("-", " ").replace(".", " ").title()
        if request.role == UserRole.FACULTY:
            if not display_name.startswith("Prof.") and not display_name.startswith("Dr."):
                display_name = f"Prof. {display_name}"
            user_profile = UserProfile(
                user_id=username,
                name=display_name,
                email=f"{username}@university.edu",
                role=UserRole.FACULTY,
                department="Computer Science",
            )
        elif request.role == UserRole.ADMIN:
            if not display_name.startswith("Dean") and not display_name.startswith("Admin"):
                display_name = f"Admin {display_name}"
            user_profile = UserProfile(
                user_id=username,
                name=display_name,
                email=f"{username}@admin.university.edu",
                role=UserRole.ADMIN,
                department="Academic IT Administration",
            )
        else:
            user_profile = UserProfile(
                user_id=username,
                name=display_name,
                email=f"{username}@student.edu",
                role=UserRole.STUDENT,
                student_id=f"STU-{abs(hash(username)) % 10000:04d}",
            )

    token = f"demo-jwt-{uuid.uuid4().hex}"

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=user_profile,
    )
