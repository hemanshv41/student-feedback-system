import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="faculty")  # "admin", "faculty", or "student"
    department = Column(String, nullable=True)
    roll_number = Column(String, unique=True, index=True, nullable=True)  # for students
    full_name = Column(String, nullable=True)
    
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    teacher = relationship("Teacher")

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    semester = Column(String, nullable=True)  # e.g., "Semester 5"

    feedbacks = relationship("Feedback", back_populates="subject")

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    department = Column(String, nullable=False)
    semester = Column(String, nullable=True)  # e.g., "Semester 5"

    feedbacks = relationship("Feedback", back_populates="teacher")

class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    rating = Column(Integer, nullable=False)  # 1 to 5 stars
    semester = Column(String, nullable=False)  # e.g., "Fall 2026", "Spring 2026"
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Student metadata
    student_roll = Column(String, nullable=True)
    student_dept = Column(String, nullable=True)

    # Relationships
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)

    # AI Analyzed Columns
    sentiment = Column(String, nullable=True)  # "Positive", "Neutral", "Negative"
    sentiment_score = Column(Float, nullable=True)  # score from 0.0 to 1.0
    categories = Column(String, nullable=True)  # Comma-separated list e.g., "Teaching, Infrastructure"
    keywords = Column(String, nullable=True)  # Comma-separated list of key terms
    summary = Column(Text, nullable=True)
    priority = Column(String, nullable=True)  # "Low", "Medium", "High", "Flagged Toxic"
    recommendation = Column(Text, nullable=True)

    # Detailed Questionnaire Storage (JSON strings)
    section_ratings = Column(Text, nullable=True)
    section_texts = Column(Text, nullable=True)

    # Relationships
    subject = relationship("Subject", back_populates="feedbacks")
    teacher = relationship("Teacher", back_populates="feedbacks")
