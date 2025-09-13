# 🚀 AI-Driven Career Path Analytics Platform

Welcome to a revolutionary Web3 platform that tackles the real-world problem of unreliable career guidance and credential fraud! In today's job market, fake degrees and generic advice lead to mismatched careers and hiring risks. This project uses the Stacks blockchain with Clarity smart contracts to verify academic data immutably, aggregate anonymized insights, and integrate with off-chain AI for personalized career path analytics. Users get tailored recommendations based on verified real-world data, employers verify credentials instantly, and data contributors earn tokens—fostering a transparent, decentralized ecosystem for career development.

## ✨ Features

📜 Immutable verification of academic credentials (degrees, certifications, transcripts)  
🤖 AI-powered career suggestions, skill gap analysis, and industry trend predictions  
🔒 Privacy-preserving data sharing with anonymized aggregation  
💰 Token rewards for verified data contributors and validators  
📊 On-chain analytics for community insights (e.g., average career progression by field)  
🏢 Employer tools for instant credential checks  
🌐 Decentralized governance for platform updates  
🚫 Fraud prevention through hash-based proofs and oracle validations  

## 🛠 How It Works

**For Users (Job Seekers/Students)**  
- Register your profile and submit hashed proofs of academic data (e.g., degree scans).  
- Get it verified by institutions or oracles.  
- Request AI analytics: Input your goals, and receive personalized career paths (e.g., "From CS degree to AI engineer: Suggested skills and timelines").  
- Share anonymized data to earn tokens and contribute to community models.  

**For Educational Institutions**  
- Issue verified credentials as NFTs or tokens.  
- Validate user-submitted data via secure hashes.  

**For Employers/Analysts**  
- Query verified credentials for hiring.  
- Access aggregated analytics (e.g., "Success rates for MBA grads in tech").  
- Use AI-driven reports fetched via oracles.  

**Technical Flow**  
1. Users/institutions interact with contracts to verify and store data.  
2. Anonymized data is aggregated on-chain.  
3. Off-chain AI (integrated via oracles) processes data for predictions.  
4. Results are stored/queried immutably, with tokens handling incentives.  
All powered by 8 modular Clarity smart contracts for scalability and security.

## 📂 Smart Contracts Overview

This project involves 8 smart contracts written in Clarity, ensuring modularity for verification, storage, analytics, and governance. Each contract handles a specific aspect to keep the system decentralized and efficient.

1. **RegistryContract.clar**  
   Registers users, institutions, and validators. Stores principal addresses and basic metadata. Key functions: `register-user`, `register-institution`, `get-user-info`.

2. **VerificationContract.clar**  
   Handles submission and verification of academic data hashes (e.g., SHA-256 of transcripts). Institutions approve via signatures. Key functions: `submit-proof`, `verify-proof`, `is-verified`.

3. **StorageContract.clar**  
   Securely stores verified academic data as maps (e.g., user -> list of credentials). Supports updates with versioning. Key functions: `store-credential`, `get-credentials`, `update-credential`.

4. **PrivacyContract.clar**  
   Manages anonymization and zero-knowledge proofs for data sharing (using Clarity's trait system for privacy primitives). Key functions: `anonymize-data`, `prove-ownership-without-reveal`, `share-anonymized`.

5. **AggregatorContract.clar**  
   Aggregates anonymized data for analytics (e.g., averages, counts by field). Ensures data privacy during aggregation. Key functions: `aggregate-stats`, `get-aggregated-data`, `contribute-data`.

6. **OracleContract.clar**  
   Interfaces with off-chain oracles for AI computations (e.g., feeding data to ML models and retrieving results). Validates oracle responses. Key functions: `request-ai-analysis`, `submit-oracle-result`, `get-ai-insight`.

7. **TokenContract.clar**  
   Implements a fungible token (STX or custom SIP-10) for rewards, payments, and staking. Rewards data contributors. Key functions: `mint-tokens`, `transfer-tokens`, `stake-for-rewards`.

8. **GovernanceContract.clar**  
   DAO-style voting for platform upgrades, parameter changes, and dispute resolution. Uses tokens for voting power. Key functions: `propose-change`, `vote-on-proposal`, `execute-proposal`.

## 🚀 Getting Started

Clone the repo, deploy contracts on Stacks testnet using Clarinet, and integrate with off-chain AI (e.g., via Python scripts calling models like GPT or scikit-learn). For full implementation, check the `/contracts` folder. Let's build a fraud-free future for careers! 🌟