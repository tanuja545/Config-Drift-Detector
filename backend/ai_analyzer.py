import os
import json
import google.generativeai as genai

def get_fallback_analysis(drift: dict) -> dict:
    """
    Generates a high-quality local analysis for a drift in case Gemini API is not configured.
    """
    key = drift['key']
    old = drift['old_value']
    new = drift['new_value']
    severity = drift['severity']
    
    explanation = f"Configuration '{key}' was modified."
    impact = "Potential change in system behavior or security profile."
    risk_level = "Low"
    recommendation = "Review the change to ensure it aligns with operational requirements."
    
    key_lower = key.lower()
    
    if 'port' in key_lower:
        explanation = f"Network port changed from '{old}' to '{new}'."
        impact = "Changes the port the service listens on. Can cause connectivity issues or conflict with other services."
        risk_level = "High" if severity == "Breaking" else "Medium"
        recommendation = f"Verify firewall rules allow incoming traffic on port '{new}' and that no other services are using this port."
        
    elif 'ssl' in key_lower or 'tls' in key_lower or 'cert' in key_lower:
        explanation = f"SSL/TLS security setting '{key}' changed."
        impact = "Altering security protocols may expose data in transit, disable encryption, or cause client connection handshakes to fail."
        risk_level = "Critical"
        recommendation = "Ensure SSL certificates are valid and secure protocols (TLS 1.2/1.3) are enforced. Do not disable SSL in production."
        
    elif 'password' in key_lower or 'secret' in key_lower or 'key' in key_lower or 'token' in key_lower or 'auth' in key_lower:
        explanation = "Authentication credentials or security keys have been modified."
        impact = "A change in credentials, API keys, or secrets can lock out legitimate services, or point to unauthorized access attempts if not planned."
        risk_level = "Critical"
        recommendation = "Validate that the credentials/keys are rotated securely and match authorized access patterns. Avoid committing secrets to Git."
        
    elif 'db' in key_lower or 'database' in key_lower:
        explanation = f"Database configuration '{key}' changed from '{old}' to '{new}'."
        impact = "Points the application to a different database instance or modifies database access parameters. Could result in data mismatch, connectivity failures, or data loss."
        risk_level = "Critical"
        recommendation = "Verify the database connection string and credentials. Ensure the target database is healthy and has the correct schema."
        
    elif 'debug' in key_lower:
        explanation = f"Debug mode changed from '{old}' to '{new}'."
        if str(new).lower() in ['true', '1', 'yes']:
            impact = "Enabling debug mode in production exposes detailed stack traces, environment variables, and sensitive logs to end-users."
            risk_level = "High"
            recommendation = "Disable debug mode (set to false) in production environments immediately."
        else:
            impact = "Disabling debug mode improves security and reduces logging overhead."
            risk_level = "Low"
            recommendation = "Ensure sufficient centralized logging is active to diagnose issues in production without debug logs."
            
    elif 'timeout' in key_lower:
        explanation = f"Timeout setting '{key}' changed from '{old}' to '{new}'."
        impact = "Modifies the time the system waits for an operation to complete. High values cause resource exhaustion; low values cause premature request failures."
        risk_level = "Medium"
        recommendation = "Tune timeout parameters based on average latency and SLA. Monitor for timeout exceptions or leakages."
        
    elif 'retry' in key_lower:
        explanation = f"Retry policy setting '{key}' changed from '{old}' to '{new}'."
        impact = "Alters how the application handles transient errors. Too many retries can overwhelm backend services (thundering herd); too few retries can degrade user experience."
        risk_level = "Medium"
        recommendation = "Implement exponential backoff with jitter for retries. Do not retry indefinitely on non-transient errors."
        
    elif 'memory' in key_lower or 'limit' in key_lower or 'pool' in key_lower:
        explanation = f"Resource limit '{key}' adjusted from '{old}' to '{new}'."
        impact = "Changes memory or connection limits. Lower limits can cause Out-Of-Memory (OOM) errors or service exhaustion; excessively high limits can starve other processes."
        risk_level = "Medium"
        recommendation = "Perform load testing to establish optimal resource ceilings. Monitor container and host CPU/memory usage."
        
    elif 'cache' in key_lower:
        explanation = f"Cache configuration '{key}' modified."
        impact = "Affects data retrieval performance and consistency. Misconfigured caching can cause stale data or overload databases."
        risk_level = "Medium"
        recommendation = "Review Cache-Control policies, Time-To-Live (TTL) values, and cache eviction strategies."
        
    elif severity == "Cosmetic":
        explanation = f"Cosmetic metadata configuration '{key}' updated from '{old}' to '{new}'."
        impact = "No operational impact on system functionality or performance. Changes are descriptive or presentation-oriented."
        risk_level = "Low"
        recommendation = "Verify document accuracy and check if spelling is correct."
        
    return {
        'key': key,
        'explanation': explanation,
        'impact': impact,
        'risk_level': risk_level,
        'recommendation': recommendation
    }

