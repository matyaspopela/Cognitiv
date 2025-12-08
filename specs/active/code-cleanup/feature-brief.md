# code-cleanup Feature Brief

## 🎯 Context (2min)
**Problem**: The codebase has accumulated unused code, outdated documentation, and build artifacts that create confusion and technical debt. Multiple files reference Flask backend and server.py, but the project uses Django. Static HTML views exist but aren't registered in URL routing. Analysis scripts are referenced in documentation but don't exist. Build artifacts may not be properly ignored.

**Users**: 
- Developers working on the project
- New team members onboarding
- Future maintainers

**Success**: 
- Clean codebase with only actively used code and files
- Documentation accurately reflects current architecture (Django, React)
- No unused imports, dead code, or commented-out blocks
- Build artifacts properly ignored
- Reduced confusion and faster development

## 🔍 Quick Research (15min)

### Existing Patterns

**Backend (Django)**:
- `server/api/views.py` contains unused view functions (`dashboard()`, `history()`, `connect()`, `index()`) not registered in `urls.py` → React frontend serves these routes instead
- All views are in `server/api/views.py` with MongoDB integration patterns
- URL routing uses `server/api/urls.py` and `server/cognitiv/urls.py` → Only API endpoints and React app catch-all are registered
- Django static file serving is configured but static HTML views are bypassed

**Frontend (React)**:
- React app uses Vite build system and serves all routes via catch-all in Django
- `frontend/src/` contains all active React components
- `frontend/dist/` contains build artifacts (should be in .gitignore)
- Static HTML files in `server/static/` may be legacy/unused

**Documentation**:
- `PROJECT_GUIDE.md`, `SETUP_COMPLETE.md`, `docs/QUICKSTART.md` reference Flask and `server.py` → Backend is actually Django
- Documentation references `analysis/data_quality.py`, `visualize.py`, `prepare_ml.py` → These files don't exist
- Multiple docs mention CSV storage → Backend uses MongoDB

**Build Artifacts**:
- `node_modules/` exists but not in `.gitignore`
- `__pycache__/` directories exist but are in `.gitignore`
- `frontend/dist/` exists but not explicitly in `.gitignore` (covered by general `dist/`)
- `.gitignore` contains Flask-specific entries (outdated)

**Firmware**:
- `firmware/environmental_monitor.ino` is active
- `src/main.cpp` exists but may be unused (PlatformIO vs Arduino setup conflict)
- Config files exist in both `firmware/` and `include/` directories

### Tech Decision

**Approach**: Systematic cleanup by layer with verification before deletion
- **Why**: 
  - Layer-by-layer approach ensures nothing critical is missed
  - Verification step prevents breaking active functionality
  - Documentation updates ensure accuracy going forward
- **Avoid**: 
  - Aggressive deletion without verification (risky)
  - Updating docs without code cleanup (incomplete)
  - Only removing files without cleaning code (superficial)

## ✅ Requirements (10min)

**R1: Remove Unused View Functions**
- Remove `dashboard()`, `history()`, `connect()`, `index()` views from `server/api/views.py` that aren't in URL routing
- Verify no other code references these functions
- **Acceptance**: Views removed, no references found, code still runs

**R2: Clean Outdated Documentation**
- Update all Flask references to Django in:
  - `PROJECT_GUIDE.md`
  - `SETUP_COMPLETE.md`
  - `docs/QUICKSTART.md`
  - `docs/TROUBLESHOOTING.md`
- Remove or update references to non-existent `server.py`
- Remove or update references to missing analysis scripts
- Update MongoDB references (currently mentions CSV)
- **Acceptance**: All docs reference Django correctly, no Flask mentions

**R3: Verify Static HTML Files**
- Check if `server/static/*.html` files are used or legacy
- If unused, remove them (React frontend serves these routes)
- If used, document why they're needed
- **Acceptance**: Decision made and files removed or documented

**R4: Remove Unused Imports**
- Scan Python files for unused imports
- Scan JS/JSX files for unused imports
- Remove all unused imports
- **Acceptance**: No unused imports remain, code still functions

**R5: Update .gitignore**
- Add `node_modules/` if missing
- Remove Flask-specific entries (if not needed)
- Verify all build artifacts are covered
- **Acceptance**: All build artifacts ignored, no Flask-specific entries

**R6: Clean Dead Code**
- Remove commented-out code blocks (if not documentation)
- Remove unused functions/classes
- Remove duplicate/unused config files if any
- **Acceptance**: No commented-out code blocks, no dead functions

