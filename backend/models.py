import json
from sqlalchemy import Column, Integer, String, Boolean, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    prep_time = Column(Integer, default=0)  # in minutes
    cook_time = Column(Integer, default=0)  # in minutes
    servings = Column(Integer, default=4)
    instructions = Column(Text, nullable=True)  # Markdown or step-by-step
    
    # Store structured ingredients as a JSON-encoded string
    # Format: [{"name": "Chicken", "amount": 1.5, "unit": "lbs", "notes": "boneless"}]
    ingredients_json = Column(Text, default="[]")
    
    # Store tags as a JSON-encoded string: ["Kid-Friendly", "Quick", "Healthy"]
    tags_json = Column(Text, default="[]")

    meal_plans = relationship("MealPlan", back_populates="recipe", cascade="all, delete-orphan")

    @property
    def ingredients(self):
        try:
            return json.loads(self.ingredients_json or "[]")
        except Exception:
            return []

    @ingredients.setter
    def ingredients(self, value):
        self.ingredients_json = json.dumps(value)

    @property
    def tags(self):
        try:
            return json.loads(self.tags_json or "[]")
        except Exception:
            return []

    @tags.setter
    def tags(self, value):
        self.tags_json = json.dumps(value)


class DinerPreference(Base):
    __tablename__ = "diner_preferences"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)  # "Kids", "Mom", "Dad", "Family"
    is_kid = Column(Boolean, default=False)
    
    # Store liked/disliked ingredients as JSON-encoded strings
    liked_foods_json = Column(Text, default="[]")
    disliked_foods_json = Column(Text, default="[]")
    notes = Column(Text, nullable=True)

    @property
    def liked_foods(self):
        try:
            return json.loads(self.liked_foods_json or "[]")
        except Exception:
            return []

    @liked_foods.setter
    def liked_foods(self, value):
        self.liked_foods_json = json.dumps(value)

    @property
    def disliked_foods(self):
        try:
            return json.loads(self.disliked_foods_json or "[]")
        except Exception:
            return []

    @disliked_foods.setter
    def disliked_foods(self, value):
        self.disliked_foods_json = json.dumps(value)


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True, nullable=False)  # Format: YYYY-MM-DD
    meal_type = Column(String, default="dinner")  # breakfast, lunch, dinner, snack
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)

    recipe = relationship("Recipe", back_populates="meal_plans")


class GroceryItem(Base):
    __tablename__ = "grocery_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    amount = Column(String, nullable=True)  # Store as string for flexibility (e.g. "1.5" or "1 can")
    unit = Column(String, nullable=True)    # e.g., "lbs", "cans", "tbsp"
    checked = Column(Boolean, default=False)
    is_custom = Column(Boolean, default=False)  # True if added manually by user, False if auto-generated
    date_added = Column(String, nullable=True)  # To manage list state
