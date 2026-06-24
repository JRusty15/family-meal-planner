import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Auto-detect if running inside Docker (standard /.dockerenv file or custom env var)
if os.path.exists("/.dockerenv") or os.environ.get("RUNNING_IN_DOCKER") == "true":
    DATA_DIR = "/app/data"
else:
    DATA_DIR = "./data"

# Ensure the data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_PATH = os.path.join(DATA_DIR, "mealplanner.db")
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Create the database engine
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for database models
Base = declarative_base()

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