**R7: Resolve Firmware File Conflicts**
- Determine if `src/main.cpp` is used (PlatformIO) or `firmware/environmental_monitor.ino` (Arduino)
- Remove unused firmware entry point
- Consolidate config files if duplicated
- **Acceptance**: Single clear firmware setup path

## 🏗️ Implementation (5min)

### Components

**Backend Cleanup**:
- `server/api/views.py` - Remove unused view functions
- `server/api/urls.py` - Verify all registered views are used
- `server/cognitiv/urls.py` - Verify routing configuration

**Frontend Cleanup**:
- `frontend/src/` - Remove unused imports across all files
- `frontend/dist/` - Verify in .gitignore

**Documentation Updates**:
- `PROJECT_GUIDE.md` - Update Flask→Django, server.py→Django structure, analysis scripts
- `SETUP_COMPLETE.md` - Update backend description
- `docs/QUICKSTART.md` - Update setup instructions
- `docs/TROUBLESHOOTING.md` - Update references
- `README.md` - Verify accuracy

**Configuration**:
- `.gitignore` - Add missing entries, remove outdated
- Firmware config consolidation

**File Removal**:
- Unused static HTML files (after verification)
- Unused firmware files (after verification)
- Dead code blocks

### APIs
- No API changes required (cleanup only)

### Data
- No database changes required (cleanup only)

## 📋 Next Actions (2min)

- [ ] Audit `server/api/views.py` for unused views and remove them (15min)
- [ ] Verify static HTML files usage and remove if unused (10min)
- [ ] Update `.gitignore` with `node_modules/` and remove Flask entries (5min)
- [ ] Scan and remove unused imports in Python files (20min)
- [ ] Scan and remove unused imports in JS/JSX files (15min)
- [ ] Update `PROJECT_GUIDE.md` with Django references (15min)
- [ ] Update `SETUP_COMPLETE.md` with Django references (10min)
- [ ] Update `docs/QUICKSTART.md` with Django references (10min)
- [ ] Update `docs/TROUBLESHOOTING.md` with Django references (10min)
- [ ] Resolve `src/main.cpp` vs `firmware/environmental_monitor.ino` conflict (10min)
- [ ] Remove commented-out code blocks (10min)
- [ ] Verify all changes don't break functionality (15min)

**Start Coding In**: ~2-3 hours total implementation time

---
**Total Planning Time**: ~30min | **Owner**: Development Team | **Date**: 2024-12-19

<!-- Living Document - Update as you code -->

## 🔄 Implementation Tracking

**CRITICAL**: Follow the todo-list systematically. Mark items as complete, document blockers, update progress.

### Progress
- [ ] Track completed items here
- [ ] Update daily

### Blockers
- [ ] Document any blockers

**See**: [.sdd/IMPLEMENTATION_GUIDE.md](mdc:.sdd/IMPLEMENTATION_GUIDE.md) for detailed execution rules.

## 📝 Research Findings

### Unused Backend Views Identified
1. **`index()`** (line ~240 in views.py) - Not in URLs, React serves root
2. **`dashboard()`** (line ~246 in views.py) - Not in URLs, React route exists
3. **`history()`** (line ~255 in views.py) - Not in URLs, React route exists  
4. **`connect()`** (line ~264 in views.py) - Not in URLs, React route exists

### Static HTML Files Status
- `server/static/index.html` - Referenced in unused `index()` view
- `server/static/dashboard.html` - Referenced in unused `dashboard()` view
- `server/static/history.html` - Referenced in unused `history()` view
- `server/static/connect.html` - Referenced in unused `connect()` view
- **Decision Needed**: Verify if these are fallback/legacy or completely unused

### Documentation Inconsistencies Found
- **Flask references** in 5+ files, but backend is Django
- **`server.py`** referenced but file doesn't exist (Django uses `manage.py`)
- **Analysis scripts** referenced in docs but don't exist in codebase
- **CSV storage** mentioned but backend uses MongoDB

### Build Artifacts Status
- ✅ `__pycache__/` in .gitignore
- ❌ `node_modules/` NOT in .gitignore (should be)
- ✅ `dist/` in .gitignore (covers frontend/dist/)
- ⚠️ Flask-specific entries in .gitignore (outdated)

### Import Analysis
- Python files: Multiple imports need verification
- JS/JSX files: Some imports may be unused (e.g., Chart.js plugins, annotation plugins)
- Need systematic scan before removal

### Firmware Setup
- **Arduino**: `firmware/environmental_monitor.ino` (active)
- **PlatformIO**: `src/main.cpp` exists (may be unused)
- **Config**: Files in both `firmware/` and `include/` directories
- **Decision Needed**: Determine primary build system

