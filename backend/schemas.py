from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict
from datetime import datetime

# Auth Schemas
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "faculty"  # "admin", "faculty", or "student"
    department: Optional[str] = None
    roll_number: Optional[str] = None
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    department: Optional[str] = None
    teacher_id: Optional[int] = None
    roll_number: Optional[str] = None
    full_name: Optional[str] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    teacher_id: Optional[int] = None
    roll_number: Optional[str] = None
    full_name: Optional[str] = None
    department: Optional[str] = None

class TokenData(BaseModel):
    username: Optional[str] = None

# Subject Schemas
class SubjectCreate(BaseModel):
    name: str
    code: str
    semester: Optional[str] = None

class SubjectResponse(BaseModel):
    id: int
    name: str
    code: str
    semester: Optional[str] = None

    class Config:
        from_attributes = True

# Teacher Schemas
class TeacherCreate(BaseModel):
    name: str
    department: str
    semester: Optional[str] = None

class TeacherResponse(BaseModel):
    id: int
    name: str
    department: str
    semester: Optional[str] = None

    class Config:
        from_attributes = True

# Feedback Schemas
class FeedbackCreate(BaseModel):
    subject_id: int
    teacher_id: int
    semester: str
    section_ratings: Dict[str, Dict[str, int]]
    section_texts: Dict[str, str]
    student_roll: Optional[str] = None
    student_dept: Optional[str] = None

class FeedbackResponse(BaseModel):
    id: int
    text: str
    rating: int
    semester: str
    timestamp: datetime
    subject_id: int
    teacher_id: int
    subject: SubjectResponse
    teacher: TeacherResponse
    student_roll: Optional[str] = None
    student_dept: Optional[str] = None

    # AI outputs
    sentiment: Optional[str] = None
    sentiment_score: Optional[float] = None
    categories: Optional[str] = None
    keywords: Optional[str] = None
    summary: Optional[str] = None
    priority: Optional[str] = None
    recommendation: Optional[str] = None

    # Detailed data (returned as JSON strings)
    section_ratings: Optional[str] = None
    section_texts: Optional[str] = None

    class Config:
        from_attributes = True

# Analytics & Dashboard Schemas
class CategoryMetric(BaseModel):
    category: str
    count: int

class SentimentBreakdown(BaseModel):
    positive: int
    neutral: int
    negative: int

class KeywordMetric(BaseModel):
    text: str
    value: int

class AlertItem(BaseModel):
    id: int
    text: str
    category: str
    priority: str
    teacher_name: str
    subject_name: str

class RecommendationItem(BaseModel):
    category: str
    count: int
    action: str

class DashboardData(BaseModel):
    total_feedback: int
    average_rating: float
    sentiment_breakdown: SentimentBreakdown
    category_counts: List[CategoryMetric]
    keywords: List[KeywordMetric]
    alerts: List[AlertItem]
    recommendations: List[RecommendationItem]
    recent_feedbacks: List[FeedbackResponse]
