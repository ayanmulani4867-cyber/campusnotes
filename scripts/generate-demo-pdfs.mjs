/**
 * CampusNotes — Real PDF Document Generator for 30 Assignments & 32 Experiments
 * 
 * Generates 62 authentic, valid, standards-compliant PDF-1.4 documents
 * with formatted headers, disclaimers, objectives, and questions.
 */

import fs from 'fs';
import path from 'path';

// Helper function to create a valid PDF-1.4 buffer with custom text content
function createValidPdf({ title, courseName, courseCode, category, number, description, topics }) {
  const sanitize = (text) => (text || '').replace(/[()\\]/g, ' ');

  // Build stream content with PDF text operators
  let stream = 'BT\n';
  
  // Header / Branding
  stream += '/F1 20 Tf\n50 780 Td\n(CampusNotes - Academic Study Resource) Tj\n';
  stream += '/F2 10 Tf\n0 -18 Td\n(DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING - SEMESTER 5) Tj\n';
  
  // Header Notice Line
  stream += '/F1 11 Tf\n0 -24 Td\n(OFFICIAL ACADEMIC STUDY MATERIAL - CSE CURRICULUM) Tj\n';
  
  // Horizontal Rule indicator
  stream += '/F2 9 Tf\n0 -16 Td\n(____________________________________________________________________________________) Tj\n';
  
  // Title & Metadata
  stream += '/F1 14 Tf\n0 -28 Td\n(' + sanitize(title.replace(/\[DEMO\]\s*/gi, '')) + ') Tj\n';
  stream += '/F2 11 Tf\n0 -20 Td\n(Course: ' + sanitize(courseName) + ' [' + sanitize(courseCode) + ']) Tj\n';
  stream += '/F2 11 Tf\n0 -16 Td\n(Category: ' + sanitize(category) + '  |  ' + (category === 'Assignments' ? 'Assignment #' + number : 'Experiment #' + number) + '  |  Academic Year: 2026-27) Tj\n';

  stream += '/F2 9 Tf\n0 -16 Td\n(____________________________________________________________________________________) Tj\n';

  // Description / Overview
  stream += '/F1 12 Tf\n0 -26 Td\n(1. Overview & Objective:) Tj\n';
  stream += '/F2 10 Tf\n0 -18 Td\n(' + sanitize(description) + ') Tj\n';

  // Specific Questions or Experimental Steps
  stream += '/F1 12 Tf\n0 -28 Td\n(' + (category === 'Assignments' ? '2. Assignment Problems & Instructions:' : '2. Practical Tasks & Verification Steps:') + ') Tj\n';
  
  topics.forEach((t, i) => {
    stream += '/F2 10 Tf\n0 -18 Td\n(' + (i + 1) + '. ' + sanitize(t) + ') Tj\n';
  });

  // Footer Instructions
  stream += '/F1 10 Tf\n0 -36 Td\n(Submission Guidelines & Verification:) Tj\n';
  stream += '/F2 9 Tf\n0 -16 Td\n(This document verifies end-to-end PDF storage, preview, and download for CampusNotes.) Tj\n';
  stream += '/F2 9 Tf\n0 -14 Td\n(Administrators can safely edit metadata, publish/unpublish, or replace this document.) Tj\n';
  stream += 'ET\n';

  const streamBytes = Buffer.from(stream, 'utf-8');
  const streamLength = streamBytes.length;

  const objects = [];
  
  // 1 0 obj: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  
  // 2 0 obj: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  
  // 3 0 obj: Page
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n');
  
  // 4 0 obj: Font Bold
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');
  
  // 5 0 obj: Font Regular
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  
  // 6 0 obj: Contents Stream
  objects.push('6 0 obj\n<< /Length ' + streamLength + ' >>\nstream\n' + stream + 'endstream\nendobj\n');

  // Compute xref offsets
  let header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  let offset = Buffer.byteLength(header, 'latin1');
  const offsets = [0];

  objects.forEach(obj => {
    offsets.push(offset);
    offset += Buffer.byteLength(obj, 'utf-8');
  });

  let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  const startxref = offset;
  const trailer = 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + startxref + '\n%%EOF\n';

  return Buffer.concat([
    Buffer.from(header, 'latin1'),
    ...objects.map(o => Buffer.from(o, 'utf-8')),
    Buffer.from(xref, 'utf-8'),
    Buffer.from(trailer, 'utf-8')
  ]);
}

// -------------------------------------------------------------
// Definitions for all 30 Assignments and 32 Experiments
// -------------------------------------------------------------