def analyze_drifts(drifts: list, api_key: str = None) -> list:
    """
    Analyzes list of drifts using Gemini API.
    Falls back to high-quality rule-based analysis if API key is not available or call fails.
    """
    if not drifts:
        return []
        
    # Check for api_key from arguments, then environment
    key_to_use = api_key or os.environ.get("GEMINI_API_KEY")
    
    if not key_to_use:
        # No key, run local rule-based analyzer
        return [{**d, **get_fallback_analysis(d)} for d in drifts]
        
    try:
        # Configure the Gemini API
        genai.configure(api_key=key_to_use)
        
        # Prepare the input for Gemini
        drifts_input = []
        for d in drifts:
            drifts_input.append({
                'key': d['key'],
                'type': d['type'],
                'old_value': str(d['old_value']),
                'new_value': str(d['new_value']),
                'severity': d['severity']
            })
            
        prompt = f"""
You are an expert DevOps, Site Reliability, and Cloud Security Engineer.
Analyze the following list of configuration drifts (differences) detected between an intended (baseline) configuration file and an actual (live) configuration file.

Configuration Drifts to analyze:
{json.dumps(drifts_input, indent=2)}

For each drift, perform a detailed assessment and provide:
1. `explanation`: A clear explanation of what changed in plain language.
2. `impact`: The potential operational, performance, or security impact this change has on the running system.
3. `risk_level`: The risk classification of this change. Choose strictly from: 'Low', 'Medium', 'High', 'Critical'.
4. `recommendation`: A clear, actionable fix or verification recommendation.

You must return a valid JSON array matching the keys of the input.
Response format must be exactly a JSON array of objects, like this:
[
  {{
    "key": "example.key",
    "explanation": "Brief description of change",
    "impact": "Operational or security impact",
    "risk_level": "Low/Medium/High/Critical",
    "recommendation": "Step-by-step fix suggestion"
  }}
]

Make your analysis specific to the configuration key names (e.g. ports, SSL settings, database settings, retry flags, etc.).
Ensure you output ONLY a valid JSON array. Do not wrap the JSON output in markdown blocks or write any introductory text.
"""
        
        # Try to use gemini-1.5-flash
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        # Parse the JSON response
        try:
            results = json.loads(response.text.strip())
            # Map results by key
            analysis_map = {item['key']: item for item in results if 'key' in item}
            
            # Merge with original drifts
            analyzed_drifts = []
            for d in drifts:
                key = d['key']
                if key in analysis_map:
                    analyzed_drifts.append({
                        **d,
                        'explanation': analysis_map[key].get('explanation'),
                        'impact': analysis_map[key].get('impact'),
                        'risk_level': analysis_map[key].get('risk_level', 'Medium'),
                        'recommendation': analysis_map[key].get('recommendation')
                    })
                else:
                    # Fallback for individual item if missing in AI response
                    fallback = get_fallback_analysis(d)
                    analyzed_drifts.append({**d, **fallback})
                    
            return analyzed_drifts
            
        except (json.JSONDecodeError, AttributeError) as e:
            # If JSON parsing failed, try to regex-extract or fallback
            print(f"Failed to parse Gemini response as JSON: {e}. Response text: {response.text}")
            return [{**d, **get_fallback_analysis(d)} for d in drifts]
            
    except Exception as e:
        print(f"Gemini API call failed: {e}")
        # Call failed, use local rules
        return [{**d, **get_fallback_analysis(d)} for d in drifts]
