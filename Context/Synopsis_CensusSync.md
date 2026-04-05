  
**CensusSync**

*Secure Offline-First Census Data Collection and Analytics System*

**Synopsis**

Minor Project Report

**Submitted By:**

Manas Chandra

Aditya Jain

**TABLE OF CONTENTS**

1\. Introduction	3

2\. Project Rationale	4

3\. Objectives and Scope	5

4\. Methodology	6

5\. Technology Stack	7

6\. Testing Strategy                                                                                                     	8

7\. Limitations and Future Scope                                                                                	9

8\. Team Work Distribution                                                                                       	10

9\. Conclusion                                                                                                            	11

**1\. INTRODUCTION**

Census operations in India still rely on paper forms and manual data entry. An enumerator goes door to door, fills out forms for each household, and returns them to a central office days or weeks later. By the time the data reaches someone who can act on it, it is already outdated. That delay is why census-based policy decisions often miss the people they are meant to help. A delayed count is not just an administrative problem. It means resource allocation decisions, infrastructure planning, and welfare targeting all run on stale numbers.

The problem gets worse in areas with no internet. Even where digital tools exist, they assume a live connection. A field worker in a remote area cannot upload data in real time, so they either carry paper or they wait. Both create gaps. Paper gets lost or misread. Waiting means delays that compound across hundreds of enumerators working in parallel. We noticed there was no lightweight, student-buildable tool that solved this specific combination of problems: offline-first collection plus role management plus real-time reporting, all in one place.

CensusSync is what we built to address this. It is a web-based census data collection system that works fully offline. Enumerators fill household forms on any device, data saves locally using IndexedDB, and when connectivity returns, it syncs automatically to a central Firestore database. Supervisors can view live dashboards, validate entries, view geo-tagged submissions on a map, and export reports without waiting for paper to travel.

We want to be clear about what this is. We built a working prototype covering the core workflow: form collection, offline storage, auto-sync, data validation, role-based access, and basic analytics with a policy insight layer. We used tools we could realistically learn in our project timeline. We also used AI-assisted tools like GitHub Copilot and Claude AI to help with parts we were less confident about, particularly the IndexedDB sync logic and the Cloud Functions setup.

**2\. PROJECT RATIONALE**

The idea came from a news article one of us read about delays in India's post-COVID census. It mentioned that field data collection was still heavily paper-based and that digitization had stalled because existing tools required stable internet. That felt like a solvable problem at a proof-of-concept level. We also both live in cities where municipal surveys happen periodically, and watching enumerators carry paper registers in 2025 made the problem feel concrete rather than academic.

We looked at existing tools before starting. Most digital form tools like KoBoToolbox and ODK are designed for NGOs and require technical setup to deploy. They also separate the features we needed into different products. No single lightweight tool covered offline sync, enumerator login, geo-tagging, and analytics together for a census-specific context. That gap is what we wanted to fill.

What we added that existing tools separate: a single system where an enumerator logs in, fills a form offline, and that data flows directly into a dashboard a supervisor can act on. The geo-tagging feature shows where data was collected, useful for verifying coverage and catching cases where enumerators may have skipped a block. The policy insight generator highlights demographic patterns that a decision-maker might miss when looking at raw numbers alone.

Both of us wanted hands-on experience with offline-first application design. We had read about the pattern but never built it. We also wanted something with a real-world use case, not just another CRUD app. The sync logic was harder than expected, but we both learned a lot from getting it working. That hands-on experience with browser storage APIs and real-time database listeners is something we could not have gotten from a tutorial.

**3\. OBJECTIVES AND SCOPE**

**Core Objectives**

* Build an offline-capable census form. The form works on any browser without internet, stores data in IndexedDB, and syncs automatically to Firestore once connectivity returns. We tested this by turning off Wi-Fi mid-session and confirming data saved locally and uploaded correctly when reconnected.

* Set up role-based login. Enumerators see only their assigned forms. Supervisors see all submissions in their district. Admin users access the full dataset and export features. Roles are assigned as custom claims in Firebase Auth tokens.

* Create a data validation layer. Before any record enters the main database, server-side Cloud Functions check for required fields, valid age ranges, and duplicate household IDs. This catches dirty data at the source rather than during analysis.

* Add optional geo-tagging. If the device has GPS and the enumerator permits location sharing, each submission records latitude and longitude. This creates a map layer supervisors can use to verify geographic coverage.

* Build a real-time analytics dashboard. Supervisors and admins see live submission counts, breakdowns by age group and household size, and a map view. The dashboard updates as new synced data arrives.

* Generate exportable reports in PDF and CSV. Any filtered dashboard dataset can be exported. CSV is for further analysis, PDF is for official submission or archiving.

* Include a basic audit log. Every sync event, login, and export is recorded with a timestamp and user ID. It is a lightweight accountability trail, not a full audit system, but enough for a district-level deployment.

**Scope of the System**

