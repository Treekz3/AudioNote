from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext
from datetime import datetime
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = pwd_context.hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_notes(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.AudioNote).filter(models.AudioNote.user_id == user_id).offset(skip).limit(limit).all()

def create_user_note(db: Session, note: schemas.AudioNoteCreate, user_id: int, audio_path: str):
    db_note = models.AudioNote(
        **note.dict(),
        user_id=user_id,
        audio_path=audio_path
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

def update_note_transcription(db: Session, note_id: int, transcription: str):
    db_note = db.query(models.AudioNote).filter(models.AudioNote.id == note_id).first()
    if db_note:
        db_note.transcription = transcription
        db.commit()
        db.refresh(db_note)
        return db_note
    return None