const assignmentsData = [
  // 1. Advanced Java Programming (23CS3501)
  {
    courseName: 'Advanced Java Programming',
    courseCode: '23CS3501',
    number: 1,
    fileName: '23CS3501_Assignment_1_Multithreading.pdf',
    title: '[DEMO] Assignment 1: Multithreading & Concurrency Synchronization',
    description: 'Implement robust thread synchronization, lock mechanisms, and deadlock prevention.',
    topics: [
      'Explain thread lifecycle states and how Thread.sleep() differs from Object.wait().',
      'Implement a synchronized bounded-buffer Producer-Consumer queue in Java.',
      'Demonstrate ReentrantLock and Condition variables compared to synchronized blocks.',
      'Write a program causing and detecting thread deadlock using ThreadMXBean.',
    ]
  },
  {
    courseName: 'Advanced Java Programming',
    courseCode: '23CS3501',
    number: 2,
    fileName: '23CS3501_Assignment_2_Collections_Streams.pdf',
    title: '[DEMO] Assignment 2: Java Collections Framework & Stream API',
    description: 'Master generic collections, functional interfaces, and stream aggregation pipelines.',
    topics: [
      'Compare performance of ArrayList vs LinkedList for insertion vs traversal.',
      'Implement custom Comparator sorting students by GPA descending and name ascending.',
      'Use Stream.filter(), map(), and Collectors.groupingBy() on employee records.',
      'Explain fail-fast vs fail-safe iterators with ConcurrentHashMap demonstration.',
    ]
  },
  {
    courseName: 'Advanced Java Programming',
    courseCode: '23CS3501',
    number: 3,
    fileName: '23CS3501_Assignment_3_JDBC_Transactions.pdf',
    title: '[DEMO] Assignment 3: JDBC Database Connectivity & Transaction Management',
    description: 'Construct secure database connections and atomic multi-statement transaction rollbacks.',
    topics: [
      'Compare Statement vs PreparedStatement regarding SQL injection vulnerabilities.',
      'Implement batch insert of 5,000 university records measuring execution latency.',
      'Demonstrate commit and rollback for a bank fund transfer between two accounts.',
      'Configure a connection pool with HikariCP and demonstrate connection reuse.',
    ]
  },
  {
    courseName: 'Advanced Java Programming',
    courseCode: '23CS3501',
    number: 4,
    fileName: '23CS3501_Assignment_4_Servlets_Sessions.pdf',
    title: '[DEMO] Assignment 4: Java Servlets & Session Management Architecture',
    description: 'Build scalable servlet request processing and stateful session tracking workflows.',
    topics: [
      'Describe the Servlet lifecycle and contrast doGet() with doPost() processing.',
      'Implement user session tracking using HTTPSession with automated 15-minute expiry.',
      'Build a cookie-based shopping cart remembering user selections across requests.',
      'Design a security filter verifying authorization tokens prior to servlet execution.',
    ]
  },
  {
    courseName: 'Advanced Java Programming',
    courseCode: '23CS3501',
    number: 5,
    fileName: '23CS3501_Assignment_5_JSP_JSTL.pdf',
    title: '[DEMO] Assignment 5: JSP Directives & Custom Tag Libraries (JSTL)',
    description: 'Separate business logic from presentation using JavaServer Pages and expression language.',
    topics: [
      'Explain JSP translation phases and generated servlet code structure.',
      'Use JSTL core tags (<c:forEach>, <c:if>, <c:choose>) to render tabular grade reports.',
      'Integrate JavaBeans components with <jsp:useBean> and <jsp:setProperty>.',
      'Create a custom JSP tag for academic GPA categorization formatting.',
    ]
  },
  {
    courseName: 'Advanced Java Programming',
    courseCode: '23CS3501',
    number: 6,
    fileName: '23CS3501_Assignment_6_Spring_Boot_REST.pdf',
    title: '[DEMO] Assignment 6: Spring Boot RESTful API Development & Validation',
    description: 'Construct industry-standard microservices with Spring Boot, DTO validation, and JPA.',
    topics: [
      'Architect a RESTful Student CRUD API with GET, POST, PUT, and DELETE endpoints.',
      'Implement Hibernate Validator annotations (@NotNull, @Email, @Size) with GlobalExceptionHandler.',
      'Configure Spring Data JPA repository with custom Derived Query methods.',
      'Document API endpoints using OpenAPI / Swagger documentation UI.',
    ]
  },

  // 2. Design Analysis and Algorithms (23CS3502)
  {
    courseName: 'Design Analysis and Algorithms',
    courseCode: '23CS3502',
    number: 1,
    fileName: '23CS3502_Assignment_1_Asymptotic_Recurrence.pdf',
    title: '[DEMO] Assignment 1: Asymptotic Notations & Recurrence Relations',
    description: 'Formal mathematical analysis of time and space complexity bounds.',
    topics: [
      'Prove formally that 3n^2 + 5n log n is O(n^2) using asymptotic definitions.',
      'Solve recurrence T(n) = 4T(n/2) + n^2 using the Master Theorem.',
      'Solve T(n) = 2T(n/2) + n log n using Recursion Tree and Substitution methods.',
      'Analyze worst-case, best-case, and average-case bounds of binary search.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms',
    courseCode: '23CS3502',
    number: 2,
    fileName: '23CS3502_Assignment_2_Divide_and_Conquer.pdf',
    title: '[DEMO] Assignment 2: Divide and Conquer Algorithms Analysis',
    description: 'Divide and conquer algorithmic paradigm, divide overhead, and recurrence solutions.',
    topics: [
      'Derive the exact recurrence and recursion tree for Merge Sort: T(n) = 2T(n/2) + O(n).',
      'Analyze randomized QuickSort expected time complexity of O(n log n).',
      'Derive Strassen matrix multiplication recurrence T(n) = 7T(n/2) + O(n^2).',
      'Implement and analyze the Closest Pair of Points 2D geometric algorithm.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms',
    courseCode: '23CS3502',
    number: 3,
    fileName: '23CS3502_Assignment_3_Greedy_Algorithms.pdf',
    title: '[DEMO] Assignment 3: Greedy Approach (Huffman & Spanning Trees)',
    description: 'Formulation of greedy-choice property and optimal substructure guarantees.',
    topics: [
      'Construct a Huffman Tree for given character frequency table and compute bits saved.',
      'Formulate and prove optimal solution for the Fractional Knapsack problem.',
      'Compare Prim algorithm with Kruskal algorithm using Disjoint Set Union data structure.',
      'Solve Activity Selection problem and prove greedy strategy produces maximum activities.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms',
    courseCode: '23CS3502',
    number: 4,
    fileName: '23CS3502_Assignment_4_Dynamic_Programming.pdf',
    title: '[DEMO] Assignment 4: Dynamic Programming (Knapsack & Shortest Paths)',
    description: 'Construct tabular memoization solutions to eliminate redundant subproblem evaluation.',
    topics: [
      'Formulate DP state transition for 0/1 Knapsack: V[i, w] = max(V[i-1,w], v_i + V[i-1, w-w_i]).',
      'Compute optimal parenthesization for Matrix Chain Multiplication of 5 dimensions.',
      'Derive all-pairs shortest paths using Floyd-Warshall DP relaxation matrix.',
      'Find the Longest Common Subsequence of two strings and trace back the alignment.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms',
    courseCode: '23CS3502',
    number: 5,
    fileName: '23CS3502_Assignment_5_Backtracking_Branch_Bound.pdf',
    title: '[DEMO] Assignment 5: Backtracking & Branch-and-Bound Paradigms',
    description: 'Systematic state space tree exploration with bounding function pruning.',
    topics: [
      'Draw the complete state space tree for 4-Queens problem using backtracking.',
      'Formulate the bounding function for m-Coloring graph problem.',
      'Solve the 15-Puzzle problem using Least Cost Branch and Bound (LCBB).',
      'Compare computational complexity of Backtracking vs Branch-and-Bound for 0/1 Knapsack.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms',
    courseCode: '23CS3502',
    number: 6,
    fileName: '23CS3502_Assignment_6_String_Matching_NP_Complete.pdf',
    title: '[DEMO] Assignment 6: String Matching & NP-Completeness Reductions',
    description: 'Pattern matching automatons, polynomial verification, and NP-hard problem reductions.',
    topics: [
      'Compute the prefix function (pi table) for KMP string matching algorithm.',
      'Explain Rabin-Karp algorithm rolling hash collision handling and complexity.',
      'Define classes P, NP, NP-Complete, and NP-Hard with Venn diagram illustration.',
      'Prove polynomial-time reduction from 3-SAT to Vertex Cover problem.',
    ]
  },

  // 3. Advanced Database Engineering (23CS3503)
  {
    courseName: 'Advanced Database Engineering',
    courseCode: '23CS3503',
    number: 1,
    fileName: '23CS3503_Assignment_1_Relational_Algebra_SQL.pdf',
    title: '[DEMO] Assignment 1: Advanced Relational Algebra & Complex SQL Queries',
    description: 'Deep dive into formal relational algebra and advanced analytical SQL queries.',
    topics: [
      'Translate complex natural language queries into extended Relational Algebra expressions.',
      'Write analytical window functions using ROW_NUMBER(), RANK(), and DENSE_RANK().',
      'Construct hierarchical recursive Common Table Expressions (CTEs) for employee trees.',
      'Optimize multi-table joins using appropriate Cartesian product filtering rules.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering',
    courseCode: '23CS3503',
    number: 2,
    fileName: '23CS3503_Assignment_2_Normalization_Decomposition.pdf',
    title: '[DEMO] Assignment 2: Normalization (3NF, BCNF, 4NF) & Decomposition',
    description: 'Database normalization theory, dependency preservation, and lossless decomposition.',
    topics: [
      'Determine candidate keys from a set of functional dependencies using Armstrong axioms.',
      'Compute the canonical cover (minimal cover) of a given functional dependency set.',
      'Decompose relation R into BCNF verifying lossless join and dependency preservation.',
      'Explain Multi-Valued Dependencies (MVD) and normalize relations into 4NF.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering',
    courseCode: '23CS3503',
    number: 3,
    fileName: '23CS3503_Assignment_3_Query_Optimization.pdf',
    title: '[DEMO] Assignment 3: Query Optimization Strategies & Cost Estimation',
    description: 'Query processor architecture, relational algebra equivalence rules, and cost metrics.',
    topics: [
      'Transform initial query syntax trees into optimized canonical plans using heuristics.',
      'Calculate disk I/O cost estimates for Block Nested Loop Join vs Hash Join vs Merge Join.',
      'Explain dynamic programming algorithm used in System R for join order enumeration.',
      'Design clustered B+ tree vs non-clustered index strategies for specific query workloads.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering',
    courseCode: '23CS3503',
    number: 4,
    fileName: '23CS3503_Assignment_4_Concurrency_Control.pdf',
    title: '[DEMO] Assignment 4: Transaction Concurrency Control Protocols',
    description: 'ACID guarantees, conflict serializability, locking protocols, and deadlock resolution.',
    topics: [
      'Determine if a given transaction schedule is conflict serializable using precedence graphs.',
      'Prove that Strict Two-Phase Locking (2PL) guarantees conflict serializability without cascading aborts.',
      'Explain Wait-Die and Wound-Wait deadlock prevention schemes based on timestamps.',
      'Compare Multiversion Concurrency Control (MVCC) with lock-based concurrency control.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering',
    courseCode: '23CS3503',
    number: 5,
    fileName: '23CS3503_Assignment_5_Database_Recovery_WAL.pdf',
    title: '[DEMO] Assignment 5: Database Recovery Protocols & WAL Logging',
    description: 'Failure models, Write-Ahead Logging (WAL), checkpointing, and ARIES recovery algorithm.',
    topics: [
      'Explain the Write-Ahead Logging (WAL) protocol and why Steal/No-Force buffer management is preferred.',
      'Detail the three phases of ARIES recovery algorithm: Analysis, Redo, and Undo.',
      'Trace compensation log records (CLRs) created during transaction rollback upon system crash.',
      'Differentiate between non-fuzzy checkpoints and fuzzy checkpoints with dirty page tables.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering',
    courseCode: '23CS3503',
    number: 6,
    fileName: '23CS3503_Assignment_6_Distributed_NoSQL.pdf',
    title: '[DEMO] Assignment 6: Distributed Databases & NoSQL Data Modeling',
    description: 'Distributed commit protocols, CAP theorem tradeoffs, and document NoSQL design.',
    topics: [
      'Detail the Two-Phase Commit (2PC) protocol phases and failure recovery states.',
      'Explain the CAP theorem and compare consistency models of Cassandra vs MongoDB.',
      'Design a document schema in MongoDB for an e-commerce platform avoiding N+1 queries.',
      'Evaluate horizontal sharding strategies: range-based sharding vs hash-based sharding.',
    ]
  },

  // 4. Program Elective Course-I (23CS3507)
  {
    courseName: 'Program Elective Course-I',
    courseCode: '23CS3507',
    number: 1,
    fileName: '23CS3507_Assignment_1_AI_Search_Strategies.pdf',
    title: '[DEMO] Assignment 1: Intelligent Agents & State-Space Search (A*)',
    description: 'Foundations of intelligent agents, heuristic search, and game tree pruning.',
    topics: [
      'Categorize PEAS (Performance, Environment, Actuators, Sensors) for autonomous vehicle agents.',
      'Prove mathematical condition for A* heuristic admissibility and consistency (monotonicity).',
      'Execute A* algorithm step-by-step on 8-puzzle game calculating Manhattan distance heuristics.',
      'Apply Minimax algorithm with Alpha-Beta pruning on a 4-level adversarial game tree.',
    ]
  },
  {
    courseName: 'Program Elective Course-I',
    courseCode: '23CS3507',
    number: 2,
    fileName: '23CS3507_Assignment_2_Logic_Knowledge_Rep.pdf',
    title: '[DEMO] Assignment 2: Knowledge Representation & First-Order Logic',
    description: 'Automated theorem proving, resolution refutation, and ontologies.',
    topics: [
      'Convert complex English statements into First-Order Predicate Logic (FOL) formulas.',
      'Demonstrate Skolemization and Conjunctive Normal Form (CNF) transformation steps.',
      'Perform resolution refutation theorem proving to prove target queries from knowledge bases.',
      'Compare semantic networks, frames, and description logic for ontology modeling.',
    ]
  },
  {
    courseName: 'Program Elective Course-I',
    courseCode: '23CS3507',
    number: 3,
    fileName: '23CS3507_Assignment_3_Supervised_Learning.pdf',
    title: '[DEMO] Assignment 3: Supervised Machine Learning Algorithms',
    description: 'Mathematical derivation and algorithmic formulation of linear and non-linear classifiers.',
    topics: [
      'Derive gradient descent update equations for Ordinary Least Squares (OLS) Linear Regression.',
      'Derive the Logistic Regression sigmoid loss function (binary cross-entropy).',
      'Calculate Information Gain and Gini Impurity for Decision Tree node splitting.',
      'Explain Support Vector Machines (SVM) maximal margin hyperplane and kernel trick.',
    ]
  },
  {
    courseName: 'Program Elective Course-I',
    courseCode: '23CS3507',
    number: 4,
    fileName: '23CS3507_Assignment_4_Neural_Networks.pdf',
    title: '[DEMO] Assignment 4: Artificial Neural Networks & Backpropagation',
    description: 'Perceptron models, multi-layer networks, activation functions, and gradient backpropagation.',
    topics: [
      'Prove why a single-layer perceptron cannot classify the non-linear XOR function.',
      'Derive the backpropagation weight update formula using multivariate chain rule.',
      'Compare activation functions: Sigmoid, Hyperbolic Tangent (Tanh), and Rectified Linear Unit (ReLU).',
      'Explain the vanishing gradient problem in deep networks and techniques to mitigate it.',
    ]
  },
  {
    courseName: 'Program Elective Course-I',
    courseCode: '23CS3507',
    number: 5,
    fileName: '23CS3507_Assignment_5_Unsupervised_Clustering.pdf',
    title: '[DEMO] Assignment 5: Unsupervised Clustering & Dimensionality Reduction',
    description: 'Centroid and density clustering algorithms, and variance maximization dimensionality reduction.',
    topics: [
      'Explain K-Means clustering algorithm steps and prove convergence to local minima.',
      'Describe DBSCAN density-based clustering core points, border points, and noise.',
      'Derive Principal Component Analysis (PCA) through eigenvalue decomposition of covariance matrix.',
      'Compare Agglomerative Hierarchical clustering linkage criteria (single, complete, average).',
    ]
  },
  {
    courseName: 'Program Elective Course-I',
    courseCode: '23CS3507',
    number: 6,
    fileName: '23CS3507_Assignment_6_Model_Evaluation_Ensembles.pdf',
    title: '[DEMO] Assignment 6: Model Evaluation, Cross-Validation & Ensemble Methods',
    description: 'Statistical validation, confusion matrix metrics, bagging, and boosting ensemble methods.',
    topics: [
      'Calculate Precision, Recall, Specificity, F1-Score, and Matthew Correlation Coefficient from matrix.',
      'Draw and interpret the Receiver Operating Characteristic (ROC) curve and Area Under Curve (AUC).',
      'Explain K-Fold Cross-Validation and Stratified K-Fold for imbalanced class data.',
      'Compare Bagging (Random Forests) with Boosting (AdaBoost, Gradient Boosting, XGBoost).',
    ]
  },

  // 5. Open Elective III (23OECS31)
  {
    courseName: 'Open Elective III',
    courseCode: '23OECS31',
    number: 1,
    fileName: '23OECS31_Assignment_1_Cloud_Service_Models.pdf',
    title: '[DEMO] Assignment 1: Cloud Computing Delivery Models (IaaS, PaaS, SaaS)',
    description: 'Comprehensive analysis of cloud infrastructure, platforms, and operational expenditure.',
    topics: [
      'Compare IaaS (AWS EC2), PaaS (AWS Elastic Beanstalk), and SaaS (Google Workspace) shared responsibilities.',
      'Analyze Capital Expenditures (CapEx) vs Operational Expenditures (OpEx) in cloud adoption.',
      'Evaluate Public vs Private vs Hybrid cloud deployments for regulated healthcare organizations.',
      'Describe essential cloud characteristics as defined by NIST (Special Publication 800-145).',
    ]
  },
  {
    courseName: 'Open Elective III',
    courseCode: '23OECS31',
    number: 2,
    fileName: '23OECS31_Assignment_2_Virtualization_Hypervisors.pdf',
    title: '[DEMO] Assignment 2: Virtualization Technologies & Hypervisor Types',
    description: 'Hardware virtualization, hypervisor architectures, and memory virtualization techniques.',
    topics: [
      'Compare Type-1 bare-metal hypervisors (ESXi, Xen) with Type-2 hosted hypervisors (VirtualBox).',
      'Explain Intel VT-x and AMD-V hardware-assisted CPU virtualization rings (Ring -1).',
      'Describe memory overcommitment, memory ballooning, and transparent page sharing.',
      'Analyze network virtualization through Virtual Switches (vSwitch) and VXLAN overlay networks.',
    ]
  },
  {
    courseName: 'Open Elective III',
    courseCode: '23OECS31',
    number: 3,
    fileName: '23OECS31_Assignment_3_Cloud_Storage_Systems.pdf',
    title: '[DEMO] Assignment 3: Cloud Storage Systems & Object Storage Policies',
    description: 'Block storage, file storage, distributed object storage architectures, and lifecycle rules.',
    topics: [
      'Compare Block Storage (AWS EBS) with Object Storage (AWS S3) and Network File System (AWS EFS).',
      'Explain S3 bucket storage classes: Standard, Infrequent Access, and Glacier Deep Archive.',
      'Formulate automated bucket lifecycle transition policies optimizing storage cost over 365 days.',
      'Detail eventual consistency models and multi-region bucket cross-region replication (CRR).',
    ]
  },
  {
    courseName: 'Open Elective III',
    courseCode: '23OECS31',
    number: 4,
    fileName: '23OECS31_Assignment_4_Docker_Kubernetes.pdf',
    title: '[DEMO] Assignment 4: Containerization with Docker & Kubernetes Basics',
    description: 'Operating system-level virtualization, Docker containers, and container orchestration.',
    topics: [
      'Explain Linux namespaces (PID, NET, MNT) and cgroups forming the foundation of containers.',
      'Write an optimized multi-stage Dockerfile minimizing final image size for a Node.js/Java app.',
      'Describe Kubernetes control plane components (API Server, etcd, Scheduler, Controller Manager).',
      'Define a Kubernetes Deployment and ClusterIP Service YAML manifest managing 3 replica pods.',
    ]
  },
  {
    courseName: 'Open Elective III',
    courseCode: '23OECS31',
    number: 5,
    fileName: '23OECS31_Assignment_5_Cloud_Security_IAM.pdf',
    title: '[DEMO] Assignment 5: Cloud Security, IAM Policies & Compliance',
    description: 'Cloud identity and access management, zero trust security, and regulatory compliance.',
    topics: [
      'Design a least-privilege AWS IAM JSON policy granting read-only access to a specific S3 bucket.',
      'Explain the Cloud Shared Responsibility Model for infrastructure vs operating system vs data.',
      'Differentiate encryption at rest (AWS KMS Customer Managed Keys) from encryption in transit (TLS 1.3).',
      'Outline compliance audit controls required for SOC 2 Type II and ISO/IEC 27001 certifications.',
    ]
  },
  {
    courseName: 'Open Elective III',
    courseCode: '23OECS31',
    number: 6,
    fileName: '23OECS31_Assignment_6_Serverless_Microservices.pdf',
    title: '[DEMO] Assignment 6: Serverless Architecture & Microservices Deployment',
    description: 'Event-driven serverless computing, function invocation models, and API Gateway orchestration.',
    topics: [
      'Analyze Function-as-a-Service (FaaS) event triggers, statelessness, and cold-start latency.',
      'Compare monolithic application architectures with microservices communicating via asynchronous event buses.',
      'Configure API Gateway rate limiting, throttling, and JWT token authorization mechanisms.',
      'Compute cost analysis comparing an auto-scaled EC2 cluster against AWS Lambda for variable workloads.',
    ]
  },

  // 6. Multidisciplinary Minor-III (23CSMDXX) — 6 Assignments
  {
    courseName: 'Multidisciplinary Minor-III',
    courseCode: '23CSMDXX',
    number: 1,
    fileName: '23CSMDXX_Assignment_1_Interdisciplinary_Systems.pdf',
    title: '[DEMO] Assignment 1: Interdisciplinary Computing & Systems Modeling',
    description: 'Mathematical modeling, dynamical systems representation, and interdisciplinary computational problem framing.',
    topics: [
      'Formulate state-space representations of physical and biological systems.',
      'Apply numerical simulation methods (Euler, Runge-Kutta 4th Order) to differential models.',
      'Analyze system feedback loops, steady-state equilibria, and sensitivity indices.',
      'Construct computational abstractions for cross-domain engineering problems.',
    ]
  },
  {
    courseName: 'Multidisciplinary Minor-III',
    courseCode: '23CSMDXX',
    number: 2,
    fileName: '23CSMDXX_Assignment_2_Data_Analytics_Methods.pdf',
    title: '[DEMO] Assignment 2: Applied Data Analytics & Computational Methods',
    description: 'Exploratory multivariate data analysis, hypothesis testing, and statistical estimation techniques.',
    topics: [
      'Perform exploratory data analysis and correlation matrix evaluation on real-world datasets.',
      'Formulate null and alternative hypotheses using two-sample t-tests and ANOVA.',
      'Implement linear and polynomial regression for multi-variable trend forecasting.',
      'Evaluate confidence intervals, p-value significance thresholds, and residual standard error.',
    ]
  },
  {
    courseName: 'Multidisciplinary Minor-III',
    courseCode: '23CSMDXX',
    number: 3,
    fileName: '23CSMDXX_Assignment_3_Cross_Domain_Engineering.pdf',
    title: '[DEMO] Assignment 3: Cross-Domain Engineering Case Studies & Analysis',
    description: 'Systematic evaluation of computing applications in smart manufacturing, healthcare, and energy systems.',
    topics: [
      'Analyze IoT telemetry pipelines in automated smart factory architectures.',
      'Evaluate algorithmic signal processing in medical diagnostic instruments.',
      'Model renewable energy grid load balancing using predictive optimization.',
      'Detail reliability, safety-critical constraints, and failure modes in hybrid systems.',
    ]
  },
  {
    courseName: 'Multidisciplinary Minor-III',
    courseCode: '23CSMDXX',
    number: 4,
    fileName: '23CSMDXX_Assignment_4_Optimization_Techniques.pdf',
    title: '[DEMO] Assignment 4: Optimization Techniques & Decision Science',
    description: 'Linear programming, constraint satisfaction, and multi-criteria decision-making algorithms.',
    topics: [
      'Formulate primal and dual linear programs with resource constraints.',
      'Solve optimization problems using Simplex and interior-point computational methods.',
      'Apply Analytic Hierarchy Process (AHP) for multi-objective engineering trade-offs.',
      'Implement integer programming for workforce scheduling and logistical routing.',
    ]
  },
  {
    courseName: 'Multidisciplinary Minor-III',
    courseCode: '23CSMDXX',
    number: 5,
    fileName: '23CSMDXX_Assignment_5_Cyber_Physical_Systems.pdf',
    title: '[DEMO] Assignment 5: Cyber-Physical Systems & Sensor Networks Integration',
    description: 'Edge computing, embedded sensing protocols, and real-time synchronization in cyber-physical systems.',
    topics: [
      'Evaluate MQTT, CoAP, and HTTP lightweight communication protocols for edge sensors.',
      'Design data aggregation algorithms minimizing sensor energy consumption.',
      'Analyze clock synchronization (PTP IEEE 1588) in distributed telemetry networks.',
      'Model closed-loop actuator feedback latency under varying network bandwidths.',
    ]
  },
  {
    courseName: 'Multidisciplinary Minor-III',
    courseCode: '23CSMDXX',
    number: 6,
    fileName: '23CSMDXX_Assignment_6_Minor_Capstone_Synthesis.pdf',
    title: '[DEMO] Assignment 6: Minor Capstone Research Synthesis & Technical Reporting',
    description: 'Comprehensive interdisciplinary technical proposal, ethical review, and computational architecture synthesis.',
    topics: [
      'Synthesize multi-domain literature and formulate structured research problem statements.',
      'Architect end-to-end software/hardware technical design with block diagrams.',
      'Conduct risk assessment, ethical considerations, and data privacy impact analysis.',
      'Draft comprehensive technical report following IEEE publication standards.',
    ]
  },
];

const experimentsData = [
  // 1. Advanced Java Programming Laboratory (23CS3504) — 12 Experiments
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 1,
    fileName: '23CS3504_Exp_1_Producer_Consumer.pdf',
    title: '[DEMO] Experiment 1: Multithreaded Producer-Consumer Problem',
    description: 'Implement thread synchronization, mutual exclusion, and inter-thread signaling using wait() and notify().',
    topics: [
      'Define shared circular buffer class with maximum capacity threshold of 5 elements.',
      'Implement Producer thread writing integer values into buffer and calling wait() when full.',
      'Implement Consumer thread reading values from buffer and signaling notifyAll() when space frees.',
      'Execute multi-threaded test with 3 producers and 2 consumers verifying zero race conditions.',
    ]
  },
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 2,
    fileName: '23CS3504_Exp_2_Generic_Collections.pdf',
    title: '[DEMO] Experiment 2: Generic Data Structures with Java Collections',
    description: 'Develop type-safe custom Stack and Queue data structures utilizing Java Generics.',
    topics: [
      'Create generic class CustomStack<T> with push(), pop(), and peek() methods using dynamic array resizing.',
      'Implement custom Queue<T> utilizing doubly linked nodes with O(1) enqueue and dequeue operations.',
      'Demonstrate bounded generic wildcards (<? extends Number>, <? super Integer>).',
      'Benchmark custom collection performance against java.util.ArrayDeque across 100,000 operations.',
    ]
  },
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 3,
    fileName: '23CS3504_Exp_3_Stream_API_Processing.pdf',
    title: '[DEMO] Experiment 3: Data Aggregation with Java 8 Streams & Lambdas',
    description: 'Process and filter large dataset collections using declarative Stream pipelines.',
    topics: [
      'Model Student record with attributes: id, name, semester, branch, cgpa, and attendance.',
      'Filter all CSE Sem 5 students with CGPA >= 8.5 and sort them alphabetically using lambda comparators.',
      'Compute branch-wise average CGPA using Collectors.groupingBy() and Collectors.averagingDouble().',
      'Demonstrate parallelStream() execution speedup on a synthetic dataset of 500,000 records.',
    ]
  },
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 4,
    fileName: '23CS3504_Exp_4_TCP_Socket_Chat.pdf',
    title: '[DEMO] Experiment 4: TCP Socket Programming for Client-Server Chat',
    description: 'Build a multi-client TCP network socket application supporting bi-directional text streaming.',
    topics: [
      'Construct ServerSocket listening on port 8080 dispatching each incoming client connection to worker thread.',
      'Build ClientSocket connecting to server with BufferedReader and PrintWriter I/O streams.',
      'Implement broadcast messaging routing messages from one client to all other connected participants.',
      'Handle graceful client disconnection with socket close cleanup and active client count broadcast.',
    ]
  },
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 5,
    fileName: '23CS3504_Exp_5_JDBC_CRUD_Operations.pdf',
    title: '[DEMO] Experiment 5: JDBC CRUD Application with PreparedStatement',
    description: 'Construct a student record management system with secure parameterized SQL execution.',
    topics: [
      'Establish database connection to MySQL/PostgreSQL using DriverManager and external configuration properties.',
      'Implement INSERT, SELECT, UPDATE, and DELETE methods using PreparedStatement.',
      'Execute parameterized search queries retrieving students matching name substrings and branch.',
      'Verify defense against SQL injection attacks passing malicious input strings (e.g., OR 1=1).',
    ]
  },
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 6,
    fileName: '23CS3504_Exp_6_JDBC_Batch_Transactions.pdf',
    title: '[DEMO] Experiment 6: JDBC Batch Updates & ACID Transaction Commit/Rollback',
    description: 'Simulate bank fund transfer demonstrating automatic rollback upon simulated failure.',
    topics: [
      'Disable autocommit mode using connection.setAutoCommit(false) on database connection.',
      'Execute debit transaction on Account A and simulated failed credit on Account B.',
      'Catch SQL exception in catch block and execute connection.rollback() restoring initial state.',
      'Implement PreparedStatement batching with addBatch() and executeBatch() inserting 1,000 records.',
    ]
  },
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 7,
    fileName: '23CS3504_Exp_7_Servlet_Session_Auth.pdf',
    title: '[DEMO] Experiment 7: User Authentication Servlet with Cookies & Session Tracking',
    description: 'Implement a secure login/logout portal tracking session timeout and credentials.',
    topics: [
      'Construct LoginServlet validating credentials against database and initiating request.getSession().',
      'Store authenticated user profile attributes in session object and set 15-minute inactive timeout.',
      'Build DashboardServlet checking session presence and redirecting unauthorized visitors to login.',
      'Implement LogoutServlet invalidating session with session.invalidate() and clearing auth cookies.',
    ]
  },
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 8,
    fileName: '23CS3504_Exp_8_Servlet_Filter_Logging.pdf',
    title: '[DEMO] Experiment 8: Servlet Filter for Request Logging and IP Validation',
    description: 'Construct a reusable intercepting filter that validates client IP address and logs execution timings.',
    topics: [
      'Create class LoggingFilter implementing javax.servlet.Filter interface and overriding doFilter().',
      'Capture request start timestamp, remote IP address, requested URI, and HTTP method.',
      'Forward request along chain with chain.doFilter(request, response) and measure elapsed processing time.',
      'Implement IP whitelist block rejecting unauthorized client subnet IPs with HTTP 403 Forbidden.',
    ]
  },
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 9,
    fileName: '23CS3504_Exp_9_JSP_JavaBeans_Grades.pdf',
    title: '[DEMO] Experiment 9: Dynamic Grade Calculation with JSP & JavaBeans',
    description: 'Develop a modular grading application binding HTML form values directly into JavaBeans components.',
    topics: [
      'Create StudentMarksBean with private attributes (maths, dsa, dbms, java), getters, and setters.',
      'Build student_input.html capturing semester course marks with client-side HTML5 input validation.',
      'Construct calculate_grade.jsp instantiating bean with <jsp:useBean> and <jsp:setProperty property="*">.',
      'Compute total percentage, CGPA, letter grade, and display color-coded status badge on presentation layer.',
    ]
  },
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 10,
    fileName: '23CS3504_Exp_10_MVC_Architecture_App.pdf',
    title: '[DEMO] Experiment 10: MVC Architecture with Servlets, JSP & MySQL',
    description: 'Complete 3-tier MVC enterprise application separating Model, View, and Controller.',
    topics: [
      'Construct StudentModel POJO and StudentDAO handling database persistence logic.',
      'Build StudentController servlet receiving HTTP requests, executing DAO methods, and setting request attributes.',
      'Construct list_students.jsp displaying database student rows with edit and delete action hyperlinks.',
      'Verify strict separation of concerns ensuring no direct SQL statements exist within JSP files.',
    ]
  },
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 11,
    fileName: '23CS3504_Exp_11_Spring_Boot_REST_Controller.pdf',
    title: '[DEMO] Experiment 11: Spring Boot REST Controller with CRUD Endpoints',
    description: 'Build a production-ready REST service with @RestController and JSON serialization.',
    topics: [
      'Bootstrap Spring Boot project with spring-boot-starter-web and spring-boot-starter-validation.',
      'Implement StudentRestController exposing GET /api/students, POST /api/students, and DELETE /api/students/{id}.',
      'Implement ResponseEntity<T> returning proper HTTP status codes (200 OK, 201 Created, 404 Not Found).',
      'Test and verify REST endpoints using Postman or cURL verifying JSON response structures.',
    ]
  },
  {
    courseName: 'Advanced Java Programming Laboratory',
    courseCode: '23CS3504',
    number: 12,
    fileName: '23CS3504_Exp_12_Spring_Data_JPA_Repository.pdf',
    title: '[DEMO] Experiment 12: Spring Boot Data JPA with Database Repository',
    description: 'Persist entity models using Spring Data JPA JpaRepository and custom query methods.',
    topics: [
      'Annotate Student entity class with @Entity, @Table, @Id, and @GeneratedValue(strategy = GenerationType.IDENTITY).',
      'Create StudentRepository interface extending JpaRepository<Student, Long>.',
      'Define custom Spring Data query method findByBranchAndSemester(String branch, int semester).',
      'Verify automatic schema creation with spring.jpa.hibernate.ddl-auto=update and H2/MySQL database.',
    ]
  },

  // 2. Design Analysis and Algorithms Laboratory (23CS3505) — 10 Experiments
  {
    courseName: 'Design Analysis and Algorithms Laboratory',
    courseCode: '23CS3505',
    number: 1,
    fileName: '23CS3505_Exp_1_Empirical_Sorting_Analysis.pdf',
    title: '[DEMO] Experiment 1: Empirical Complexity of Merge Sort vs Quick Sort',
    description: 'Implement and plot CPU runtime curves of Merge Sort and Quick Sort across varying input sizes.',
    topics: [
      'Implement Merge Sort dividing array at midpoint and merging two sorted subarrays in O(n) space.',
      'Implement Quick Sort with randomized pivot selection partitioning array in-place.',
      'Generate random test arrays of sizes n = 1,000, 5,000, 10,000, 50,000, and 100,000 integers.',
      'Measure execution time using System.nanoTime() and plot comparative empirical growth curves.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms Laboratory',
    courseCode: '23CS3505',
    number: 2,
    fileName: '23CS3505_Exp_2_Strassen_Matrix_Multiplication.pdf',
    title: '[DEMO] Experiment 2: Strassen Matrix Multiplication Algorithm',
    description: 'Divide-and-conquer implementation reducing 8 submatrix multiplications to 7 for O(n^2.807) execution.',
    topics: [
      'Implement standard matrix multiplication with three nested loops in O(n^3) time.',
      'Partition n×n square matrices into four (n/2)×(n/2) submatrices.',
      'Compute 7 Strassen products (P1 through P7) using submatrix additions and subtractions.',
      'Combine products into final result matrix and compare CPU operations against standard multiplication.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms Laboratory',
    courseCode: '23CS3505',
    number: 3,
    fileName: '23CS3505_Exp_3_Fractional_Knapsack_Greedy.pdf',
    title: '[DEMO] Experiment 3: Fractional Knapsack Problem using Greedy Strategy',
    description: 'Maximize total value under capacity constraint by calculating value-to-weight ratios.',
    topics: [
      'Define Item class containing value, weight, and calculated value/weight ratio.',
      'Sort items in descending order of value/weight ratio using custom comparator.',
      'Iterate through sorted items, taking full items while capacity allows and fractional fraction of final item.',
      'Output maximum achievable total value and fraction array of taken items.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms Laboratory',
    courseCode: '23CS3505',
    number: 4,
    fileName: '23CS3505_Exp_4_MST_Prim_Kruskal.pdf',
    title: '[DEMO] Experiment 4: Minimum Spanning Tree with Prim & Kruskal Algorithms',
    description: 'Graph algorithms implementation comparing Disjoint Set Union and Priority Queue Min-Heap.',
    topics: [
      'Represent weighted undirected graph using adjacency list and edge list structures.',
      'Implement Kruskal algorithm sorting edges by weight and detecting cycles using Union-Find with path compression.',
      'Implement Prim algorithm starting from arbitrary vertex expanding MST using PriorityQueue.',
      'Output total minimum spanning tree weight and set of selected spanning tree edges.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms Laboratory',
    courseCode: '23CS3505',
    number: 5,
    fileName: '23CS3505_Exp_5_Dijkstra_Shortest_Path.pdf',
    title: '[DEMO] Experiment 5: Dijkstra Single-Source Shortest Path Algorithm',
    description: 'Compute shortest path routing trees on weighted directed graphs with non-negative edge weights.',
    topics: [
      'Initialize distance array with infinity and source vertex distance to 0.',
      'Maintain Min-Heap PriorityQueue extracting vertex with smallest tentative distance.',
      'Relax all outgoing edges from extracted vertex updating distance array when shorter path is discovered.',
      'Reconstruct and print the complete shortest path sequence from source to all target vertices.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms Laboratory',
    courseCode: '23CS3505',
    number: 6,
    fileName: '23CS3505_Exp_6_01_Knapsack_DP.pdf',
    title: '[DEMO] Experiment 6: 0/1 Knapsack Problem with Dynamic Programming',
    description: 'Construct the DP bottom-up tabular state matrix and backtrack to identify selected items.',
    topics: [
      'Construct 2D integer array dp[n+1][W+1] where n is number of items and W is knapsack capacity.',
      'Populate table using recurrence dp[i][w] = max(dp[i-1][w], val[i-1] + dp[i-1][w - wt[i-1]]).',
      'Backtrack from dp[n][W] to identify exact set of selected items contributing to optimal value.',
      'Verify time complexity of O(nW) and compare efficiency against recursive exponential brute-force.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms Laboratory',
    courseCode: '23CS3505',
    number: 7,
    fileName: '23CS3505_Exp_7_Longest_Common_Subsequence.pdf',
    title: '[DEMO] Experiment 7: Longest Common Subsequence (LCS) Implementation',
    description: 'Determine sequence similarity between strings using 2D dynamic programming grid.',
    topics: [
      'Build (m+1)×(n+1) integer table computing LCS length for two input strings X and Y.',
      'Populate table matching characters diagonally (1 + dp[i-1][j-1]) and mismatched cells from max(dp[i-1][j], dp[i][j-1]).',
      'Trace back through table reconstructing the longest common subsequence string.',
      'Test algorithm on DNA sequences (e.g. AGGTAB vs GXTXAYB) verifying correct LCS output.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms Laboratory',
    courseCode: '23CS3505',
    number: 8,
    fileName: '23CS3505_Exp_8_Floyd_Warshall_Algorithm.pdf',
    title: '[DEMO] Experiment 8: Floyd-Warshall All-Pairs Shortest Path Algorithm',
    description: 'Dynamic programming matrix relaxation algorithm computing all-pairs shortest distance paths in O(V^3) time.',
    topics: [
      'Initialize distance matrix D[V][V] with direct edge weights and infinity for non-adjacent pairs.',
      'Execute 3 nested loops considering each vertex k as an intermediate candidate path vertex.',
      'Apply relaxation D[i][j] = min(D[i][j], D[i][k] + D[k][j]) across all (i, j) pairs.',
      'Detect negative weight cycles by inspecting diagonal entries D[i][i] < 0.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms Laboratory',
    courseCode: '23CS3505',
    number: 9,
    fileName: '23CS3505_Exp_9_N_Queens_Backtracking.pdf',
    title: '[DEMO] Experiment 9: N-Queens Problem using Backtracking',
    description: 'Place N non-attacking chess queens on an N×N board using bounding function pruning.',
    topics: [
      'Represent board configuration using single 1D array board[N] where index is row and value is column.',
      'Implement isSafe(row, col) function verifying column conflict and diagonal conflicts in O(row) time.',
      'Write recursive solveNQueens(row) placing queen, advancing to next row, and backtracking on dead ends.',
      'Print all distinct valid chessboard solutions for N = 4 and N = 8 boards.',
    ]
  },
  {
    courseName: 'Design Analysis and Algorithms Laboratory',
    courseCode: '23CS3505',
    number: 10,
    fileName: '23CS3505_Exp_10_TSP_Branch_and_Bound.pdf',
    title: '[DEMO] Experiment 10: Travelling Salesperson Problem (TSP) with Branch & Bound',
    description: 'Solve the symmetric TSP using reduced cost matrix and Lowest-Cost Branch and Bound search.',
    topics: [
      'Initialize cost matrix representing distance between all city pairs.',
      'Construct initial reduced matrix subtracting row minima and column minima to establish lower bound.',
      'Define search tree nodes tracking current path, visited bitmask, reduced matrix, and cumulative lower bound.',
      'Select next exploration branch using priority queue based on smallest lower bound estimate.',
    ]
  },

  // 3. Advanced Database Engineering Laboratory (23CS3506) — 10 Experiments
  {
    courseName: 'Advanced Database Engineering Laboratory',
    courseCode: '23CS3506',
    number: 1,
    fileName: '23CS3506_Exp_1_Schema_DDL_Constraints.pdf',
    title: '[DEMO] Experiment 1: Schema Definition, Integrity Constraints & DDL',
    description: 'Formulate normalized university database schemas enforcing primary keys and foreign key cascades.',
    topics: [
      'Create PostgreSQL tables for Department, Faculty, Student, Course, and Enrollment entities.',
      'Enforce domain integrity with CHECK constraints (e.g. CGPA BETWEEN 0.0 AND 10.0, semester IN (1..8)).',
      'Configure ON DELETE CASCADE and ON UPDATE CASCADE foreign key referential actions.',
      'Test constraint violation rejections by inserting duplicate primary keys and out-of-range values.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering Laboratory',
    courseCode: '23CS3506',
    number: 2,
    fileName: '23CS3506_Exp_2_Nested_Subqueries_Set_Ops.pdf',
    title: '[DEMO] Experiment 2: Nested Subqueries & Relational Set Operations',
    description: 'Execute analytical queries with EXISTS, NOT EXISTS, IN, ALL/ANY subquery operators, and UNION set logic.',
    topics: [
      'Find all students enrolled in both Advanced Java and DAA using INTERSECT and correlated EXISTS.',
      'Find courses with enrollments strictly greater than the average enrollment across all courses.',
      'Identify students who have NOT enrolled in any elective course using correlated NOT EXISTS.',
      'Perform UNION ALL of student activity logs comparing performance with simple UNION deduping.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering Laboratory',
    courseCode: '23CS3506',
    number: 3,
    fileName: '23CS3506_Exp_3_Index_Optimization_BTree.pdf',
    title: '[DEMO] Experiment 3: B-Tree & Hash Index Optimization on High-Volume Tables',
    description: 'Benchmark sequential table scans against clustered B-Tree and Hash indexes using execution timer measurements.',
    topics: [
      'Populate test table with 1,000,000 synthetic transaction records.',
      'Measure baseline sequential scan execution time for equality query WHERE transaction_id = 952341.',
      'Create standard B-Tree index and measure query execution latency reduction.',
      'Create Hash index for exact equality lookups and compare index storage footprint vs B-Tree.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering Laboratory',
    courseCode: '23CS3506',
    number: 4,
    fileName: '23CS3506_Exp_4_PLSQL_Stored_Procedures.pdf',
    title: '[DEMO] Experiment 4: PL/SQL Stored Procedures & In/Out Parameters',
    description: 'Write robust procedural SQL procedures with conditional exception handling and out parameters.',
    topics: [
      'Create stored procedure calculate_student_gpa(IN p_student_id INT, OUT p_gpa NUMERIC).',
      'Implement exception handling catching NO_DATA_FOUND and ZERO_DIVIDE conditions.',
      'Invoke procedure from anonymous code block and verify output variable assignment.',
      'Create stored function get_course_enrollment_count(p_course_id VARCHAR) returning integer.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering Laboratory',
    courseCode: '23CS3506',
    number: 5,
    fileName: '23CS3506_Exp_5_Database_Triggers_Audit.pdf',
    title: '[DEMO] Experiment 5: Database Triggers for Audit Logging & Integrity Rules',
    description: 'Develop BEFORE and AFTER row-level triggers recording changes to sensitive financial records.',
    topics: [
      'Create audit table student_grade_audit tracking changed_by, changed_at, old_grade, and new_grade.',
      'Construct AFTER UPDATE row-level trigger on student_grades table firing for each row change.',
      'Construct BEFORE INSERT trigger preventing enrollment if course capacity limit is reached.',
      'Execute updates on student records and verify automated immutable rows written to audit log table.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering Laboratory',
    courseCode: '23CS3506',
    number: 6,
    fileName: '23CS3506_Exp_6_Explicit_Cursors_Processing.pdf',
    title: '[DEMO] Experiment 6: Explicit Cursor Handling for Row-by-Row Processing',
    description: 'Implement parameterized explicit cursors with %FOUND, %NOTFOUND, and FOR UPDATE OF clauses.',
    topics: [
      'Declare explicit cursor selecting all students with pending library book returns.',
      'Open cursor, fetch rows into record variable within LOOP, and terminate with %NOTFOUND condition.',
      'Apply FOR UPDATE OF clause acquiring row-level locks on selected records.',
      'Execute conditional batch updates using WHERE CURRENT OF cursor clause.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering Laboratory',
    courseCode: '23CS3506',
    number: 7,
    fileName: '23CS3506_Exp_7_Transaction_Concurrency_2PL.pdf',
    title: '[DEMO] Experiment 7: Transaction Concurrency with Strict 2-Phase Locking',
    description: 'Simulate concurrent sessions verifying shared vs exclusive lock acquisition and deadlock timeouts.',
    topics: [
      'Open two parallel terminal sessions connected to PostgreSQL transaction engine.',
      'In Session 1: BEGIN; SELECT ... FOR SHARE; verify Session 2 can read but cannot write (blocking).',
      'In Session 2: UPDATE account balance; demonstrate wait state until Session 1 issues COMMIT.',
      'Intentionally cause mutual cyclic wait (Session 1 waits on 2, Session 2 waits on 1) verifying deadlock abort.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering Laboratory',
    courseCode: '23CS3506',
    number: 8,
    fileName: '23CS3506_Exp_8_Explain_Analyze_Tuning.pdf',
    title: '[DEMO] Experiment 8: Query Execution Plan Tuning with EXPLAIN ANALYZE',
    description: 'Interpret query plans in PostgreSQL, identifying cost bottlenecks, nested loop joins, and hash joins.',
    topics: [
      'Run EXPLAIN ANALYZE on unindexed 3-table join query and identify cost and actual time metrics.',
      'Analyze Seq Scan vs Index Scan vs Bitmap Index Scan plan nodes.',
      'Create appropriate composite index (student_id, semester) and observe plan change to Index Scan.',
      'Compare execution latency and buffer hits before and after index creation.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering Laboratory',
    courseCode: '23CS3506',
    number: 9,
    fileName: '23CS3506_Exp_9_MongoDB_Aggregation_Pipelines.pdf',
    title: '[DEMO] Experiment 9: MongoDB Document Modeling & Aggregation Pipelines',
    description: 'Design non-relational document collections, execute multi-stage aggregation pipelines.',
    topics: [
      'Model university courses document collection with embedded instructor and review arrays in MongoDB.',
      'Execute insertMany() inserting 10 sample course documents into collection.',
      'Build multi-stage aggregation pipeline using $match (department), $unwind (reviews), $group (average rating).',
      'Export aggregation results sorted in descending order of average student rating using $sort and $project.',
    ]
  },
  {
    courseName: 'Advanced Database Engineering Laboratory',
    courseCode: '23CS3506',
    number: 10,
    fileName: '23CS3506_Exp_10_Database_Backup_PITR.pdf',
    title: '[DEMO] Experiment 10: Database Backup, Point-in-Time Recovery & Dump Ops',
    description: 'Execute physical and logical database dumps (pg_dump) and restore databases to specified point in time.',
    topics: [
      'Execute pg_dump utility backing up university database to compressed custom format file university.dump.',
      'Simulate catastrophic data loss dropping a critical table (DROP TABLE enrollment).',
      'Execute pg_restore restoring database from backup file and verify table integrity.',
      'Demonstrate continuous WAL archiving and Point-in-Time Recovery (PITR) configuration in postgresql.conf.',
    ]
  },
];

// -------------------------------------------------------------
// Generation Routine
// -------------------------------------------------------------

const publicDir = path.resolve('public');
const assignDir = path.join(publicDir, 'demo-pdfs', 'assignments');
const expDir = path.join(publicDir, 'demo-pdfs', 'experiments');

fs.mkdirSync(assignDir, { recursive: true });
fs.mkdirSync(expDir, { recursive: true });

console.log('===============================================================');
console.log('  GENERATING 62 REAL DEMO PDF FILES FOR CAMPUSNOTES');
console.log('===============================================================');

// Generate 30 Assignments
console.log('\n[Phase 1] Generating 30 Demo Assignments (6 each across 5 theory subjects)...');
let assignCount = 0;
assignmentsData.forEach(item => {
  const pdfBuffer = createValidPdf({
    title: item.title,
    courseName: item.courseName,
    courseCode: item.courseCode,
    category: 'Assignments',
    number: item.number,
    description: item.description,
    topics: item.topics
  });
  const targetPath = path.join(assignDir, item.fileName);
  fs.writeFileSync(targetPath, pdfBuffer);
  assignCount++;
  console.log(`  ✓ (${assignCount}/30) [${item.courseCode}] ${item.fileName} (${pdfBuffer.length} bytes)`);
});

// Generate 32 Experiments
console.log('\n[Phase 2] Generating 32 Demo Experiments (12 Java Lab, 10 DAA Lab, 10 ADB Lab)...');
let expCount = 0;
experimentsData.forEach(item => {
  const pdfBuffer = createValidPdf({
    title: item.title,
    courseName: item.courseName,
    courseCode: item.courseCode,
    category: 'Experiments / Practicals',
    number: item.number,
    description: item.description,
    topics: item.topics
  });
  const targetPath = path.join(expDir, item.fileName);
  fs.writeFileSync(targetPath, pdfBuffer);
  expCount++;
  console.log(`  ✓ (${expCount}/32) [${item.courseCode}] ${item.fileName} (${pdfBuffer.length} bytes)`);
});

console.log('\n===============================================================');
console.log(`  SUCCESSFULLY GENERATED ${assignCount} ASSIGNMENTS & ${expCount} EXPERIMENTS`);
console.log(`  TOTAL: ${assignCount + expCount} VALID REAL PDF FILES`);
console.log('===============================================================\n');