CensusSync covers the full data collection and reporting cycle for a district-level census. This includes enumerator form submission, offline capture, sync, validation, dashboard monitoring, and export. Two user types: enumerators who collect data and supervisors who monitor it.

The form is fixed to a standard household census template. We did not build a form builder in this version. The system is not built for national-scale concurrency and does not handle biometric verification, Aadhaar integration, or streaming analytics. The policy insight generator is rule-based, not machine learning: it applies predefined thresholds to flag patterns and surfaces them for human review.

**4\. METHODOLOGY**

We used an Agile approach with two-week sprints and a shared Notion board to track progress. We also used AI tools, specifically Claude AI for writing help and GitHub Copilot for code suggestions, especially for IndexedDB sync logic where the documentation is dense.

**Phase 1: Requirement Gathering**

We found a district-level census manual published by the Office of the Registrar General, India, and read through the enumeration process. We also reviewed KoBoToolbox and ODK feature sets to understand what tools in this space typically prioritize. From there, we listed 10 features and ranked them by importance, with offline sync and role-based login at the top.

**Phase 2: System Design**

We mapped the database structure on paper first. Main collections: Users, Forms, Submissions, SyncLogs, and AuditTrails. We planned offline storage to mirror the cloud structure to avoid data transformation at sync time. Manas sketched UI wireframes in Figma for the enumerator app and supervisor dashboard. We revised the dashboard layout twice before settling on a version that kept submission counts and the map view front and center.

**Phase 3: Development**

We built the enumerator form first. Offline storage via IndexedDB came next and was the hardest part. Handling duplicate submissions during spotty connectivity took about a week of debugging. We eventually used a hash of the household ID and submission timestamp as a deduplication key. After sync was stable, we built login, dashboard, export, audit log, and the policy insight layer in that order.

**Phase 4: Testing and Deployment**

We deployed on Firebase Hosting and tested on that live URL. GitHub feature branches with pull requests kept our work from clashing. Final integration test: five enumerator accounts, 30 sample records submitted offline, synced, and verified against dashboard output and exports.

**5\. TECHNOLOGY STACK**

We picked every tool in this stack based on three things: it had to be free, it had to have good documentation we could actually follow, and it had to be something we could learn quickly enough to use in a project timeline. We were not trying to use the most advanced tools. We were trying to use tools that would work reliably and not waste a week of our time fighting configuration issues.

**Frontend**

* React.js: We used React for the enumerator form and supervisor dashboard. We had some prior React experience, so it was the natural choice. The component structure kept the offline form logic cleanly separate from the sync layer.

* Bootstrap 5 and Chart.js: Bootstrap handled responsive layout without requiring design skills. Chart.js, via react-chartjs-2, rendered the age distribution and household size charts in the dashboard.

**Backend**

* Firebase Cloud Functions: Server-side validation runs here when a new submission syncs to Firestore. Keeps validation centralized rather than trusting the client.

* Firebase Authentication: Email and password login with role-based custom claims stored in the Auth token. Determines what each user can see and do.

**Database**

* Firebase Firestore: Cloud database for all synced submissions. The real-time listener is what makes the dashboard update live.

* IndexedDB via idb library: Offline local storage in the browser. Submissions save here when there is no internet, and a background function pushes them to Firestore when connectivity returns.

**Additional Tools**

* Leaflet.js: Map view in the supervisor dashboard, showing submission locations as markers on an OpenStreetMap base layer.

* jsPDF and Papa Parse: PDF and CSV export from filtered Firestore query results.

**Version Control and Deployment**

* GitHub and Firebase Hosting: Feature branches and pull requests for version control. Firebase Hosting for production deployment, free at our usage level and integrated with the rest of the Firebase setup.

**6\. TESTING STRATEGY**

We did all our testing manually and kept a shared log in Google Sheets of every test case: what we expected, what happened, and whether it passed or failed. No automated testing framework was used. That is a real gap we would address in a production version, but it was realistic for our timeline.

**Functional Testing**

We tested every feature against a pass/fail checklist. For offline submission, we loaded the app, disconnected from Wi-Fi, filled and submitted a form, confirmed the record in IndexedDB via browser dev tools, reconnected, and verified it appeared in Firestore within 30 seconds. We ran this 10 times across Chrome, Firefox, and Edge. It passed all three.

**Integration Testing**

The trickiest point was the sync deduplication logic. Early on, submitting the same record twice during a weak connection created two Firestore entries. We fixed this by generating a unique hash on the client side before storing to IndexedDB, then checking for that hash in Firestore before writing. After the fix, we submitted the same record 5 times in quick succession and confirmed only one entry was saved.

**Usability Testing**

Two classmates tested the enumerator form with no instructions from us. The first got confused at the geo-tagging step because the permission prompt appeared without explanation. We added a tooltip after that session. The second completed the form without issues. Our project guide reviewed the supervisor dashboard and asked for numeric labels on the charts, which we added.

**Security Testing**

