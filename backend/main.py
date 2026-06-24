import os
import json
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

import database
import models

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Initialize FastAPI App
app = FastAPI(title="Family Meal Planner API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development / home server access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
models.Base.metadata.create_all(bind=database.engine)

# Pydantic Schemas
class IngredientItem(BaseModel):
    name: str
    amount: Optional[str] = ""
    unit: Optional[str] = ""
    notes: Optional[str] = ""

class RecipeBase(BaseModel):
    title: str
    description: Optional[str] = ""
    prep_time: int = 0
    cook_time: int = 0
    servings: int = 4
    instructions: Optional[str] = ""
    ingredients: List[IngredientItem] = []
    tags: List[str] = []

class RecipeCreate(RecipeBase):
    pass

class RecipeResponse(RecipeBase):
    id: int

    class Config:
        from_attributes = True

class DinerPreferenceBase(BaseModel):
    name: str
    is_kid: bool = False
    liked_foods: List[str] = []
    disliked_foods: List[str] = []
    notes: Optional[str] = ""

class DinerPreferenceCreate(DinerPreferenceBase):
    pass

class DinerPreferenceResponse(DinerPreferenceBase):
    id: int

    class Config:
        from_attributes = True

class MealPlanCreate(BaseModel):
    date: str  # YYYY-MM-DD
    recipe_id: int
    meal_type: str = "dinner"

class MealPlanResponse(BaseModel):
    id: int
    date: str
    meal_type: str
    recipe_id: int
    recipe: RecipeResponse

    class Config:
        from_attributes = True

class GroceryItemBase(BaseModel):
    name: str
    amount: Optional[str] = ""
    unit: Optional[str] = ""
    checked: bool = False
    is_custom: bool = False

class GroceryItemCreate(GroceryItemBase):
    pass

class GroceryItemResponse(GroceryItemBase):
    id: int

    class Config:
        from_attributes = True

# Helper function to initialize default preferences if database is empty
def init_default_preferences(db: Session):
    if db.query(models.DinerPreference).count() == 0:
        kids = models.DinerPreference(
            name="Kids (2 & 4)",
            is_kid=True,
            notes="Very picky. Try to include 1 protein, 1 fruit, and 1 veg. Loves: chicken nuggets, mac & cheese, apples, carrots."
        )
        kids.liked_foods = ["Chicken Nuggets", "Mac & Cheese", "Apples", "Carrots", "Bananas", "Strawberries", "Grapes", "Broccoli (only with cheese)"]
        kids.disliked_foods = ["Onions", "Spicy foods", "Mushrooms", "Sauces with visible chunks", "Tomatoes"]

        adults = models.DinerPreference(
            name="Mom & Dad",
            is_kid=False,
            notes="Enjoy variety, healthy bowls, salads, and mildly spicy meals. Prefer low-effort prep on weekdays."
        )
        adults.liked_foods = ["Salmon", "Sweet Potatoes", "Tacos", "Salads", "Garlic", "Avocado", "Quinoa", "Curry"]
        adults.disliked_foods = []

        db.add(kids)
        db.add(adults)
        db.commit()

# --- ROUTES ---

@app.on_event("startup")
def on_startup():
    db = next(database.get_db())
    init_default_preferences(db)

# RECIPES
@app.get("/api/recipes", response_model=List[RecipeResponse])
def get_recipes(db: Session = Depends(database.get_db)):
    recipes = db.query(models.Recipe).all()
    # Build response with parsed JSON fields
    res = []
    for r in recipes:
        res.append(RecipeResponse(
            id=r.id,
            title=r.title,
            description=r.description,
            prep_time=r.prep_time,
            cook_time=r.cook_time,
            servings=r.servings,
            instructions=r.instructions,
            ingredients=[IngredientItem(**i) for i in r.ingredients],
            tags=r.tags
        ))
    return res

@app.get("/api/recipes/{recipe_id}", response_model=RecipeResponse)
def get_recipe(recipe_id: int, db: Session = Depends(database.get_db)):
    r = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return RecipeResponse(
        id=r.id,
        title=r.title,
        description=r.description,
        prep_time=r.prep_time,
        cook_time=r.cook_time,
        servings=r.servings,
        instructions=r.instructions,
        ingredients=[IngredientItem(**i) for i in r.ingredients],
        tags=r.tags
    )

@app.post("/api/recipes", response_model=RecipeResponse)
def create_recipe(recipe: RecipeCreate, db: Session = Depends(database.get_db)):
    db_recipe = models.Recipe(
        title=recipe.title,
        description=recipe.description,
        prep_time=recipe.prep_time,
        cook_time=recipe.cook_time,
        servings=recipe.servings,
        instructions=recipe.instructions
    )
    # Convert lists to JSON string using properties
    db_recipe.ingredients = [i.dict() for i in recipe.ingredients]
    db_recipe.tags = recipe.tags
    
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    
    return RecipeResponse(
        id=db_recipe.id,
        title=db_recipe.title,
        description=db_recipe.description,
        prep_time=db_recipe.prep_time,
        cook_time=db_recipe.cook_time,
        servings=db_recipe.servings,
        instructions=db_recipe.instructions,
        ingredients=[IngredientItem(**i) for i in db_recipe.ingredients],
        tags=db_recipe.tags
    )

@app.put("/api/recipes/{recipe_id}", response_model=RecipeResponse)
def update_recipe(recipe_id: int, recipe: RecipeCreate, db: Session = Depends(database.get_db)):
    db_recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not db_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    db_recipe.title = recipe.title
    db_recipe.description = recipe.description
    db_recipe.prep_time = recipe.prep_time
    db_recipe.cook_time = recipe.cook_time
    db_recipe.servings = recipe.servings
    db_recipe.instructions = recipe.instructions
    db_recipe.ingredients = [i.dict() for i in recipe.ingredients]
    db_recipe.tags = recipe.tags

    db.commit()
    db.refresh(db_recipe)
    
    return RecipeResponse(
        id=db_recipe.id,
        title=db_recipe.title,
        description=db_recipe.description,
        prep_time=db_recipe.prep_time,
        cook_time=db_recipe.cook_time,
        servings=db_recipe.servings,
        instructions=db_recipe.instructions,
        ingredients=[IngredientItem(**i) for i in db_recipe.ingredients],
        tags=db_recipe.tags
    )

@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(recipe_id: int, db: Session = Depends(database.get_db)):
    db_recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not db_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(db_recipe)
    db.commit()
    return {"message": "Recipe deleted successfully"}


# MEAL PLANS
@app.get("/api/meal-plans", response_model=List[MealPlanResponse])
def get_meal_plans(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.MealPlan)
    if start_date:
        query = query.filter(models.MealPlan.date >= start_date)
    if end_date:
        query = query.filter(models.MealPlan.date <= end_date)
    
    plans = query.order_by(models.MealPlan.date).all()
    
    res = []
    for p in plans:
        r = p.recipe
        recipe_resp = RecipeResponse(
            id=r.id,
            title=r.title,
            description=r.description,
            prep_time=r.prep_time,
            cook_time=r.cook_time,
            servings=r.servings,
            instructions=r.instructions,
            ingredients=[IngredientItem(**i) for i in r.ingredients],
            tags=r.tags
        )
        res.append(MealPlanResponse(
            id=p.id,
            date=p.date,
            meal_type=p.meal_type,
            recipe_id=p.recipe_id,
            recipe=recipe_resp
        ))
    return res

@app.post("/api/meal-plans", response_model=MealPlanResponse)
def create_meal_plan(plan: MealPlanCreate, db: Session = Depends(database.get_db)):
    # Check if recipe exists
    r = db.query(models.Recipe).filter(models.Recipe.id == plan.recipe_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recipe not found")
        
    db_plan = models.MealPlan(
        date=plan.date,
        recipe_id=plan.recipe_id,
        meal_type=plan.meal_type
    )
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    
    recipe_resp = RecipeResponse(
        id=r.id,
        title=r.title,
        description=r.description,
        prep_time=r.prep_time,
        cook_time=r.cook_time,
        servings=r.servings,
        instructions=r.instructions,
        ingredients=[IngredientItem(**i) for i in r.ingredients],
        tags=r.tags
    )
    
    return MealPlanResponse(
        id=db_plan.id,
        date=db_plan.date,
        meal_type=db_plan.meal_type,
        recipe_id=db_plan.recipe_id,
        recipe=recipe_resp
    )

@app.delete("/api/meal-plans/{plan_id}")
def delete_meal_plan(plan_id: int, db: Session = Depends(database.get_db)):
    db_plan = db.query(models.MealPlan).filter(models.MealPlan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    db.delete(db_plan)
    db.commit()
    return {"message": "Meal plan entry deleted"}


# DINER PREFERENCES
@app.get("/api/preferences", response_model=List[DinerPreferenceResponse])
def get_preferences(db: Session = Depends(database.get_db)):
    prefs = db.query(models.DinerPreference).all()
    return [DinerPreferenceResponse(
        id=p.id,
        name=p.name,
        is_kid=p.is_kid,
        liked_foods=p.liked_foods,
        disliked_foods=p.disliked_foods,
        notes=p.notes
    ) for p in prefs]

@app.put("/api/preferences/{pref_id}", response_model=DinerPreferenceResponse)
def update_preference(pref_id: int, pref: DinerPreferenceCreate, db: Session = Depends(database.get_db)):
    db_pref = db.query(models.DinerPreference).filter(models.DinerPreference.id == pref_id).first()
    if not db_pref:
        raise HTTPException(status_code=404, detail="Preference profile not found")
    
    db_pref.name = pref.name
    db_pref.is_kid = pref.is_kid
    db_pref.liked_foods = pref.liked_foods
    db_pref.disliked_foods = pref.disliked_foods
    db_pref.notes = pref.notes
    
    db.commit()
    db.refresh(db_pref)
    return DinerPreferenceResponse(
        id=db_pref.id,
        name=db_pref.name,
        is_kid=db_pref.is_kid,
        liked_foods=db_pref.liked_foods,
        disliked_foods=db_pref.disliked_foods,
        notes=db_pref.notes
    )


# GROCERY LIST
@app.get("/api/grocery", response_model=List[GroceryItemResponse])
def get_grocery_items(db: Session = Depends(database.get_db)):
    items = db.query(models.GroceryItem).all()
    return items

@app.post("/api/grocery", response_model=GroceryItemResponse)
def create_grocery_item(item: GroceryItemCreate, db: Session = Depends(database.get_db)):
    db_item = models.GroceryItem(
        name=item.name,
        amount=item.amount,
        unit=item.unit,
        checked=item.checked,
        is_custom=True
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.put("/api/grocery/{item_id}", response_model=GroceryItemResponse)
def update_grocery_item(item_id: int, item: GroceryItemCreate, db: Session = Depends(database.get_db)):
    db_item = db.query(models.GroceryItem).filter(models.GroceryItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Grocery item not found")
    
    db_item.name = item.name
    db_item.amount = item.amount
    db_item.unit = item.unit
    db_item.checked = item.checked
    
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/api/grocery/clear")
def clear_grocery_list(checked_only: bool = True, db: Session = Depends(database.get_db)):
    if checked_only:
        db.query(models.GroceryItem).filter(models.GroceryItem.checked == True).delete()
    else:
        db.query(models.GroceryItem).delete()
    db.commit()
    return {"message": "Grocery list cleared"}

def try_parse_float(val: str) -> Optional[float]:
    if not val:
        return None
    try:
        # Support fractions or normal decimals
        if '/' in val:
            parts = val.split('/')
            if len(parts) == 2:
                return float(parts[0]) / float(parts[1])
        return float(val)
    except ValueError:
        return None

def format_float(val: float) -> str:
    if val.is_integer():
        return str(int(val))
    return f"{val:.2f}".rstrip('0').rstrip('.')

@app.post("/api/grocery/generate", response_model=List[GroceryItemResponse])
def generate_grocery_list(
    start_date: str,
    end_date: str,
    db: Session = Depends(database.get_db)
):
    # Get all meal plans within the date range
    plans = db.query(models.MealPlan).filter(
        models.MealPlan.date >= start_date,
        models.MealPlan.date <= end_date
    ).all()

    # Keep track of existing custom items that haven't been checked yet
    # We want to carry over any user-defined custom additions!
    custom_items = db.query(models.GroceryItem).filter(
        models.GroceryItem.is_custom == True,
        models.GroceryItem.checked == False
    ).all()
    custom_saved = []
    for ci in custom_items:
        custom_saved.append({
            "name": ci.name,
            "amount": ci.amount,
            "unit": ci.unit,
            "is_custom": True,
            "checked": False
        })

    # Delete all auto-generated and existing items so we start fresh
    db.query(models.GroceryItem).delete()
    db.commit()

    # Re-insert the carried over custom items
    for cs in custom_saved:
        db_ci = models.GroceryItem(**cs)
        db.add(db_ci)
    db.commit()

    # Gather and consolidate all recipe ingredients
    ingredients_by_key = {}  # key: (normalized_name, normalized_unit) -> amount float or string list

    for plan in plans:
        recipe = plan.recipe
        for ing in recipe.ingredients:
            name = ing.get("name", "").strip().lower()
            if not name:
                continue
            
            # Simple plural normalization (very rudimentary but helpful, e.g. apples -> apple)
            if name.endswith("s") and len(name) > 3 and name[-2:] not in ["ss", "us", "is", "as"]:
                normalized_name = name[:-1]
            else:
                normalized_name = name

            unit = ing.get("unit", "").strip().lower()
            amount_str = ing.get("amount", "").strip()

            key = (normalized_name, unit)
            parsed_val = try_parse_float(amount_str)

            if key not in ingredients_by_key:
                ingredients_by_key[key] = {
                    "display_name": ing.get("name", "").strip(), # keep first seen display casing
                    "numeric_sum": 0.0,
                    "text_parts": [],
                    "has_numeric": False,
                    "unit": ing.get("unit", "").strip()
                }

            if parsed_val is not None:
                ingredients_by_key[key]["numeric_sum"] += parsed_val
                ingredients_by_key[key]["has_numeric"] = True
            elif amount_str:
                ingredients_by_key[key]["text_parts"].append(amount_str)

    # Insert consolidated items into database
    for key, data in ingredients_by_key.items():
        name = data["display_name"]
        unit = data["unit"]
        
        amounts = []
        if data["has_numeric"]:
            amounts.append(format_float(data["numeric_sum"]))
        if data["text_parts"]:
            amounts.append(" + ".join(data["text_parts"]))
        
        final_amount = " and ".join(amounts) if amounts else ""

        db_item = models.GroceryItem(
            name=name,
            amount=final_amount,
            unit=unit,
            checked=False,
            is_custom=False
        )
        db.add(db_item)

    db.commit()
    
    # Return full updated list
    return db.query(models.GroceryItem).all()


# AI SCANNER WITH GEMINI
@app.post("/api/scan-recipe")
async def scan_recipe(
    file: UploadFile = File(...),
    api_key: Optional[str] = Form(None)
):
    # Determine the API Key to use
    gemini_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is missing. Please configure it in .env or provide it in the request.")

    # Read image contents
    try:
        contents = await file.read()
    except Exception as e:
        logger.error(f"Error reading uploaded file: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to read the uploaded image.")

    # Call Gemini model
    try:
        import google.generativeai as genai
        # Configure Gemini
        genai.configure(api_key=gemini_key)
        
        # Use gemini-1.5-flash as it is fast, affordable and supports multimodal inputs + structured outputs
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        prompt = """
        Analyze this image of a recipe (from a cookbook, written card, or screen) and convert it into a structured JSON object.
        Return a valid JSON object matching this schema EXACTLY.
        Do not include any Markdown wrap like ```json or ```. Return the raw JSON block.
        
        Schema:
        {
          "title": "Recipe Name (string)",
          "description": "A very brief, kid-friendly / family-oriented summary of the recipe (string)",
          "prep_time": 15, // estimated preparation time in minutes, integer only
          "cook_time": 30, // estimated cooking time in minutes, integer only
          "servings": 4, // integer only, estimate if not mentioned (default 4)
          "ingredients": [
            {
              "name": "ingredient name (string)",
              "amount": "quantity like 1.5 or 1/2 or 2 (string)",
              "unit": "unit like lbs, cups, tbsp, tsp, can, pieces (string)",
              "notes": "extra notes like minced, diced, optional (string)"
            }
          ],
          "instructions": "Markdown formatted step-by-step cooking instructions (string)",
          "tags": ["Tag1", "Tag2"] // array of strings. Identify if this is likely "Kid-Friendly" (mild flavors, simple textures, chicken, potato, pasta), "Healthy", "Adult-Friendly", "Quick", etc.
        }
        """
        
        # Gemini expects image bytes wrapped in mime dict
        image_part = {
            "mime_type": file.content_type,
            "data": contents
        }
        
        response = model.generate_content([image_part, prompt])
        
        # Try to parse response text
        text_response = response.text.strip()
        # Strip any accidental markdown formatting
        if text_response.startswith("```json"):
            text_response = text_response.replace("```json", "", 1)
        if text_response.startswith("```"):
            text_response = text_response.replace("```", "", 1)
        if text_response.endswith("```"):
            text_response = text_response[:-3]
        text_response = text_response.strip()
        
        # Parse the JSON
        parsed_recipe = json.loads(text_response)
        
        # Validate that required fields are present and safe
        required_fields = ["title", "description", "prep_time", "cook_time", "servings", "ingredients", "instructions", "tags"]
        for f in required_fields:
            if f not in parsed_recipe:
                if f in ["prep_time", "cook_time", "servings"]:
                    parsed_recipe[f] = 0
                elif f == "ingredients":
                    parsed_recipe[f] = []
                elif f == "tags":
                    parsed_recipe[f] = []
                else:
                    parsed_recipe[f] = ""

        return parsed_recipe

    except ImportError:
        logger.error("google-generativeai module is not installed")
        raise HTTPException(status_code=500, detail="Google Generative AI library is not installed on the server backend.")
    except Exception as e:
        logger.error(f"Error during Gemini processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to scan recipe using Gemini: {str(e)}")

# Mount static files for React frontend if built
from fastapi.staticfiles import StaticFiles
if os.path.exists("./static"):
    app.mount("/", StaticFiles(directory="./static", html=True), name="static")

