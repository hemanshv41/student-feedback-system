from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
import json
from collections import Counter

# Local imports
import models
import schemas
import auth
from database import engine, get_db, Base
from analyzer import analyze_feedback

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Student Feedback Analytics API",
    description="Backend services for student feedback analysis & decision support system.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits all origins for easy development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root Endpoint
@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "AI Student Feedback API is active.",
        "docs_url": "/docs"
    }

# ==================== AUTH ROUTING ====================

@app.post("/api/auth/register", response_model=schemas.ResponseModel if "ResponseModel" in dir(schemas) else schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user_username = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user_username:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    db_user_email = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user_email:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_pwd = auth.get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_pwd,
        role=user.role,
        department=user.department,
        roll_number=user.roll_number,
        full_name=user.full_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
 
@app.post("/api/auth/login", response_model=schemas.Token)
def login_for_access_token(form_data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        (models.User.username == form_data.username) | 
        (models.User.email == form_data.username)
    ).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is blocked by the administrator."
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "teacher_id": user.teacher_id,
        "roll_number": user.roll_number,
        "full_name": user.full_name,
        "department": user.department
    }

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

# ==================== SUBJECTS & TEACHERS ROUTING ====================

@app.get("/api/subjects", response_model=List[schemas.SubjectResponse])
def get_subjects(db: Session = Depends(get_db)):
    return db.query(models.Subject).all()

