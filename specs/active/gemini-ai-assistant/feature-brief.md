# gemini-ai-assistant Feature Brief

## 🎯 Context (2min)
**Problem**: Users of the IoT environmental monitoring system need help understanding how to use the app, analyzing their sensor data, and getting actionable insights. Currently, users must manually interpret charts and statistics without contextual guidance.

**Users**: 
- Homeowners monitoring indoor air quality
- Office managers tracking workspace conditions
- Researchers analyzing environmental patterns
- First-time users learning the system

**Success**: Users can interact with an AI assistant that provides:
1. Contextual guidance on app features and usage
2. Intelligent analysis of data within specified timeframes
3. Natural language answers about their sensor data
4. Proactive health recommendations and insights

## 🔍 Quick Research (15min)
### Existing Patterns
- **Django API Structure** (`server/api/views.py`) → RESTful endpoints with JSON responses, MongoDB integration, error handling patterns | Reuse: API endpoint structure, error response format
- **React Frontend API Service** (`frontend/src/services/api.js`) → Axios-based API client with interceptors, organized API modules | Reuse: API client pattern, service organization
- **React Component Patterns** (`frontend/src/pages/Dashboard.jsx`) → useState/useEffect hooks, Chart.js integration, Card/Button UI components | Reuse: Component structure, state management patterns
- **Data Access Patterns** (`server/api/views.py`) → MongoDB queries with time filtering, aggregation pipelines, data normalization | Reuse: Data retrieval patterns, time range handling
- **Environment Variables** (`server/api/views.py`) → `os.getenv()` for MONGO_URI, MONGO_DB_NAME | Reuse: Environment variable pattern for GEMINI_API_KEY

### Tech Decision
**Approach**: Google Gemini API integration via Python SDK
- **Why**: 
  - Natural language understanding for user queries
  - Context-aware responses about IoT data
  - Built-in data analysis capabilities
  - Cost-effective API pricing
  - Easy integration with existing Django backend
- **Avoid**: 
  - Building custom NLP from scratch (too complex)
  - OpenAI GPT (more expensive, Gemini sufficient)
  - Client-side only AI (needs backend for API key security)

## ✅ Requirements (10min)

### Core Features

**R1: App Usage Guidance**
- User can ask questions about dashboard features, navigation, data interpretation
- AI provides step-by-step instructions for common tasks
- Answers reference actual UI elements and features
- **Acceptance**: User asks "How do I view historical data?" and receives clear instructions

**R2: Timeframe Data Analysis**
- User can specify date ranges (e.g., "last week", "January 2024")
- AI analyzes data for that timeframe using existing API endpoints
- Provides summary statistics, trends, and insights
- **Acceptance**: User asks "What was the average CO2 last week?" and AI fetches data and calculates/explains

**R3: Data Q&A**
- User can ask questions about trends, anomalies, correlations
- AI uses actual sensor data to answer questions
- Explains patterns and provides context
- **Acceptance**: User asks "Why did CO2 spike yesterday?" and AI analyzes data to identify cause

**R4: Additional Functionalities**
- **Health Recommendations**: Suggests actions based on CO2/temp/humidity levels
- **Anomaly Detection**: Identifies unusual patterns and alerts user
- **Predictive Insights**: Analyzes trends to predict future conditions
- **Multi-device Comparison**: Compares data across different devices/locations
- **Acceptance**: AI proactively suggests "CO2 is high, consider ventilation" when threshold exceeded

## 🏗️ Implementation (5min)

### Components

**Backend (Django)**:
- `server/api/ai_service.py` - Gemini API integration service
- `server/api/views.py` - New endpoint `/api/ai/chat` (POST)
- `server/requirements.txt` - Add `google-generativeai` package
- Environment variable: `GEMINI_API_KEY` (set in deployment)

**Frontend (React)**:
- `frontend/src/components/ai/AIAssistant.jsx` - Main chat component
- `frontend/src/components/ai/AIAssistant.css` - Chat UI styling
- `frontend/src/services/api.js` - Add `aiAPI.chat()` method
- Integration in Dashboard or as floating button

**Data Integration**:
- AI service calls existing endpoints: `/api/data`, `/api/history/summary`, `/api/history/series`
- Context passed to Gemini: recent data, statistics, time ranges
- Response includes actionable insights and recommendations

### APIs

**New Endpoint**:
- `POST /api/ai/chat` - Accepts user message, returns AI response
  - Request: `{ "message": "What was the average temperature last week?", "timeRange": {...} }`
  - Response: `{ "status": "success", "response": "...", "dataUsed": {...} }`

**Existing Endpoints Used**:
- `GET /api/data` - For current/recent data context
- `GET /api/history/summary` - For statistical analysis
- `GET /api/history/series` - For trend analysis

### Data Changes
- No database schema changes required
- May add optional `ai_conversations` collection for chat history (future enhancement)
- API key stored in environment variable (not in code)

## 📋 Next Actions (2min)
- [ ] Install Google Generative AI Python SDK: `pip install google-generativeai` (5min)
- [ ] Create `server/api/ai_service.py` with Gemini client initialization (15min)
- [ ] Add `POST /api/ai/chat` endpoint in `server/api/views.py` (20min)
- [ ] Create React `AIAssistant.jsx` component with chat UI (30min)
- [ ] Add `aiAPI.chat()` method to `frontend/src/services/api.js` (10min)
- [ ] Integrate AI assistant into Dashboard page (15min)
- [ ] Set `GEMINI_API_KEY` environment variable in deployment (5min)
- [ ] Test with sample queries for each requirement (20min)

**Start Coding In**: ~2 hours total implementation time

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

## 📝 Implementation Notes

### Gemini API Key Configuration
- **API Key**: `AIzaSyAcLgI63y1xBKlyJnDiC-hGphKs9Fb6TUs`
- **Storage**: Set as environment variable `GEMINI_API_KEY` in deployment
- **Security**: Never commit API key to repository
- **Local Development**: Add to `.env` file (not tracked in git)

### Gemini Model Selection
- **Recommended**: `gemini-pro` (general purpose) or `gemini-pro-vision` (if adding image analysis later)
- **Alternative**: `gemini-1.5-flash` (faster, lower cost) for simple queries
- Start with `gemini-pro`, optimize based on usage patterns

### Context Management Strategy
- **Data Context**: Fetch relevant data based on user query intent
- **Time Range**: Extract from user message or use defaults (last 24h)
- **Token Limits**: Keep context under 30k tokens (Gemini Pro limit)
- **Caching**: Cache common queries to reduce API calls

### Error Handling
- Handle API rate limits gracefully
- Provide fallback responses if Gemini API unavailable
- Log errors for debugging without exposing API key
- User-friendly error messages

### Cost Considerations
- Monitor API usage (Gemini Pro: ~$0.0005 per 1K characters)
- Implement rate limiting per user if needed
- Cache frequent queries
- Consider `gemini-1.5-flash` for lower cost if performance acceptable
















