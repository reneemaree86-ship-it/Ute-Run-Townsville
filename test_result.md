#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

backend:
  - task: "Stripe Connect Express driver payouts"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Endpoints /api/driver/connect/onboarding-link (creates AU Express acct + AccountLink) and /api/driver/connect/status. Verified via curl: real connect.stripe.com URL returned, status transitions connected:false->true."

  - task: "Resend transactional email (welcome/receipt/payout)"
    implemented: true
    working: true
    file: "backend/emailer.py, backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "emailer.py gated on RESEND_API_KEY. Hooks: signup->welcome, payments/verify(job)->customer receipt, jobs/{id}/status completed->driver payout note. Sent via BackgroundTasks. Verified live Resend send returns message id (domain ute-runtownsville.online verified). Need to confirm job lifecycle endpoints still return 200 with bg email tasks."

frontend:
  - task: "Google Maps live tracking (LiveMap native/web)"
    implemented: true
    working: "NA"
    file: "frontend/src/components/LiveMap.native.tsx, LiveMap.web.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "react-native-maps Google provider on native; web falls back to MockMap. CANNOT be validated in Expo Go web preview - requires native build. Web bundle compiles cleanly."

  - task: "Driver Stripe Connect payout UI (Earnings tab)"
    implemented: true
    working: true
    file: "frontend/app/(tabs)/earnings.tsx, app/connect-return.tsx, src/utils/connect.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Connect-aware payout card (not connected/finish setup/enabled). Smoke-tested via screenshot: 'Finish payout setup' card renders for driver."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Stripe Connect Express driver payouts"
    - "Resend transactional email (welcome/receipt/payout)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Please backend-test: (1) Stripe Connect endpoints /api/driver/connect/onboarding-link and /api/driver/connect/status with the demo driver (demodriver@uterun.com / Password123!). (2) Full job lifecycle to ensure email BackgroundTasks don't break responses: create job (as demo@uterun.com customer), driver accept, advance status picked_up->delivered->completed (expect 200, driver payout email fires in bg). (3) payments/verify still returns valid response shape. Skip frontend. Login returns access_token (not 'token'). Maps is native-only, do NOT test maps on web."
    -agent: "main"
    -message: "THREE NEW FEATURES to test. (A) Driver verification workflow: new driver submissions now POST /driver/profile with license_photo + rego_photo (base64) and become verification_status='pending' (NOT auto-approved); they CANNOT accept jobs until approved (403 'not approved'). (B) Admin dashboard (admin@uterun.com / Admin123!, is_admin): GET /admin/stats, GET /admin/drivers/pending, POST /admin/drivers/{uid}/verify {action:'approve'|'reject'} -> sets status + sends email; non-admin gets 403. (C) Request this driver: POST /jobs with dispatch_mode='direct' + preferred_driver_id routes job only to that driver (directed_to set, status open); GET /jobs/feed marks is_direct_request=true ONLY for the targeted driver and HIDES directed jobs from other drivers; POST /jobs/{id}/decline by the targeted driver releases it (directed_to=null, becomes open to all); a non-targeted driver accepting a directed job must 403. Main agent already E2E-verified direct-request happy path + decline, and admin stats/pending. Login returns access_token. Use User-Agent 'Mozilla/5.0' on python/WS clients to avoid WAF 403. To test verification you may need to create a pending driver — note signup requires Twilio OTP, so consider directly testing the admin verify endpoint against any pending driver you can create, or report if blocked. Also regression-check Stripe Connect, ratings/reviews, and WS tracking still work. Test frontend driver flows lightly (admin tab visible only for admin; Request button on driver profile; pending banner)."