@app.post("/api/subjects", response_model=schemas.SubjectResponse)
def create_subject(subject: schemas.SubjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    existing = db.query(models.Subject).filter(models.Subject.code == subject.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject code already exists")
    db_sub = models.Subject(name=subject.name, code=subject.code)
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

@app.get("/api/teachers", response_model=List[schemas.TeacherResponse])
def get_teachers(db: Session = Depends(get_db)):
    return db.query(models.Teacher).all()

@app.post("/api/teachers", response_model=schemas.TeacherResponse)
def create_teacher(teacher: schemas.TeacherCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_teacher = models.Teacher(name=teacher.name, department=teacher.department)
    db.add(db_teacher)
    db.commit()
    db.refresh(db_teacher)
    return db_teacher

# ==================== FEEDBACK SUBMISSION ROUTING ====================

@app.post("/api/feedback/submit", response_model=schemas.FeedbackResponse)
def submit_feedback(feedback: schemas.FeedbackCreate, db: Session = Depends(get_db)):
    # Verify Subject & Teacher exist
    subject = db.query(models.Subject).filter(models.Subject.id == feedback.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    teacher = db.query(models.Teacher).filter(models.Teacher.id == feedback.teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    # 1. Compute overall consolidated text comment
    all_comments = []
    for sec, text_val in feedback.section_texts.items():
        if text_val.strip():
            all_comments.append(f"{sec}: {text_val.strip()}")
    consolidated_text = " | ".join(all_comments)
    if not consolidated_text:
        consolidated_text = "No written comments provided."

    # 2. Compute overall average rating
    all_ratings = []
    for sec, q_ratings in feedback.section_ratings.items():
        for q, rating_val in q_ratings.items():
            all_ratings.append(rating_val)
    avg_rating = round(sum(all_ratings) / len(all_ratings)) if all_ratings else 5

    # Run AI Analysis Pipeline
    try:
        ai_metrics = analyze_feedback(consolidated_text)
        # Generate targeted teacher recommendations based on rating thresholds and section comments
        from analyzer import generate_teacher_recommendations
        teacher_recomm = generate_teacher_recommendations(feedback.section_ratings, feedback.section_texts)
        ai_metrics["recommendation"] = teacher_recomm
    except Exception as e:
        # Graceful fallback values in case of crash
        print(f"Error executing AI analysis: {e}")
        ai_metrics = {
            "sentiment": "Neutral",
            "sentiment_score": 0.5,
            "categories": "General",
            "keywords": "",
            "summary": consolidated_text[:100],
            "priority": "Low",
            "recommendation": "Review feedback manually."
        }

    # Store feedback with AI metadata
    db_feedback = models.Feedback(
        text=consolidated_text,
        rating=avg_rating,
        semester=feedback.semester,
        subject_id=feedback.subject_id,
        teacher_id=feedback.teacher_id,
        sentiment=ai_metrics["sentiment"],
        sentiment_score=ai_metrics["sentiment_score"],
        categories=ai_metrics["categories"],
        keywords=ai_metrics["keywords"],
        summary=ai_metrics["summary"],
        priority=ai_metrics["priority"],
        recommendation=ai_metrics["recommendation"],
        section_ratings=json.dumps(feedback.section_ratings),
        section_texts=json.dumps(feedback.section_texts),
        student_roll=feedback.student_roll,
        student_dept=feedback.student_dept
    )
    db.add(db_feedback)
    db.commit()
    db.refresh(db_feedback)
    return db_feedback

@app.get("/api/feedback/list", response_model=List[schemas.FeedbackResponse])
def list_feedbacks(
    subject_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    semester: Optional[str] = None,
    sentiment: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Feedback)
    
    # Force filter to only show this instructor's feedbacks if role is faculty, or student's own feedback if student
    if current_user.role == "faculty" and current_user.teacher_id:
        query = query.filter(models.Feedback.teacher_id == current_user.teacher_id)
    elif current_user.role == "student":
        query = query.filter(models.Feedback.student_roll == current_user.roll_number)
    else:
        if teacher_id:
            query = query.filter(models.Feedback.teacher_id == teacher_id)
            
    if subject_id:
        query = query.filter(models.Feedback.subject_id == subject_id)
    if semester:
        query = query.filter(models.Feedback.semester == semester)
    if sentiment:
        query = query.filter(models.Feedback.sentiment == sentiment)
    if priority:
        query = query.filter(models.Feedback.priority == priority)
        
    return query.order_by(models.Feedback.timestamp.desc()).all()

# ==================== ANALYTICS & DASHBOARD ====================

@app.get("/api/analytics/dashboard", response_model=schemas.DashboardData)
def get_dashboard_analytics(
    subject_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    semester: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Base query for feedback
    query = db.query(models.Feedback)
    
    # Apply Filters
    if current_user.role == "faculty" and current_user.teacher_id:
        query = query.filter(models.Feedback.teacher_id == current_user.teacher_id)
    elif current_user.role == "student":
        query = query.filter(models.Feedback.student_roll == current_user.roll_number)
    else:
        if teacher_id:
            query = query.filter(models.Feedback.teacher_id == teacher_id)
            
    if subject_id:
        query = query.filter(models.Feedback.subject_id == subject_id)
    if semester:
        query = query.filter(models.Feedback.semester == semester)
        
    feedbacks = query.all()
    total_fb = len(feedbacks)
    
    # Edge case: No feedbacks in database yet
    if total_fb == 0:
        return {
            "total_feedback": 0,
            "average_rating": 0.0,
            "sentiment_breakdown": {"positive": 0, "neutral": 0, "negative": 0},
            "category_counts": [],
            "keywords": [],
            "alerts": [],
            "recommendations": [],
            "recent_feedbacks": []
        }
        
    # 1. Average rating
    avg_rating = sum(fb.rating for fb in feedbacks if fb.rating) / total_fb
    
    # 2. Sentiment breakdown
    pos_count = sum(1 for fb in feedbacks if fb.sentiment == "Positive")
    neu_count = sum(1 for fb in feedbacks if fb.sentiment == "Neutral")
    neg_count = sum(1 for fb in feedbacks if fb.sentiment == "Negative")
    
    # 3. Category distribution counts
    cat_list = []
    for fb in feedbacks:
        if fb.categories:
            cats = [c.strip() for c in fb.categories.split(",")]
            cat_list.extend(cats)
    cat_counts = Counter(cat_list)
    category_metrics = [
        schemas.CategoryMetric(category=cat, count=cnt)
        for cat, cnt in cat_counts.items()
    ]
    # Sort categories by frequency
    category_metrics.sort(key=lambda x: x.count, reverse=True)
    
    # 4. Keyword cloud counts
    kw_list = []
    for fb in feedbacks:
        if fb.keywords:
            kws = [k.strip() for k in fb.keywords.split(",")]
            kw_list.extend(kws)
    kw_counts = Counter(kw_list)
    keyword_metrics = [
        schemas.KeywordMetric(text=kw, value=cnt)
        for kw, cnt in kw_counts.items() if len(kw) > 2
    ][:30]  # Return top 30 keywords
    keyword_metrics.sort(key=lambda x: x.value, reverse=True)
    
    # 5. Alert Items (High priority or Flagged Toxic)
    alerts = []
    for fb in feedbacks:
        if fb.priority in ["High", "Flagged Toxic"]:
            alerts.append(
                schemas.AlertItem(
                    id=fb.id,
                    text=fb.text,
                    category=fb.categories or "General",
                    priority=fb.priority,
                    teacher_name=fb.teacher.name,
                    subject_name=fb.subject.name
                )
            )
    # Sort alerts: Toxic and High Priority at the top
    alerts.sort(key=lambda x: (x.priority == "Flagged Toxic", x.priority == "High"), reverse=True)
    
    # 6. Action Recommendations
    # Find all topics where students submitted Negative feedback and group by counts
    neg_topics = []
    for fb in feedbacks:
        if fb.sentiment == "Negative" and fb.categories:
            cats = [c.strip() for c in fb.categories.split(",")]
            neg_topics.extend(cats)
            
    neg_topic_counts = Counter(neg_topics)
    recommendations = []
    
    # Set of typical actions
    action_templates = {
        "Teaching quality": "Coordinate faculty teaching reviews; recommend slowing down instruction speeds or providing supplementary review slides.",
        "Lab facilities": "Upgrade computer configurations (SSD/RAM storage) and request repairs for frozen laboratory workstations.",
        "Assignments": "Re-schedule project submissions to avoid overlapping test deadlines; standardize lab report grading rubrics.",
        "Exams": "Re-assess exam difficulty metrics and publish standardized preparatory quizzes to clarify exam expectations.",
        "Infrastructure": "Coordinate with IT/Facility support to deploy additional Wi-Fi access points and repair classroom projector panels."
    }
    
    for cat, cnt in neg_topic_counts.items():
        action = action_templates.get(cat, "Perform review of student comments to outline departmental corrective adjustments.")
        recommendations.append(
            schemas.RecommendationItem(
                category=cat,
                count=cnt,
                action=action
            )
        )
    # Sort by amount of negative feedback
    recommendations.sort(key=lambda x: x.count, reverse=True)
    
    # 7. Recent Feedback (last 10)
    recent_feedbacks = feedbacks[:10]
    
    return schemas.DashboardData(
        total_feedback=total_fb,
        average_rating=round(avg_rating, 2),
        sentiment_breakdown=schemas.SentimentBreakdown(
            positive=pos_count,
            neutral=neu_count,
            negative=neg_count
        ),
        category_counts=category_metrics,
        keywords=keyword_metrics,
        alerts=alerts,
        recommendations=recommendations,
        recent_feedbacks=recent_feedbacks
    )

# ==================== DATA SEEDING SETUP ====================

@app.post("/api/setup/seed")
def seed_database(db: Session = Depends(get_db)):
    # Clear old data to prevent mixed states
    db.query(models.Feedback).delete()
    db.query(models.Subject).delete()
    db.query(models.Teacher).delete()
    db.query(models.User).delete()
    db.commit()

    # 1. Create Default Admin Users
    admin_user = models.User(
        username="admin",
        email="admin@aktu.edu",
        hashed_password=auth.get_password_hash("admin123"),
        role="admin",
        department="Computer Science",
        full_name="Hemansh Verma"
    )
    db.add(admin_user)
    
    hemansh_admin = models.User(
        username="hemanshv@gmail.com",
        email="hemanshv@gmail.com",
        hashed_password=auth.get_password_hash("1234567890"),
        role="admin",
        department="Computer Science",
        full_name="Hemansh Verma"
    )
    db.add(hemansh_admin)
    db.commit()
        
    # 2. Add Default AKTU University Subjects
    subjects_to_add = [
        {"name": "Database Management Systems", "code": "KCS-501", "semester": "Semester 5"},
        {"name": "Compiler Design", "code": "KCS-502", "semester": "Semester 6"},
        {"name": "Design & Analysis of Algorithms", "code": "KCS-501B", "semester": "Semester 5"},
        {"name": "Operating Systems", "code": "KCS-401", "semester": "Semester 4"},
        {"name": "Computer System Security", "code": "KCS-601", "semester": "Semester 6"},
        {"name": "Web Technology", "code": "KCS-602", "semester": "Semester 6"},
        {"name": "Computer Networks", "code": "KCS-603", "semester": "Semester 6"},
        {"name": "Software Engineering", "code": "KCS-503", "semester": "Semester 5"},
        {"name": "Basic Electrical Engineering", "code": "KEE-101", "semester": "Semester 1"},
        {"name": "Programming for Problem Solving", "code": "KCS-201", "semester": "Semester 2"},
        {"name": "Data Structures", "code": "KCS-301", "semester": "Semester 3"},
        {"name": "Computer Organization & Architecture", "code": "KCS-302", "semester": "Semester 3"}
    ]
    
    inserted_subs = []
    for sub in subjects_to_add:
        existing = db.query(models.Subject).filter(models.Subject.code == sub["code"]).first()
        if not existing:
            new_sub = models.Subject(name=sub["name"], code=sub["code"], semester=sub.get("semester"))
            db.add(new_sub)
            inserted_subs.append(new_sub)
        else:
            existing.semester = sub.get("semester")
            inserted_subs.append(existing)
            
    # Flush to get IDs
    db.commit()
    
    # 3. Add Default Teachers with Random Academic Names and Semesters
    teachers_to_add = [
        {"name": "Dr. Rajesh Sharma", "department": "Computer Science", "semester": "Semester 5"},
        {"name": "Prof. Amit Verma", "department": "Computer Science", "semester": "Semester 6"},
        {"name": "Dr. Sneha Gupta", "department": "Computer Science", "semester": "Semester 5"},
        {"name": "Prof. Vikram Singh", "department": "Information Technology", "semester": "Semester 4"},
        {"name": "Dr. Priya Nair", "department": "Computer Science", "semester": "Semester 6"},
        {"name": "Prof. Sandeep Mishra", "department": "Computer Science", "semester": "Semester 5"},
        {"name": "Dr. Amit Patel", "department": "Electrical Engineering", "semester": "Semester 1"},
        {"name": "Prof. Priya Verma", "department": "Computer Science", "semester": "Semester 2"},
        {"name": "Dr. Sandeep Kumar", "department": "Computer Science", "semester": "Semester 3"},
        {"name": "Prof. Shalini Dwivedi", "department": "Computer Science", "semester": "Semester 3"}
    ]
    
    inserted_teachers = []
    for t in teachers_to_add:
        existing = db.query(models.Teacher).filter(models.Teacher.name == t["name"]).first()
        if not existing:
            new_t = models.Teacher(name=t["name"], department=t["department"], semester=t.get("semester"))
            db.add(new_t)
            inserted_teachers.append(new_t)
        else:
            existing.semester = t.get("semester")
            inserted_teachers.append(existing)
            
    db.commit()

    # 4. Create User Accounts for Teachers/Faculty (with collision resolution)
    import re
    created_usernames = {"admin"}
    for teacher in inserted_teachers:
        raw_name = teacher.name.replace("Dr. ", "").replace("Prof. ", "").strip().lower()
        parts = re.sub(r'[^a-z\s]', '', raw_name).split()
        if len(parts) >= 2:
            username = parts[0]
        else:
            username = parts[0] if parts else "teacher"
            
        if username in created_usernames:
            if len(parts) >= 2:
                username = f"{parts[0]}{parts[1]}"
            else:
                username = f"{username}{teacher.id}"
                
        # Re-check in case the resolved username also has a collision (unlikely but safe)
        if username in created_usernames:
            username = f"{username}{teacher.id}"
            
        created_usernames.add(username)
        
        # Check if user already exists in DB
        existing_user = db.query(models.User).filter(models.User.username == username).first()
        if not existing_user:
            hashed_pwd = auth.get_password_hash("teacher123")
            new_user = models.User(
                username=username,
                email=f"{username}@aktu.edu",
                hashed_password=hashed_pwd,
                role="faculty",
                department=teacher.department,
                teacher_id=teacher.id
            )
            db.add(new_user)
    db.commit()

    # 5. Create default Student User accounts
    student_users = [
        {
            "username": "2000290100001",
            "email": "student1@aktu.edu",
            "password": "student123",
            "role": "student",
            "department": "Computer Science",
            "roll_number": "2000290100001",
            "full_name": "Hemansh Verma"
        },
        {
            "username": "2000290100002",
            "email": "student2@aktu.edu",
            "password": "student123",
            "role": "student",
            "department": "Information Technology",
            "roll_number": "2000290100002",
            "full_name": "Aarav Sharma"
        }
    ]
    for s in student_users:
        existing_student = db.query(models.User).filter(models.User.username == s["username"]).first()
        if not existing_student:
            hashed_pwd = auth.get_password_hash(s["password"])
            new_student = models.User(
                username=s["username"],
                email=s["email"],
                hashed_password=hashed_pwd,
                role=s["role"],
                department=s["department"],
                roll_number=s["roll_number"],
                full_name=s["full_name"]
            )
            db.add(new_student)
            
    db.commit()

    sub_map = {s.code: s.id for s in inserted_subs}
    teach_map = {t.name: t.id for t in inserted_teachers}
    
    sample_feedbacks = [
        {
            "text": "The teacher explains concepts very clearly, but the laboratory computers are extremely slow and lagging.",
            "rating": 4,
            "subject_id": sub_map["KCS-501"],
            "teacher_id": teach_map["Dr. Rajesh Sharma"],
            "semester": "Semester 5"
        },
        {
            "text": "Wi-Fi never works during lab sessions. Please fix the wireless internet connection immediately, it is highly frustrating.",
            "rating": 2,
            "subject_id": sub_map["KCS-601"],
            "teacher_id": teach_map["Prof. Amit Verma"],
            "semester": "Semester 6"
        },
        {
            "text": "Worst faculty ever. Completely useless lecturing style. I learned absolutely nothing during classes.",
            "rating": 1,
            "subject_id": sub_map["KCS-603"],
            "teacher_id": teach_map["Dr. Priya Nair"],
            "semester": "Semester 6"
        },
        {
            "text": "The library books are well maintained and the syllabus is fully completed. However, the classroom projectors in Room 302 are broken and we need longer weekend opening hours.",
            "rating": 3,
            "subject_id": sub_map["KCS-503"],
            "teacher_id": teach_map["Prof. Sandeep Mishra"],
            "semester": "Semester 5"
        },
        {
            "text": "Dr. Sneha explains database concepts beautifully! She gives real world examples and the practical lab sessions are very helpful.",
            "rating": 5,
            "subject_id": sub_map["KCS-501"],
            "teacher_id": teach_map["Dr. Sneha Gupta"],
            "semester": "Semester 5"
        },
        {
            "text": "Dr. Rajesh makes computer networks lab sessions incredibly fun. The experiment instructions are precise and testing tools are high quality.",
            "rating": 5,
            "subject_id": sub_map["KCS-603"],
            "teacher_id": teach_map["Dr. Rajesh Sharma"],
            "semester": "Semester 6"
        },
        {
            "text": "The assignment deadlines are always scheduled at the exact same time as midterm exams. This makes it impossible to prepare well. The exams are too difficult.",
            "rating": 2,
            "subject_id": sub_map["KCS-401"],
            "teacher_id": teach_map["Prof. Vikram Singh"],
            "semester": "Semester 4"
        }
    ]

    # Helper to generate dummy section ratings and texts matching the overall rating and raw text
    def make_section_data(raw_text, rating_val):
        sections = [
            "Teaching Quality",
            "Course Content",
            "Laboratory / Practical Sessions",
            "Assignments & Evaluation",
            "Infrastructure",
            "Student Support",
            "Overall Satisfaction"
        ]
        
        ratings = {}
        for sec in sections:
            q_count = 5
            if sec in ["Teaching Quality", "Infrastructure"]:
                q_count = 6
            elif sec == "Overall Satisfaction":
                q_count = 4
            ratings[sec] = {f"Q{i+1}": rating_val for i in range(q_count)}
            
        comments = {}
        for sec in sections:
            comments[sec] = "No major observations logged."
            
        raw_text_lower = raw_text.lower()
        if "teacher" in raw_text_lower or "explain" in raw_text_lower or "concept" in raw_text_lower:
            comments["Teaching Quality"] = raw_text
        elif "lab" in raw_text_lower or "computer" in raw_text_lower or "software" in raw_text_lower:
            comments["Laboratory / Practical Sessions"] = raw_text
        elif "assignment" in raw_text_lower or "eval" in raw_text_lower or "grading" in raw_text_lower:
            comments["Assignments & Evaluation"] = raw_text
        elif "wifi" in raw_text_lower or "internet" in raw_text_lower or "projector" in raw_text_lower or "classroom" in raw_text_lower:
            comments["Infrastructure"] = raw_text
        else:
            comments["Overall Satisfaction"] = raw_text
            
        return ratings, comments

    for fb_data in sample_feedbacks:
        sect_ratings, sect_texts = make_section_data(fb_data["text"], fb_data["rating"])
        
        # Run through AI analysis
        ai_res = analyze_feedback(fb_data["text"])
        
        # Generate targeted recommendations based on ratings and comments
        from analyzer import generate_teacher_recommendations
        teacher_recomm = generate_teacher_recommendations(sect_ratings, sect_texts)
        ai_res["recommendation"] = teacher_recomm
        
        # Assign random seeded student details
        import random
        rolls = ["2000290100001", "2000290100002"]
        depts = ["Computer Science", "Information Technology"]
        idx = random.randint(0, 1)

        fb = models.Feedback(
            text=fb_data["text"],
            rating=fb_data["rating"],
            semester=fb_data["semester"],
            subject_id=fb_data["subject_id"],
            teacher_id=fb_data["teacher_id"],
            sentiment=ai_res["sentiment"],
            sentiment_score=ai_res["sentiment_score"],
            categories=ai_res["categories"],
            keywords=ai_res["keywords"],
            summary=ai_res["summary"],
            priority=ai_res["priority"],
            recommendation=ai_res["recommendation"],
            section_ratings=json.dumps(sect_ratings),
            section_texts=json.dumps(sect_texts),
            student_roll=rolls[idx],
            student_dept=depts[idx]
        )
        db.add(fb)
        
    db.commit()
    return {"message": "Database seeded successfully with AKTU courses and teachers. Admin created (username: admin, password: admin123)."}

# ==================== ADMIN USER MANAGEMENT ROUTING ====================

@app.get("/api/users", response_model=List[schemas.UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_admin)
):
    # Retrieve all users (excluding current admin to avoid self-blocking)
    return db.query(models.User).filter(models.User.id != current_user.id).all()

@app.put("/api/users/{user_id}/block", response_model=schemas.UserResponse)
def block_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_blocked = True
    db.commit()
    db.refresh(user)
    return user

@app.put("/api/users/{user_id}/unblock", response_model=schemas.UserResponse)
def unblock_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_blocked = False
    db.commit()
    db.refresh(user)
    return user

# Automatically run seed when backend starts to ensure ready-to-test state
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    try:
        seed_database(db)
        print("Startup seeding completed successfully.")
    except Exception as e:
        print(f"Startup seeding failed/already run: {e}")
    finally:
        db.close()