We tested Firebase Security Rules by attempting to read another enumerator's data while logged in as a different enumerator. Access was blocked as expected. We also tried accessing the supervisor dashboard route directly without being logged in, and the app redirected to login. We did not run a full penetration test, but the two most obvious access control cases both passed.

**7\. LIMITATIONS AND FUTURE SCOPE**

**Current Limitations**

These are real limitations of the current version. We are not softening them.

* The system does not support biometric verification or integration with Aadhaar or any government identity infrastructure. All identity is based on enumerator-entered data, so accuracy depends entirely on the enumerator.

* Sync conflict resolution is basic. If two enumerators enter data for the same household ID in the same sync window, one record is flagged as a duplicate and held for manual review. There is no automated merge.

* The census form is a fixed template. There is no form builder for supervisors to customize questions without touching code.

* The policy insight generator uses thresholds we chose ourselves. The 40 percent threshold for flagging high elderly population in a block, for example, was not validated by demographic experts.

* The system has not been load tested. We do not know how it handles more than a few hundred concurrent submissions. A real deployment would need this tested and the architecture likely revised.

**Future Scope**

These are realistic next steps, not a wishlist.

* Build a drag-and-drop form builder so supervisors can customize the census form for different contexts, such as urban versus rural surveys, without developer access.

* Add machine learning to the policy insight generator. With enough historical census data, a model could identify anomalous demographic patterns that are harder to define with fixed thresholds.

* Implement a conflict resolution UI where supervisors can view two conflicting submissions side by side and merge them field by field.

* Integrate with QGIS or ArcGIS for advanced spatial analysis, including coverage gap detection and route optimization for enumerators.

* Add voice input support on the form for enumerators who have difficulty typing in field conditions, expanding usability in low-literacy contexts.

**8\. TEAM WORK DISTRIBUTION**

There are two of us: Manas Chandra and Aditya Jain. We split the work based on comfort, but with a lot of overlap during integration and testing. When one of us got stuck, the other jumped in. That meant some things moved slower but both of us understood the full system by the end.

**Manas Chandra – Frontend and Offline Storage**

Manas built the enumerator form in React, all form fields, client-side validation, and the offline submission flow. The IndexedDB integration was his main technical challenge. He had not worked with browser storage APIs before, and the idb library took time to get comfortable with. Manas also built the geo-tagging feature using the browser Geolocation API, including handling the case where the user denies permission. The sync function that pushes local records to Firestore once connectivity is detected was his work. It went through three rewrites before it was stable. He also handled PDF and CSV export using jsPDF and Papa Parse.

**Aditya Jain – Backend, Dashboard, and Security**

Aditya set up the Firebase project, configured Authentication with role-based custom claims, and wrote the Firestore Security Rules. He built the Cloud Functions for server-side validation on new submissions. The supervisor dashboard was his main frontend contribution. Aditya had some Chart.js experience from a personal project, so that went smoothly. He integrated Leaflet.js for the map view, which was new to him and took a couple of days to get loading from Firestore data correctly. He also built the audit log and the policy insight generator as a set of threshold checks running after each dashboard refresh.

**Shared Work**

Both of us worked on the initial requirement gathering and database design together. Two full sessions mapping collections before writing any code saved us from having to restructure later. The final integration test was done together in one long session. We also reviewed each other's code before merging to main, which caught a few bugs the original author had missed.

**9\. CONCLUSION**

Census data collection in most developing regions still depends on paper forms and manual entry, which creates delays between when data is collected and when it can be used. That delay is what we wanted to reduce. CensusSync is our attempt at a practical offline-first solution for field data collection, designed for environments where internet access is unreliable and enumerators need a system that works regardless of connectivity.

What we built covers the full core workflow: an enumerator logs in, fills a household form that works offline, submits it, and the data syncs to a central Firestore database when connectivity returns. Supervisors can monitor submissions through a live dashboard, validate data through server-side rules, view geo-tagged submissions on a map, and export reports in PDF and CSV. An audit log tracks all system actions. A rule-based policy insight generator highlights demographic patterns that may need attention from decision-makers.

The system has real limitations. The form is fixed format, the sync conflict resolution is basic, and we have not tested it under high concurrency. The policy insight generator uses thresholds we chose ourselves without domain expertise. These are honest gaps that a production version would need to address. But as a proof-of-concept demonstrating offline-first architecture, role-based access control, and basic census analytics in a single integrated system, it does what we set out to build.

Personally, this project taught both of us things we did not know how to do when we started. IndexedDB, Firebase Security Rules, Leaflet.js, and offline sync logic were all new to us. There was a week in the middle where the sync was broken and we could not figure out why, and we almost considered cutting the offline feature entirely. We did not, and getting it working was the most satisfying part of the project. Looking back, we would have started testing earlier and set up the audit log before building the dashboard, not after. But overall, we are genuinely pleased with what we managed to build.

**\* \* \* End of Synopsis \* \* \***