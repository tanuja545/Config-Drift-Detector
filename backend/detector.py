import json
import re
import yaml
from deepdiff import DeepDiff

def parse_config(content: str, file_format: str) -> dict:
    """
    Parses configuration content (JSON or YAML) into a Python dictionary.
    """
    if not content or not content.strip():
        return {}
        
    file_format = file_format.lower()
    if file_format in ['json']:
        return json.loads(content)
    elif file_format in ['yaml', 'yml']:
        return yaml.safe_load(content) or {}
    else:
        # Try JSON first, then YAML
        try:
            return json.loads(content)
        except Exception:
            try:
                return yaml.safe_load(content) or {}
            except Exception:
                raise ValueError("Unsupported format or invalid syntax. Please upload valid JSON or YAML.")

def clean_path(path_str: str) -> str:
    """
    Converts DeepDiff path syntax like root['server']['port'] or root['settings'][0]['name']
    into a cleaner dot notation: server.port or settings[0].name.
    """
    # Remove 'root' prefix
    if path_str.startswith("root"):
        path_str = path_str[4:]
    
    def bracket_replacer(match):
        val = match.group(1)
        if val.isdigit():
            return f"[{val}]"
        if (val.startswith("'") and val.endswith("'")) or (val.startswith('"') and val.endswith('"')):
            val = val[1:-1]
        return f".{val}"
        
    path_str = re.sub(r"\[([^\]]+)\]", bracket_replacer, path_str)
    
    # Clean up double dots and leading/trailing dots
    path_str = path_str.replace("..", ".")
    if path_str.startswith("."):
        path_str = path_str[1:]
    if path_str.endswith("."):
        path_str = path_str[:-1]
        
    return path_str

def get_severity(key_path: str) -> str:
    """
    Categorizes the severity based on the key name.
    - Breaking: SSL, Port, Database, Authentication, Security settings
    - Functional: Timeout, Memory, Retry, Cache, Performance settings, debug, host, url
    - Cosmetic: Labels, Descriptions, Display names, comments, etc. (Default fallback)
    """
    key_lower = key_path.lower()
    
    # Breaking terms
    breaking_terms = [
        'ssl', 'tls', 'port', 'db', 'database', 'auth', 'password', 'passwd',
        'key', 'secret', 'security', 'cert', 'token', 'credential', 'username',
        'allow', 'deny', 'firewall', 'admin', 'encrypt'
    ]
    
    # Functional terms
    functional_terms = [
        'timeout', 'memory', 'retry', 'cache', 'max', 'min', 'size', 'limit',
        'pool', 'interval', 'debug', 'enable', 'disabled', 'host', 'url',
        'endpoint', 'connection', 'thread', 'worker', 'buffer', 'period',
        'policy', 'mode', 'strategy', 'target', 'directory', 'path'
    ]
    
    # Check breaking first
    if any(term in key_lower for term in breaking_terms):
        return 'Breaking'
        
    # Check functional
    if any(term in key_lower for term in functional_terms):
        return 'Functional'
        
    # Default is Cosmetic
    return 'Cosmetic'

def detect_drift(intended_content: str, actual_content: str, file_format: str) -> list:
    """
    Compares the intended configuration with actual configuration and returns a list of drifts.
    """
    intended = parse_config(intended_content, file_format)
    actual = parse_config(actual_content, file_format)
    
    # Run DeepDiff
    # verbose_level=2 returns the values of the changes
    diff = DeepDiff(intended, actual, ignore_order=True, verbose_level=2)
    drifts = []
    
    # 1. Values Changed
    if 'values_changed' in diff:
        for path, change in diff['values_changed'].items():
            cleaned_key = clean_path(path)
            drifts.append({
                'key': cleaned_key,
                'type': 'Value Changed',
                'old_value': change.get('old_value'),
                'new_value': change.get('new_value'),
                'severity': get_severity(cleaned_key)
            })
            
    # 2. Dictionary Items Added (Exist in actual/live, but not in intended)
    if 'dictionary_item_added' in diff:
        # In deepdiff, value is in the new dict
        for path in diff['dictionary_item_added']:
            cleaned_key = clean_path(path)
            # Find value in actual
            val = diff['dictionary_item_added'][path]
            drifts.append({
                'key': cleaned_key,
                'type': 'Configuration Added',
                'old_value': None,
                'new_value': val,
                'severity': get_severity(cleaned_key)
            })
            
    # 3. Dictionary Items Removed (Exist in intended, but missing in actual/live)
    if 'dictionary_item_removed' in diff:
        for path in diff['dictionary_item_removed']:
            cleaned_key = clean_path(path)
            val = diff['dictionary_item_removed'][path]
            drifts.append({
                'key': cleaned_key,
                'type': 'Configuration Removed',
                'old_value': val,
                'new_value': None,
                'severity': get_severity(cleaned_key)
            })
            
    # 4. Type changes
    if 'type_changes' in diff:
        for path, change in diff['type_changes'].items():
            cleaned_key = clean_path(path)
            drifts.append({
                'key': cleaned_key,
                'type': 'Type Changed',
                'old_value': f"{change.get('old_value')} ({change.get('old_type').__name__})",
                'new_value': f"{change.get('new_value')} ({change.get('new_type').__name__})",
                'severity': get_severity(cleaned_key)
            })
            
    return drifts
