import React, { useState, useEffect } from 'react';

// API helper base URL (Proxied via Vite dev server, or absolute path for production/docker setup)
const API_BASE = '';

// Helper to get dates of the current week (Monday - Sunday)
const getWeekDates = (offsetWeeks = 0) => {
  const dates = [];
  const today = new Date();
  
  // Set to current week's Monday
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(today.setDate(diff));
  
  // Apply offset weeks
  monday.setDate(monday.getDate() + offsetWeeks * 7);
  
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    dates.push(nextDay);
  }
  return dates;
};

const formatDateString = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateDisplay = (date) => {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

export default function App() {
  const [activeTab, setActiveTab] = useState('planner'); // 'planner', 'recipes', 'grocery', 'prefs'
  const [recipes, setRecipes] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [groceryItems, setGroceryItems] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  
  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Modals & form state
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [isEditRecipeMode, setIsEditRecipeMode] = useState(false);
  
  const [isAddPlanModalOpen, setIsAddPlanModalOpen] = useState(false);
  const [planTargetDate, setPlanTargetDate] = useState('');
  
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanningImage, setScanningImage] = useState(null);
  const [scanningPreview, setScanningPreview] = useState(null);
  const [scanStatus, setScanStatus] = useState(''); // 'idle', 'uploading', 'success', 'error'
  const [scanError, setScanError] = useState('');

  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importStatus, setImportStatus] = useState(''); // 'idle', 'loading', 'success', 'error'
  const [importError, setImportError] = useState('');
  
  // Custom grocery item form state
  const [newGroceryName, setNewGroceryName] = useState('');
  const [newGroceryAmount, setNewGroceryAmount] = useState('');
  const [newGroceryUnit, setNewGroceryUnit] = useState('');

  // Initial Recipe Form State
  const initialRecipeForm = {
    title: '',
    description: '',
    prep_time: 15,
    cook_time: 20,
    servings: 4,
    instructions: '',
    ingredients: [{ name: '', amount: '', unit: '', notes: '' }],
    tags: []
  };
  const [recipeForm, setRecipeForm] = useState(initialRecipeForm);
  const [newTagInput, setNewTagInput] = useState('');

  // Search & Filters for Recipes Tab
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeFilterTag, setRecipeFilterTag] = useState('');

  // Fetch all necessary data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Parallel fetches
      const [recipesRes, prefsRes, plansRes, groceryRes] = await Promise.all([
        fetch(`${API_BASE}/api/recipes`),
        fetch(`${API_BASE}/api/preferences`),
        fetch(`${API_BASE}/api/meal-plans`),
        fetch(`${API_BASE}/api/grocery`)
      ]);

      if (!recipesRes.ok || !prefsRes.ok || !plansRes.ok || !groceryRes.ok) {
        throw new Error('Failed to load some data from the server.');
      }

      const recipesData = await recipesRes.json();
      const prefsData = await prefsRes.json();
      const plansData = await plansRes.json();
      const groceryData = await groceryRes.json();

      setRecipes(recipesData);
      setPreferences(prefsData);
      setMealPlans(plansData);
      setGroceryItems(groceryData);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Server connection error. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync when week offset changes to fetch meal plans
  useEffect(() => {
    const dates = getWeekDates(weekOffset);
    const start = formatDateString(dates[0]);
    const end = formatDateString(dates[6]);
    
    fetch(`${API_BASE}/api/meal-plans?start_date=${start}&end_date=${end}`)
      .then(res => res.json())
      .then(data => setMealPlans(data))
      .catch(err => console.error('Error fetching meal plans range:', err));
  }, [weekOffset]);

  // Handle recipe CRUD
  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    if (!recipeForm.title.trim()) return;

    // Filter out blank ingredients
    const cleanIngredients = recipeForm.ingredients.filter(i => i.name.trim() !== '');

    const payload = {
      ...recipeForm,
      ingredients: cleanIngredients
    };

    try {
      let response;
      if (isEditRecipeMode && recipeForm.id) {
        response = await fetch(`${API_BASE}/api/recipes/${recipeForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${API_BASE}/api/recipes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) throw new Error('Failed to save recipe');
      
      await fetchData();
      setIsRecipeModalOpen(false);
      setRecipeForm(initialRecipeForm);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteRecipe = async (id) => {
    if (!confirm('Are you sure you want to delete this recipe? It will also be removed from any meal plans.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/recipes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete recipe');
      setSelectedRecipe(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenEditRecipe = (recipe) => {
    setRecipeForm({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description || '',
      prep_time: recipe.prep_time || 0,
      cook_time: recipe.cook_time || 0,
      servings: recipe.servings || 4,
      instructions: recipe.instructions || '',
      ingredients: recipe.ingredients.length > 0 ? recipe.ingredients : [{ name: '', amount: '', unit: '', notes: '' }],
      tags: recipe.tags || []
    });
    setIsEditRecipeMode(true);
    setIsRecipeModalOpen(true);
  };

  // Recipe scanner upload
  const handleScanChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setScanningImage(file);
      setScanningPreview(URL.createObjectURL(file));
      setScanStatus('idle');
    }
  };

  const handleRunScan = async () => {
    if (!scanningImage) return;
    setScanStatus('uploading');
    setScanError('');
    
    const formData = new FormData();
    formData.append('file', scanningImage);

    try {
      const response = await fetch(`${API_BASE}/api/scan-recipe`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errDetail = await response.json();
        throw new Error(errDetail.detail || 'Gemini scanning failed');
      }

      const scannedData = await response.json();
      
      // Map scanned data to our Recipe Form
      setRecipeForm({
        title: scannedData.title || '',
        description: scannedData.description || '',
        prep_time: scannedData.prep_time || 0,
        cook_time: scannedData.cook_time || 0,
        servings: scannedData.servings || 4,
        instructions: scannedData.instructions || '',
        ingredients: scannedData.ingredients && scannedData.ingredients.length > 0 
          ? scannedData.ingredients 
          : [{ name: '', amount: '', unit: '', notes: '' }],
        tags: scannedData.tags || []
      });

      setScanStatus('success');
      setIsScanModalOpen(false);
      setIsEditRecipeMode(false);
      setIsRecipeModalOpen(true); // Open the standard form populated with Gemini findings for the user to review
    } catch (err) {
      console.error(err);
      setScanStatus('error');
      setScanError(err.message || 'An unexpected error occurred while scanning.');
    }
  };

  const handleImportUrl = async (e) => {
    e.preventDefault();
    if (!importUrl.trim()) return;
    setImportStatus('loading');
    setImportError('');

    try {
      const response = await fetch(`${API_BASE}/api/import-recipe-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() })
      });

      if (!response.ok) {
        const errDetail = await response.json();
        throw new Error(errDetail.detail || 'URL recipe import failed');
      }

      const importedData = await response.json();

      // Map imported data to our Recipe Form
      setRecipeForm({
        title: importedData.title || '',
        description: importedData.description || '',
        prep_time: importedData.prep_time || 0,
        cook_time: importedData.cook_time || 0,
        servings: importedData.servings || 4,
        instructions: importedData.instructions || '',
        ingredients: importedData.ingredients && importedData.ingredients.length > 0 
          ? importedData.ingredients 
          : [{ name: '', amount: '', unit: '', notes: '' }],
        tags: importedData.tags || []
      });

      setImportStatus('success');
      setIsUrlModalOpen(false);
      setIsEditRecipeMode(false);
      setRecipeForm(prev => ({ ...prev, id: undefined }));
      setIsRecipeModalOpen(true); // Open standard review/save form
    } catch (err) {
      console.error(err);
      setImportStatus('error');
      setImportError(err.message || 'An unexpected error occurred while importing.');
    }
  };

  // Meal Plan CRUD
  const handleScheduleMeal = async (recipeId) => {
    if (!planTargetDate) return;
    try {
      const res = await fetch(`${API_BASE}/api/meal-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: planTargetDate,
          recipe_id: recipeId,
          meal_type: 'dinner'
        })
      });

      if (!res.ok) throw new Error('Failed to schedule meal');
      
      setIsAddPlanModalOpen(false);
      const plansRes = await fetch(`${API_BASE}/api/meal-plans`);
      const plansData = await plansRes.json();
      setMealPlans(plansData);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeletePlan = async (planId) => {
    try {
      const res = await fetch(`${API_BASE}/api/meal-plans/${planId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete meal plan');
      // Refresh current week's plans
      const dates = getWeekDates(weekOffset);
      const start = formatDateString(dates[0]);
      const end = formatDateString(dates[6]);
      const plansRes = await fetch(`${API_BASE}/api/meal-plans?start_date=${start}&end_date=${end}`);
      setMealPlans(await plansRes.json());
    } catch (err) {
      alert(err.message);
    }
  };

  // Grocery functions
  const handleGenerateGrocery = async () => {
    const dates = getWeekDates(weekOffset);
    const start = formatDateString(dates[0]);
    const end = formatDateString(dates[6]);
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/grocery/generate?start_date=${start}&end_date=${end}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to generate grocery list');
      setGroceryItems(await res.json());
      setActiveTab('grocery'); // Jump to grocery list automatically!
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGrocery = async (item) => {
    try {
      const updated = { ...item, checked: !item.checked };
      const res = await fetch(`${API_BASE}/api/grocery/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error('Failed to update grocery item');
      
      // Update state locally for speed
      setGroceryItems(groceryItems.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddCustomGrocery = async (e) => {
    e.preventDefault();
    if (!newGroceryName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/grocery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroceryName,
          amount: newGroceryAmount,
          unit: newGroceryUnit,
          checked: false
        })
      });

      if (!res.ok) throw new Error('Failed to add grocery item');
      setGroceryItems([...groceryItems, await res.json()]);
      
      setNewGroceryName('');
      setNewGroceryAmount('');
      setNewGroceryUnit('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleClearCheckedGrocery = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/grocery/clear?checked_only=true`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear checked items');
      setGroceryItems(groceryItems.filter(i => !i.checked));
    } catch (err) {
      alert(err.message);
    }
  };

  // Preference Profile Save
  const handleSavePreference = async (pref) => {
    try {
      const res = await fetch(`${API_BASE}/api/preferences/${pref.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pref)
      });
      if (!res.ok) throw new Error('Failed to save preferences');
      alert('Preferences updated successfully!');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Picky Eaters Analysis
  // Checks if a recipe contains ingredients matching disliked lists of any profiles
  const analyzeDislikes = (recipe) => {
    const flags = [];
    if (!recipe || !recipe.ingredients) return flags;

    preferences.forEach(profile => {
      const profileDislikes = profile.disliked_foods || [];
      const profileLikes = profile.liked_foods || [];
      
      const triggeredDislikes = [];
      recipe.ingredients.forEach(ing => {
        const name = ing.name.toLowerCase();
        profileDislikes.forEach(dis => {
          if (name.includes(dis.toLowerCase())) {
            triggeredDislikes.push(dis);
          }
        });
      });

      if (triggeredDislikes.length > 0) {
        flags.push({
          profileName: profile.name,
          isKid: profile.is_kid,
          dislikes: [...new Set(triggeredDislikes)]
        });
      }
    });

    return flags;
  };

  // Render bottom mobile tabs
  const renderTabBar = () => (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 pb-safe shadow-lg">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        <button 
          onClick={() => setActiveTab('planner')}
          className={`flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors ${activeTab === 'planner' ? 'text-emerald-600' : 'text-slate-500'}`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Planner
        </button>

        <button 
          onClick={() => setActiveTab('recipes')}
          className={`flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors ${activeTab === 'recipes' ? 'text-emerald-600' : 'text-slate-500'}`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Recipes
        </button>

        <button 
          onClick={() => setActiveTab('grocery')}
          className={`flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors ${activeTab === 'grocery' ? 'text-emerald-600' : 'text-slate-500'}`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Groceries
          {groceryItems.filter(i => !i.checked).length > 0 && (
            <span className="absolute transform translate-x-5 -translate-y-3 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
              {groceryItems.filter(i => !i.checked).length}
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('prefs')}
          className={`flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors ${activeTab === 'prefs' ? 'text-emerald-600' : 'text-slate-500'}`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Diners
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 max-w-lg mx-auto relative overflow-hidden shadow-2xl">
      {/* Header */}
      <header className="sticky top-0 bg-emerald-700 text-white shadow-md z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥗</span>
          <h1 className="font-bold text-lg tracking-tight">Family Meal Planner</h1>
        </div>
        {loading && (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {/* PLANNER TAB */}
        {activeTab === 'planner' && (
          <div className="space-y-4">
            {/* Week navigation control */}
            <div className="bg-white p-3 rounded-xl shadow-sm flex items-center justify-between border border-slate-100">
              <button 
                onClick={() => setWeekOffset(weekOffset - 1)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="font-semibold text-sm text-slate-700">
                {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : `Week (Offset: ${weekOffset})`}
              </span>
              <button 
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* Grocery Generator Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 rounded-xl shadow-sm text-white space-y-2">
              <h3 className="font-bold text-sm">Generate Weekend Grocery List</h3>
              <p className="text-xs text-emerald-50">Converts scheduled recipes for this week into a single consolidated shopping list!</p>
              <button 
                onClick={handleGenerateGrocery}
                className="w-full mt-1 bg-white text-emerald-800 text-xs font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-emerald-50 transition-colors"
              >
                Generate Grocery List
              </button>
            </div>

            {/* Weekly Days List */}
            <div className="space-y-3">
              {getWeekDates(weekOffset).map((date) => {
                const dateStr = formatDateString(date);
                const dayPlans = mealPlans.filter(p => p.date === dateStr);
                const isToday = formatDateString(new Date()) === dateStr;

                return (
                  <div key={dateStr} className={`bg-white rounded-xl shadow-sm border ${isToday ? 'border-emerald-500 ring-1 ring-emerald-200' : 'border-slate-100'} p-3 space-y-2`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-sm ${isToday ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {formatDateDisplay(date)}
                        {isToday && <span className="ml-2 bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">Today</span>}
                      </span>
                      <button 
                        onClick={() => {
                          setPlanTargetDate(dateStr);
                          setIsAddPlanModalOpen(true);
                        }}
                        className="text-emerald-600 font-semibold text-xs flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors"
                      >
                        <span className="text-sm font-bold">+</span> Add Meal
                      </button>
                    </div>

                    {dayPlans.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No meals scheduled</p>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {dayPlans.map(plan => {
                          const dislikeFlags = analyzeDislikes(plan.recipe);
                          return (
                            <div key={plan.id} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div onClick={() => setSelectedRecipe(plan.recipe)} className="cursor-pointer flex-1">
                                  <h4 className="font-bold text-sm text-slate-800 hover:underline">{plan.recipe.title}</h4>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                    <span>⏱️ {plan.recipe.prep_time + plan.recipe.cook_time}m</span>
                                    <span>🍳 Serves {plan.recipe.servings}</span>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => handleDeletePlan(plan.id)}
                                  className="text-slate-400 hover:text-red-500 p-1"
                                  title="Remove from schedule"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>

                              {/* Picky eater alerts on calendar! */}
                              {dislikeFlags.length > 0 && (
                                <div className="space-y-1">
                                  {dislikeFlags.map((flag, idx) => (
                                    <div key={idx} className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1.5 font-medium ${flag.isKid ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                                      <span>⚠️</span>
                                      <span><strong>{flag.profileName} dislikes:</strong> {flag.dislikes.join(', ')}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RECIPES TAB */}
        {activeTab === 'recipes' && (
          <div className="space-y-4">
            {/* Floating Action Buttons or top controls */}
            <div className="space-y-2">
              <button 
                onClick={() => {
                  setRecipeForm(initialRecipeForm);
                  setIsEditRecipeMode(false);
                  setIsRecipeModalOpen(true);
                }}
                className="w-full bg-emerald-600 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5"
              >
                <span>➕</span> Add Recipe Manually
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setScanningImage(null);
                    setScanningPreview(null);
                    setScanStatus('idle');
                    setScanError('');
                    setIsScanModalOpen(true);
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm text-sm hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>📷</span> Scan Photo
                </button>
                <button 
                  onClick={() => {
                    setImportUrl('');
                    setImportStatus('idle');
                    setImportError('');
                    setIsUrlModalOpen(true);
                  }}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm text-sm hover:from-violet-700 hover:to-fuchsia-700 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>🔗</span> Import URL
                </button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-2">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search recipes..." 
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="absolute left-2.5 top-2.5 text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </span>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                <button 
                  onClick={() => setRecipeFilterTag('')}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${recipeFilterTag === '' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  All
                </button>
                {['Kid-Friendly', 'Adult-Friendly', 'Healthy', 'Quick', 'Easy'].map(tag => (
                  <button 
                    key={tag}
                    onClick={() => setRecipeFilterTag(tag)}
                    className={`text-xs px-3 py-1 rounded-full border whitespace-nowrap transition-colors ${recipeFilterTag === tag ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipes Grid/List */}
            <div className="space-y-3">
              {recipes
                .filter(r => {
                  const matchesSearch = r.title.toLowerCase().includes(recipeSearch.toLowerCase()) || 
                                        (r.description && r.description.toLowerCase().includes(recipeSearch.toLowerCase()));
                  const matchesTag = !recipeFilterTag || r.tags.includes(recipeFilterTag);
                  return matchesSearch && matchesTag;
                })
                .map(recipe => {
                  const dislikeFlags = analyzeDislikes(recipe);
                  const isKidFriendly = recipe.tags.includes('Kid-Friendly');

                  return (
                    <div 
                      key={recipe.id} 
                      className="bg-white rounded-xl shadow-sm border border-slate-100 p-3.5 hover:border-emerald-200 transition-all cursor-pointer space-y-2.5"
                      onClick={() => setSelectedRecipe(recipe)}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-slate-800 hover:text-emerald-700 transition-colors text-sm">{recipe.title}</h3>
                          <p className="text-xs text-slate-500 line-clamp-1.5 mt-0.5">{recipe.description || 'No description provided.'}</p>
                        </div>
                        {isKidFriendly && (
                          <span className="bg-emerald-50 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-100 shrink-0">
                            👶 Picky approved
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-50 pt-2">
                        <span className="flex items-center gap-1">⏱️ {recipe.prep_time + recipe.cook_time} mins</span>
                        <span className="flex items-center gap-1">🍳 {recipe.ingredients.length} ingredients</span>
                      </div>

                      {/* Dislikes notice on browsable cards */}
                      {dislikeFlags.length > 0 && (
                        <div className="space-y-1">
                          {dislikeFlags.map((flag, idx) => (
                            <div key={idx} className={`text-[9px] px-2 py-0.5 rounded font-medium inline-block mr-2 ${flag.isKid ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                              ⚠️ {flag.profileName} rejects some ingredients
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

              {recipes.length === 0 && (
                <div className="text-center py-8 text-slate-400 italic">
                  No recipes added yet. Create one or scan using Gemini!
                </div>
              )}
            </div>
          </div>
        )}

        {/* GROCERY TAB */}
        {activeTab === 'grocery' && (
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-slate-100">
              <span className="text-xs font-semibold text-slate-600">
                Checked {groceryItems.filter(i => i.checked).length} of {groceryItems.length} items
              </span>
              <button 
                onClick={handleClearCheckedGrocery}
                className="text-xs text-red-600 hover:text-red-800 font-semibold bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                Clear Completed
              </button>
            </div>

            {/* Custom Grocery Item Entry */}
            <form onSubmit={handleAddCustomGrocery} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 space-y-2">
              <h4 className="text-xs font-bold text-slate-700">Add custom item:</h4>
              <div className="flex gap-1.5">
                <input 
                  type="text" 
                  placeholder="Apples, bread, milk..." 
                  value={newGroceryName}
                  onChange={(e) => setNewGroceryName(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
                <input 
                  type="text" 
                  placeholder="Qty" 
                  value={newGroceryAmount}
                  onChange={(e) => setNewGroceryAmount(e.target.value)}
                  className="w-12 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <input 
                  type="text" 
                  placeholder="Unit" 
                  value={newGroceryUnit}
                  onChange={(e) => setNewGroceryUnit(e.target.value)}
                  className="w-14 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button 
                  type="submit"
                  className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shrink-0"
                >
                  Add
                </button>
              </div>
            </form>

            {/* Shopping checklist */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-100">
              {groceryItems.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => handleToggleGrocery(item)}
                  className="flex items-center gap-3 p-3.5 cursor-pointer active:bg-slate-50 select-none hover:bg-slate-50 transition-colors"
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${item.checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                    {item.checked && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm ${item.checked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {item.name}
                    </span>
                    {item.amount && (
                      <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${item.checked ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'}`}>
                        {item.amount} {item.unit}
                      </span>
                    )}
                  </div>
                  {item.is_custom && (
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Custom</span>
                  )}
                </div>
              ))}

              {groceryItems.length === 0 && (
                <div className="p-8 text-center text-slate-400 italic text-sm">
                  Grocery list is empty. Go to the Planner tab and schedule some meals to generate!
                </div>
              )}
            </div>
          </div>
        )}

        {/* PREFERENCES / DINER PROFILES TAB */}
        {activeTab === 'prefs' && (
          <div className="space-y-4">
            {preferences.map(pref => {
              // Create dynamic state for forms to add tags directly
              return (
                <PreferenceProfileEditor 
                  key={pref.id} 
                  pref={pref} 
                  onSave={handleSavePreference} 
                />
              );
            })}
          </div>
        )}
      </main>

      {/* RENDER MODALS */}

      {/* RECIPE DETAILS MODAL */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-0">
          <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto flex flex-col shadow-2xl">
            {/* Header / Banner */}
            <div className="bg-emerald-800 text-white p-4 sticky top-0 flex justify-between items-start shadow-md">
              <div>
                <h2 className="text-lg font-bold leading-tight">{selectedRecipe.title}</h2>
                <div className="flex gap-3 text-xs text-emerald-100 mt-1">
                  <span>⏱️ Prep: {selectedRecipe.prep_time}m</span>
                  <span>⏱️ Cook: {selectedRecipe.cook_time}m</span>
                  <span>🍳 Serves {selectedRecipe.servings}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRecipe(null)}
                className="bg-emerald-900/50 hover:bg-emerald-900 text-white rounded-full p-1.5 shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {selectedRecipe.description && (
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedRecipe.description}
                </p>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {selectedRecipe.tags.map(t => (
                  <span key={t} className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>

              {/* Picky Eaters Flags inside modal */}
              {analyzeDislikes(selectedRecipe).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1.5 text-xs text-amber-800">
                  <h4 className="font-bold">⚠️ Picky Eating Notices:</h4>
                  {analyzeDislikes(selectedRecipe).map((flag, idx) => (
                    <p key={idx}><strong>{flag.profileName} dislikes:</strong> {flag.dislikes.join(', ')}</p>
                  ))}
                </div>
              )}

              {/* Ingredients Checklist */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
                  <span>Ingredients</span>
                  <span className="text-xs text-slate-400 font-normal">{selectedRecipe.ingredients.length} items</span>
                </h3>
                <ul className="space-y-1.5">
                  {selectedRecipe.ingredients.map((ing, i) => (
                    <li key={i} className="text-xs text-slate-700 flex items-start gap-1">
                      <span className="text-emerald-600 mt-0.5">•</span>
                      <span>
                        <strong>{ing.amount} {ing.unit}</strong> {ing.name} {ing.notes && <span className="text-slate-400 italic">({ing.notes})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cooking Instructions */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-1">Instructions</h3>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/50 p-3 rounded-xl">
                  {selectedRecipe.instructions || 'No instructions provided.'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button 
                  onClick={() => handleOpenEditRecipe(selectedRecipe)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-xl text-xs transition-colors"
                >
                  Edit Recipe
                </button>
                <button 
                  onClick={() => handleDeleteRecipe(selectedRecipe.id)}
                  className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2 rounded-xl text-xs transition-colors"
                >
                  Delete Recipe
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULER CHOOSE RECIPE MODAL */}
      {isAddPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">Schedule dinner</h3>
              <button 
                onClick={() => setIsAddPlanModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-2">
              <p className="text-xs text-slate-500 mb-2">Select a recipe to make for dinner on {planTargetDate}:</p>
              
              {recipes.map(recipe => {
                const isKidFriendly = recipe.tags.includes('Kid-Friendly');
                const dislikes = analyzeDislikes(recipe);

                return (
                  <div 
                    key={recipe.id}
                    onClick={() => handleScheduleMeal(recipe.id)}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 hover:border-emerald-500 hover:bg-emerald-50/10 cursor-pointer transition-all space-y-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-800">{recipe.title}</span>
                      {isKidFriendly && <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold">Kids 👍</span>}
                    </div>
                    {dislikes.length > 0 && (
                      <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 block">
                        ⚠️ Disliked ingredients by diners
                      </span>
                    )}
                  </div>
                );
              })}

              {recipes.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  Create recipes first in the Recipes tab!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GEMINI AI SCAN MODAL */}
      {isScanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-base text-slate-800">Scan Recipe (Gemini AI)</h3>
              <button 
                onClick={() => setIsScanModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Snap a photo of a recipe from a cookbook or screen. Gemini will automatically extract instructions, cooking times, and ingredients into a structured format!
            </p>

            {/* Custom file camera picker */}
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-slate-50 cursor-pointer relative hover:bg-slate-100/50 transition-colors">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" // Forces back camera on mobile phones!
                onChange={handleScanChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {scanningPreview ? (
                <img src={scanningPreview} alt="Recipe Preview" className="max-h-40 rounded-lg object-contain shadow-sm" />
              ) : (
                <div className="text-center space-y-1.5">
                  <span className="text-3xl">📷</span>
                  <p className="text-xs font-semibold text-slate-600">Take photo or choose image</p>
                  <p className="text-[10px] text-slate-400">Supports JPG, PNG, WEBP</p>
                </div>
              )}
            </div>

            {scanStatus === 'uploading' && (
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent mx-auto" />
                <p className="text-xs text-slate-600 font-medium">Gemini is reading the recipe... (Takes 3-5s)</p>
              </div>
            )}

            {scanStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-xl text-xs font-medium text-center">
                {scanError || 'An error occurred while scanning the recipe.'}
              </div>
            )}

            <div className="flex gap-2">
              <button 
                onClick={() => setIsScanModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl text-xs font-semibold transition-colors"
                disabled={scanStatus === 'uploading'}
              >
                Cancel
              </button>
              <button 
                onClick={handleRunScan}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:bg-slate-300"
                disabled={!scanningImage || scanStatus === 'uploading'}
              >
                Analyze Recipe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECIPE URL IMPORT MODAL */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleImportUrl}
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-4 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-base text-slate-800">Import Recipe from URL</h3>
              <button 
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste the link to any online recipe. Gemini will read the webpage and automatically extract ingredients, cooking times, and instructions!
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Recipe URL</label>
              <input 
                type="url" 
                placeholder="https://example.com/recipe-details" 
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
                disabled={importStatus === 'loading'}
              />
            </div>

            {importStatus === 'loading' && (
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent mx-auto" />
                <p className="text-xs text-slate-600 font-medium">Gemini is reading the website... (Takes 3-5s)</p>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-xl text-xs font-medium text-center">
                {importError || 'An error occurred while importing the recipe.'}
              </div>
            )}

            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl text-xs font-semibold transition-colors"
                disabled={importStatus === 'loading'}
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:bg-slate-300"
                disabled={!importUrl.trim() || importStatus === 'loading'}
              >
                Import Recipe
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE / EDIT RECIPE MODAL */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-0">
          <form 
            onSubmit={handleSaveRecipe}
            className="bg-white rounded-t-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
              <h3 className="font-bold text-base text-slate-800">
                {isEditRecipeMode ? 'Edit Recipe' : 'Add New Recipe'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsRecipeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Form Content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Recipe Title *</label>
                <input 
                  type="text" 
                  value={recipeForm.title}
                  onChange={(e) => setRecipeForm({ ...recipeForm, title: e.target.value })}
                  placeholder="e.g., Crispy Chicken Nuggets"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Short Description</label>
                <textarea 
                  value={recipeForm.description}
                  onChange={(e) => setRecipeForm({ ...recipeForm, description: e.target.value })}
                  placeholder="e.g., Delicious lightly breaded tenders loved by kids & parents."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Prep, Cook, Servings */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700">Prep (mins)</label>
                  <input 
                    type="number" 
                    value={recipeForm.prep_time}
                    onChange={(e) => setRecipeForm({ ...recipeForm, prep_time: parseInt(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-center focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700">Cook (mins)</label>
                  <input 
                    type="number" 
                    value={recipeForm.cook_time}
                    onChange={(e) => setRecipeForm({ ...recipeForm, cook_time: parseInt(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-center focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700">Servings</label>
                  <input 
                    type="number" 
                    value={recipeForm.servings}
                    onChange={(e) => setRecipeForm({ ...recipeForm, servings: parseInt(e.target.value) || 4 })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-center focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Ingredients List */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex justify-between items-center">
                  <span>Ingredients list *</span>
                  <button 
                    type="button"
                    onClick={() => setRecipeForm({
                      ...recipeForm,
                      ingredients: [...recipeForm.ingredients, { name: '', amount: '', unit: '', notes: '' }]
                    })}
                    className="text-emerald-600 hover:text-emerald-800 text-xs font-bold"
                  >
                    + Add Ingredient
                  </button>
                </label>
                
                <div className="space-y-1.5">
                  {recipeForm.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex gap-1 items-center">
                      <input 
                        type="text" 
                        placeholder="Qty (e.g. 1.5)" 
                        value={ing.amount}
                        onChange={(e) => {
                          const updated = [...recipeForm.ingredients];
                          updated[idx].amount = e.target.value;
                          setRecipeForm({ ...recipeForm, ingredients: updated });
                        }}
                        className="w-16 px-1.5 py-1 border border-slate-200 rounded text-center text-xs focus:outline-none"
                      />
                      <input 
                        type="text" 
                        placeholder="Unit (lb, cup)" 
                        value={ing.unit}
                        onChange={(e) => {
                          const updated = [...recipeForm.ingredients];
                          updated[idx].unit = e.target.value;
                          setRecipeForm({ ...recipeForm, ingredients: updated });
                        }}
                        className="w-16 px-1.5 py-1 border border-slate-200 rounded text-center text-xs focus:outline-none"
                      />
                      <input 
                        type="text" 
                        placeholder="Name (e.g. Chicken)" 
                        value={ing.name}
                        onChange={(e) => {
                          const updated = [...recipeForm.ingredients];
                          updated[idx].name = e.target.value;
                          setRecipeForm({ ...recipeForm, ingredients: updated });
                        }}
                        className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none"
                      />
                      {recipeForm.ingredients.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => {
                            const updated = recipeForm.ingredients.filter((_, i) => i !== idx);
                            setRecipeForm({ ...recipeForm, ingredients: updated });
                          }}
                          className="text-red-500 hover:text-red-700 p-1 text-sm font-bold shrink-0"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cooking instructions text block */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Instructions (one per line or steps)</label>
                <textarea 
                  value={recipeForm.instructions}
                  onChange={(e) => setRecipeForm({ ...recipeForm, instructions: e.target.value })}
                  placeholder="1. Pre-heat oven to 400F&#10;2. Cut chicken into bite-sized tenders...&#10;3. Bake for 15-20 mins"
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Tags Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Tags</label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {['Kid-Friendly', 'Adult-Friendly', 'Healthy', 'Quick', 'Easy'].map(t => {
                    const isSelected = recipeForm.tags.includes(t);
                    return (
                      <button 
                        key={t}
                        type="button"
                        onClick={() => {
                          const newTags = isSelected 
                            ? recipeForm.tags.filter(tg => tg !== t)
                            : [...recipeForm.tags, t];
                          setRecipeForm({ ...recipeForm, tags: newTags });
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${isSelected ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                      >
                        {isSelected ? '✓ ' : ''}{t}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button 
                type="button"
                onClick={() => setIsRecipeModalOpen(false)}
                className="flex-1 bg-white hover:bg-slate-100 text-slate-700 py-2.5 rounded-xl text-xs font-bold border border-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                Save Recipe
              </button>
            </div>
          </form>
        </div>
      )}

      {renderTabBar()}
    </div>
  );
}

// Inner Component to manage Preference Editor cleanly
function PreferenceProfileEditor({ pref, onSave }) {
  const [notes, setNotes] = useState(pref.notes || '');
  const [likedList, setLikedList] = useState(pref.liked_foods || []);
  const [dislikedList, setDislikedList] = useState(pref.disliked_foods || []);
  
  const [newLike, setNewLike] = useState('');
  const [newDislike, setNewDislike] = useState('');

  const handleAddLike = () => {
    if (!newLike.trim()) return;
    if (!likedList.includes(newLike.trim())) {
      setLikedList([...likedList, newLike.trim()]);
    }
    setNewLike('');
  };

  const handleAddDislike = () => {
    if (!newDislike.trim()) return;
    if (!dislikedList.includes(newDislike.trim())) {
      setDislikedList([...dislikedList, newDislike.trim()]);
    }
    setNewDislike('');
  };

  const handleRemoveLike = (food) => {
    setLikedList(likedList.filter(f => f !== food));
  };

  const handleRemoveDislike = (food) => {
    setDislikedList(dislikedList.filter(f => f !== food));
  };

  const handleSave = () => {
    onSave({
      ...pref,
      notes,
      liked_foods: likedList,
      disliked_foods: dislikedList
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
        <span className="text-xl">{pref.is_kid ? '👶' : '👩‍❤️‍👨'}</span>
        <h3 className="font-bold text-slate-800 text-sm">{pref.name}</h3>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notes & Guidelines</label>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter special eating notes..."
          rows={2}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Liked list */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <span>💚 Likes / Loves</span>
          </label>
          <div className="flex gap-1">
            <input 
              type="text" 
              placeholder="Add loved food" 
              value={newLike}
              onChange={(e) => setNewLike(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddLike()}
              className="flex-1 min-w-0 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
            />
            <button 
              onClick={handleAddLike}
              className="bg-emerald-50 text-emerald-800 px-2.5 rounded-lg text-xs font-bold border border-emerald-100 shrink-0"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {likedList.map(food => (
              <span key={food} className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium border border-emerald-100">
                {food}
                <button onClick={() => handleRemoveLike(food)} className="text-[9px] text-emerald-500 hover:text-emerald-900 font-bold">✕</button>
              </span>
            ))}
          </div>
        </div>

        {/* Disliked list */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
            <span>❌ Rejects / Dislikes</span>
          </label>
          <div className="flex gap-1">
            <input 
              type="text" 
              placeholder="Add disliked food" 
              value={newDislike}
              onChange={(e) => setNewDislike(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDislike()}
              className="flex-1 min-w-0 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
            />
            <button 
              onClick={handleAddDislike}
              className="bg-red-50 text-red-800 px-2.5 rounded-lg text-xs font-bold border border-red-100 shrink-0"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {dislikedList.map(food => (
              <span key={food} className="bg-red-50 text-red-800 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium border border-red-100">
                {food}
                <button onClick={() => handleRemoveDislike(food)} className="text-[9px] text-red-500 hover:text-red-900 font-bold">✕</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <button 
        onClick={handleSave}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-xl text-xs font-bold shadow-sm transition-colors mt-2"
      >
        Save diner preferences
      </button>
    </div>
  );
}
